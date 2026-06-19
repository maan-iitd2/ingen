# InGen Studio — Frontend Design Document (v2, YAML-first)

> A frontend for **InGen**, BlackRock's YAML-driven, no-code data interface generator
> (a CLI ETL tool built on pandas + great_expectations). This document is derived from
> reading the backend under `ingen/`. It supersedes v1.
>
> **Reframing (v2):** InGen is **not** an API platform. It is a CLI that consumes one YAML
> metadata file and writes one output per interface. The frontend is therefore a **YAML
> configuration authoring tool + execution console + pipeline visualizer** — not a node-graph
> IDE. There is **no backend server today**; the app is fully functional on mocks and is
> structured so a future FastAPI wrapper drops in with minimal change.

**Status:** Design only. No backend files modified. No code run. No frontend code written yet.

```
Today:   Frontend ──▶ Mock services (in-browser) ──▶ localStorage
Future:  Frontend ──▶ FastAPI wrapper ──▶ python -m ingen ──▶ filesystem
                       (same service interface; only the adapter changes)
```

---

## 0. Corrections carried in from review (authoritative backend facts)

The v1 doc had errors. These are verified against source and are binding on all schemas below:

- **No `db` source type.** `SourceFactory.parse_source` (`source_factory.py:12-27`) supports only
  `file`, `mysql`, `api`, `rawdatastore`, `json`. `db` raises `ValueError`. `DataSourceType.DB`
  exists in the enum but is unreachable. The relational source is **`mysql`** only.
- **`not_equals_filter`** (`not_equals_filter.py:21-34`): `{ type, source?, cols: [ {col, val:[...]} ] }`
  — plural `cols`, list `val`. (v1 had scalar `col`/`val`.)
- **`drop_duplicates`** pre-processor (`drop_duplicates.py:8-11`): `{ type, columns:[...], keep:"first"|"last"|false }`.
- **`file_type`** values (`ReaderFactory`, `file_reader.py:122-127`): `delimited_file`, `excel`,
  `xml`, `json`, `fixed_width`.
- **Interfaces run in YAML declaration order**, not topological order (`__main__.py:26` loops the
  parsed dict). A `rawdatastore` consumer declared before its producer **fails at runtime**. The
  UI must treat interface order as significant and warn on producer-after-consumer.
- **The backend emits no structured run telemetry.** `generate()` logs to a Python logger and
  returns a written file or `df.to_json(orient="records", lines=True)` (only when `output.type`
  is empty). Per-stage status, row counts, and a machine-readable validation summary **must be
  produced by the future FastAPI wrapper** — they are not free. In v2 these are **mocked** and
  explicitly labeled "requires wrapper instrumentation."
- **`blocker` detection is a substring test** (`base_interface_generator.py:44`,
  `"blocker" not in str(validation_summary)`) — model it as best-effort, not a guaranteed enum.

---

## 1. Backend reference (unchanged, condensed)

Execution flow (`BaseInterfaceGenerator.generate`), per interface, fixed order:
**read → validate(raw) → pre_process → format → post_process → validate(formatted) → notify → write.**

Registries the UI palettes are generated from:

- **Source types:** `file` (file_type ∈ delimited_file/excel/xml/json/fixed_width), `mysql`, `api`,
  `rawdatastore`, `json`.
- **Pre-processors:** `merge`, `union`, `aggregate`, `mask`, `melt`, `drop_duplicates`, `filter`,
  `json_array_expander`, `not_equals_filter`, `outer_join`.
- **Formatters (~40):** `date, float, concat, constant, constant-date, duplicate, decryption,
  encryption, group-percentage, sum, date-diff, bucket, arithmetic_calc, fill_empty_values,
  fill_empty_values_with_custom_value, replace_value, runtime_date, uuid, sub_string,
  conditional_replace_formatter, bus_day, split_col, decode_bytes, float_precision,
  extract_from_pattern, index_counter, add_space, add_trailing_zeros, last_date_of_prev_month,
  current_timestamp, get_running_environment, drop_duplicates, prefix_string, suffix_string,
  constant_condition, override`.
- **Post-processors:** `pivot`.
- **Validations:** GE built-ins (`expect_column_values_to_not_be_null`, `..._to_match_regex_list`,
  `..._to_match_strftime_format`, `..._to_be_between`, `..._to_be_unique`,
  `expect_column_value_lengths_to_equal`) + custom (`expect_column_to_contain_values`,
  `expect_column_values_to_be_of_type`, `expect_column_values_to_be_present_in`,
  `expect_column_to_be_present_in`); severities `blocker | critical | warning`.
- **Writers/outputs:** `delimited_file`, `excel`, `json`, `json_writer`, `rawdatastore`,
  `splitted_file`. `run_config.writer ∈ {InterfaceWriter, SplitFileWriter}`;
  `generator` default `InterfaceGenerator`; `formatter` default `Formatter`.
- **Interpolators:** `$date`, `$token`, `$token_secret`, `$timestamp`, `$uuid`; runtime `infile`, `override`.

The full canonical JSON ⇄ YAML schemas (source union, interface, pre-process, columns/formatters,
output) live in **Appendix S**, with the v1 errors fixed.

---

## 2. Revised Page Hierarchy

The product centers on **one config document** (the YAML). Everything is a view onto it.

```
InGen Studio
│
├── Configs (list / landing)                         ......... navigate & manage YAML docs
│
└── Config Workspace  [/configs/:id]                 ......... the document under edit
    │   (persistent 3-pane shell: Nav rail · Editor · YAML preview)
    │
    ├── ① Interface Editor   [/configs/:id/interfaces/:name]   ★ PRIMARY screen
    │       ├─ Sources tab        (forms + table)
    │       ├─ Pre-processing tab (ordered stepper/list)
    │       ├─ Columns & Formatters tab (table + per-cell config panel)
    │       ├─ Post-processing tab (form: pivot)
    │       ├─ Validations tab    (table)
    │       └─ Output tab         (writer form + custom header/footer builder)
    │
    ├── ② YAML Preview         (always-docked right pane)        ★ FIRST-CLASS
    │       └─ full-screen route [/configs/:id/yaml] (edit/import/diff)
    │
    ├── ③ Run Console          [/configs/:id/run]                ★ FIRST-CLASS
    │       └─ runtime overrides → mocked execution → stage timeline + logs + validation
    │
    ├── ④ Pipeline Overview    [/configs/:id/overview]           (React Flow — ONLY here)
    │       └─ multi-interface dependency DAG + rawdatastore edges
    │
    ├── ⑤ Sources Registry     [/configs/:id/sources]            (shared across interfaces)
    │
    └── ⑥ Run History          [/configs/:id/runs] · [/runs/:runId]   (mocked audit)
```

Tier-1 (always reachable, the spine): **Interface Editor**, **YAML Preview**, **Run Console**.
Tier-2 (supporting): Pipeline Overview, Sources Registry, Run History, Configs landing.

---

## 3. Revised Navigation Structure

A **persistent two-level shell** so the YAML is never out of sight:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ TOPBAR:  InGen Studio   |  [Config: Positions EOD ▾]   |  ● Saved   [Run ▸] │
├──────────┬───────────────────────────────────────────┬────────────────────┤
│ NAV RAIL │  EDITOR PANE (route content)              │  YAML PREVIEW       │
│          │                                           │  (docked, live)     │
│ Overview │  Interface Editor tabs:                   │                      │
│ Sources  │  [Sources][Pre][Columns][Post][Valid][Out]│  interfaces:         │
│ ─────────│                                           │    positions:        │
│ Interfaces│  ...form / table / stepper...            │      sources: [...]  │
│  • positions ◀ selected                              │      columns:        │
│  • taxlots │                                          │        - src_col...  │
│  + Add    │                                           │  [Copy] [Download]   │
│ ─────────│                                           │  ⟂ jump-to-section   │
│ Run       │                                           │                      │
│ History   │                                           │                      │
└──────────┴───────────────────────────────────────────┴────────────────────┘
```

- **Config switcher** (topbar) — change the active document; list lives at `/configs`.
- **Nav rail** — Overview, Sources, the interface list (add/select/reorder — order is meaningful,
  see §0), Run, History.
- **Save state pill** — Saved / Unsaved / Saving (real persistence, §8).
- **Run button** — always available; routes to Run Console.
- **YAML preview** — docked right pane on editor routes; collapsible; bidirectional **jump-to-section**
  (click a field → scroll YAML; click YAML node → focus field). Promotes to full screen at `/yaml`.
- **Deep-linkable routes** so an interface tab is shareable/bookmarkable (enterprise review flows).
- Quality floor: responsive (preview collapses under ~1100px), keyboard focus visible,
  `prefers-reduced-motion` respected, explicit empty/error/permission states.

---

## 4. Screen-by-Screen Breakdown

### ① Interface Editor — PRIMARY
One interface at a time; six tabs mapping 1:1 to the pipeline stages. **No canvas.**

- **Sources tab** — table of sources used by this interface (subset of the Sources Registry),
  reorder (the first source is the pre-process base input — `pre_processor.py:40`). Inline
  add/edit opens the type-specific source form (§ forms below). Per-source `src_data_checks`
  (raw validations) edited here.
- **Pre-processing tab** — an **ordered vertical stepper** (output of step N = input of N+1, per
  `PreProcessor.pre_process`). Each step is a card with a type-specific form (merge/union/aggregate/
  mask/melt/filter/not_equals_filter/outer_join/drop_duplicates/json_array_expander). Drag to
  reorder; column dropdowns populated from the mock schema flowing into that step (see §5 schema model).
- **Columns & Formatters tab** — a **table**: rows = columns (`src_col_name` → `dest_col_name`),
  an expandable panel per row to stack formatters (ordered; each formatter has a schema-driven
  `format` form). This is the densest, highest-traffic surface — most real work happens here.
- **Post-processing tab** — single form (`pivot`: `pivot_col`, `value_col`).
- **Validations tab** — table of formatted-frame expectations: `type` (from the validations
  catalog), `severity`, `args`. Severity badge explains the action (blocker aborts / critical
  drops rows / warning reports).
- **Output tab** — writer selector → type-specific form: `delimited_file`/`excel`
  (path[s], delimiter, encoding, header/footer), `json_writer` (convertor single|multiple +
  `column_details.schema` builder), `splitted_file` (per-file builder; auto-sets
  `run_config.writer = SplitFileWriter`), `rawdatastore` (`id` — becomes a producer edge in the
  Overview DAG). Includes the **custom header/footer function builder** (ordered list of
  constant/filler/get_new_line/col_sum/sum_of_substr/row_count/date/run_date/
  last_date_of_prev_month/first_date_of_current_month).

### ② YAML Preview — FIRST-CLASS
- Always-live serialization of the config model (§7). Read-only docked pane + full-screen `/yaml`.
- Full screen adds: **paste-to-import** (YAML → model, mirrors `MetaDataParser`), **download**,
  **copy**, **diff vs last saved** (change-control), inline schema-lint markers.
- Round-trips through the model: editing in forms updates YAML; importing YAML repopulates forms.

### ③ Run Console — FIRST-CLASS
- **Runtime overrides form** (maps to CLI args — none of this mutates the saved YAML):
  `run_date`, `interfaces` subset (`--interfaces`), `query_params` (`--query_params`, SQL `{param}`),
  `infile` (single path or `source_id=path` map, `--infile`), `override_params`
  (`--override_params`), `dynamic_data` JSON (for `json` sources / `process_json`).
- **Execute (mocked)** → a **stage timeline** per interface mirroring `generate()` order
  (read→validate→pre→format→post→validate→write), each tile lighting in sequence with mocked
  timing/row counts; **log stream** (mocked InGen-style lines); **validation summary** keyed by
  `source.id` then interface name (matches backend dict shape); **output preview** (sampled
  records) + artifact "download" (mock blob).
- Every value here is mock-sourced and labeled "requires wrapper instrumentation" (§0).

### ④ Pipeline Overview — React Flow (the only canvas)
- Nodes = interfaces (and optionally source/output endpoints); edges = `rawdatastore`
  producer→consumer relationships. Detects **cycles** and **declaration-order hazards** (§0).
- Read-mostly: click a node → jump to its Interface Editor. Not a place to edit step internals.

### ⑤ Sources Registry
- All sources for the config in one table (id, type, summary). Type-specific forms, mock
  **preview** (sampled frame), mock **test-connection** for mysql/api. Interfaces reference these by id.

### ⑥ Run History
- Mocked list of past runs (id, config, status, when, duration); detail at `/runs/:runId`
  replays a stored stage timeline + validation summary + artifacts. Enterprise audit surface.

### Configs Landing
- List/create/duplicate/delete configs; each card shows interface count + last-saved. Entry point.

#### Configuration forms catalog (the hard surfaces, all form/table — no graph)
API source (batch, url_params file|db|const, auth, success_criteria + criteria_option, throttling
queue_size/tasks_len, retries/interval/interval_increment) · mysql temp_table_params/temp_table_cols ·
json_writer column_details.schema (field_name/type/attr/action/agg_column/total/action_column) ·
custom header/footer builder · splitted_file builder · run_config selectors
(generator/writer/formatter) · interpolator/token picker · xml root_tag + `.`/`.@attr` helper ·
json `dynamic_data` payload · validation_action.send_email recipients.

---

## 5. React Flow Usage Boundaries

**React Flow is used in exactly one place: the Pipeline Overview (④).** Allowed only for:
- multi-interface **dependency visualization**,
- **rawdatastore** producer→consumer relationships,
- high-level **overview DAGs** (config map: sources → interfaces → outputs).

**React Flow is forbidden inside a single interface.** Those surfaces use:
- **forms** — sources, output, post-process, all type-specific configs;
- **tables** — columns/formatters, validations, sources registry;
- **steppers / ordered lists** — pre-processing pipeline, custom header/footer functions, the run
  stage timeline (linear, fixed order — a stepper, not a DAG);
- **configuration panels** — the expandable per-row formatter editor.

Rationale: within one interface the stage order is fixed and pre-processing is an ordered list, so
a node-graph adds drag/layout/a11y cost for zero modeling benefit. The only genuinely graph-shaped
data is **between** interfaces (shared in-memory frames via the `Store`).

**Schema-flow model (mock):** column dropdowns are populated from per-step *declared* output
columns in the mock fixtures (e.g., `preview-step.schemaAfter`) — the frontend does **not** replay
pandas semantics in JS. When the wrapper exists, the same selector reads real sampled schema.

---

## 6. Mock Service Architecture

Single seam so mocks → HTTP is a one-line swap.

```
UI components ──▶ Service Interfaces (TS contracts) ──▶ Adapter (chosen by env flag)
                                                         ├─ MockAdapter  (today)
                                                         └─ HttpAdapter  (future FastAPI)
```

- **Service interfaces** (stable, adapter-agnostic):
  `ConfigService` (list/get/create/update/delete/validate/importYaml/exportYaml),
  `CatalogService` (sourceTypes/preProcessors/formatters/postProcessors/validations/writers/interpolators),
  `SourceService` (preview/testConnection),
  `RunService` (start/getStatus/getLogs/getOutputPreview).
- **MockAdapter** — resolves calls against static fixtures in `src/mocks/` and `localStorage`:
  - *Catalog* fixtures are static (generated from the registries in §1) — these are real and final.
  - *Config* persistence is real against `localStorage` (§8).
  - *Run* is a **scripted state machine**: `start()` returns a `runId`; `getStatus()` advances
    `queued → running → success|partial|failed` over scripted ticks, replaying canned log lines,
    a per-stage timeline, a validation summary, and an output sample. Deterministic + seedable for
    demos. Mocked execution, logs, and validation results all live here.
  - *Preview / test-connection* return canned frames / OK-fail.
- **HttpAdapter (future)** — same method signatures, calls the FastAPI wrapper; only `src/mocks`
  and the adapter binding change. No component edits.
- **Contract parity:** mock fixtures are typed against the same interfaces the HttpAdapter will
  satisfy, so a fixture that drifts from the contract fails typecheck.

What is **real today vs mocked**:
| Concern | Today | Future |
|---|---|---|
| Catalog/palettes | real (static from registries) | static or served |
| YAML generation | **real** (in-browser, §7) | unchanged |
| Save config | **real** (localStorage) | FastAPI persistence |
| Run / logs / validation | **mocked** (scripted) | FastAPI → `python -m ingen` |
| Source preview / connection | mocked | FastAPI sampling |

---

## 7. YAML Generation Architecture

YAML generation is **real**, deterministic, and the single source of truth for export.

```
Form/table edits ─▶ ConfigModel (normalized JSON) ─▶ modelToYaml() ─▶ YAML text (preview/save/export)
Imported YAML  ─▶ yamlToModel() (parse + normalize) ─▶ ConfigModel ─▶ repopulates forms
```

- **ConfigModel** — normalized in memory (`sourcesById`+order, `interfacesByName`+order,
  `run_config`, `meta`). Order arrays preserve interface/source ordering (§0 hazard).
- **Serializer** — `modelToYaml()` denormalizes to the exact InGen structure: top-level `sources:`
  (list), `interfaces:` (mapping keyed by name), `run_config:`; each interface emits
  `sources` (list of ids), `pre_processing`, `columns`, `post_processing`, `validation_action`,
  `output`. Uses a YAML library (e.g. `js-yaml`) with **stable key ordering** so the preview/diff
  is deterministic. Omits empty/default sections to keep output clean.
- **Parser** — `yamlToModel()` mirrors `MetaDataParser`: resolve `interface.sources` ids against
  the sources list, surface unknown-id / unknown-type / unknown-formatter errors as lint markers.
- **Validation layer** (no run): schema checks against the catalog + cross-reference checks
  (every referenced source id exists; every `rawdatastore` source has a producing interface
  declared *before* it). Pure functions, reused by both the YAML lint and the import path.
- **Determinism contract:** model→YAML→model is identity; tested against `examples/*.yml` and
  `test/input/*.yml` as fixtures (validation only — never executed).

---

## 8. Save Configuration (real)

- MVP persistence is **real against `localStorage`** through `ConfigService` (create/update with
  dirty-tracking and a Saved/Unsaved/Saving pill). Export/import via YAML download/paste.
- Same `ConfigService` interface is later satisfied by the FastAPI adapter (server persistence);
  components don't change. Optional `File System Access API` export to a real `.yml` for users who
  run the CLI directly.

---

## 9. Implementation Phases (priority order)

**Phase 0 — Foundations**
App shell (topbar + nav rail + docked YAML pane), routing, `ConfigModel`, `modelToYaml`/`yamlToModel`,
service interfaces + MockAdapter wiring, static catalog fixtures from the §1 registries.

**Phase 1 — Author + see YAML (the core loop)**
Interface Editor: Sources tab, Columns & Formatters table, Output tab (delimited_file/excel) +
live YAML preview + real localStorage save. This alone delivers workflow steps 1–4.

**Phase 2 — Full transform surface**
Pre-processing stepper (all 10 types), Validations tab, Post-processing, remaining source forms
(api/mysql/json/rawdatastore), json_writer + splitted_file + custom header/footer builders.

**Phase 3 — Run Console (mocked)**
Runtime overrides form, scripted run state machine, stage timeline, mocked logs, validation summary,
output preview + mock download. Delivers workflow steps 5–6.

**Phase 4 — Visualize + audit**
Pipeline Overview (React Flow) with rawdatastore edges + cycle/order-hazard detection; Run History;
YAML diff vs last saved; import flow hardening.

**Phase 5 — Wrapper-ready**
Swap MockAdapter → HttpAdapter behind the env flag; integrate FastAPI wrapper; replace mocked run
with real `python -m ingen` execution. No component changes expected.

---

## 10. MVP Scope vs Future Scope

**MVP (Phases 0–3)** — the full primary workflow on mocks:
- App shell + 3-pane layout; config switcher; real save (localStorage).
- Interface Editor (all six tabs) for the common path: `file`/`mysql` sources, full
  columns/formatters table, core pre-processors (merge, filter, aggregate, union), validations,
  `delimited_file`/`excel` output.
- **Real** YAML generation + live preview + import/export.
- Run Console with **mocked** execution, logs, validation results, output preview.

**Future (Phases 4–5 and beyond)** — enterprise + depth:
- Pipeline Overview DAG (React Flow), Run History/audit, YAML diff/version history.
- Remaining heavy forms: full api source, json_writer `column_details.schema`, splitted_file,
  custom header/footer, temp_table builders, interpolator/token picker.
- FastAPI wrapper + real execution; **then** the enterprise wrapper screens deferred from review:
  auth/SSO, roles, secrets/token management, scheduling, environment promotion, global settings,
  notification (`validation_action.send_email`) config.

> Explicitly **out of MVP:** any node-graph editing of a single interface; real pipeline execution;
> server-side persistence; auth. These are deliberately deferred, not forgotten.

---

## Appendix S — Canonical Schemas (v1 errors fixed)

Source union (`type`-discriminated): `file` (file_type ∈ delimited_file|excel|xml|json|fixed_width;
+ delimiter, columns, sheet_name, skip_header_size, skip_trailer_size, return_empty_if_not_exist,
col_specification, use_infile, record_path/meta/meta_prefix for json, root_tag for xml,
src_data_checks[]) · `mysql` (db_token, query with `{param}`, temp_table_params) · `api` (url,
method, request_body, headers, batch{size,id}, url_params[], data_node, data_key, meta, auth,
retries, interval, interval_increment, success_criteria, criteria_option, queue_size, tasks_len) ·
`rawdatastore` (id) · `json` (id; payload via runtime dynamic_data).

Pre-process (corrected):
`merge {source,left_key,right_key,merge_type:left|right|inner}` ·
`outer_join {source,left_key,right_key}` · `union {source:[ids]}` ·
`aggregate {groupby:{cols:[]}, agg:{operation,col}}` ·
`mask {on_col,masking_source,masking_col}` ·
`melt {key_column,value_column,include_keys:[],source:[]}` ·
`filter {operator:and|or, cols:[{col,val:[]}]}` ·
**`not_equals_filter {source?, cols:[{col,val:[]}]}`** ·
**`drop_duplicates {columns:[], keep:first|last|false}`** ·
`json_array_expander {config:{column, include_columns:[]|{key:out}, exclude_columns:[]}}`.

Column: `{src_col_name, dest_col_name?, formatters:[{type, format}]}` (format polymorphic per type).

Output: `delimited_file`/`excel` {props:{path:str|str[], delimiter, encoding, header, footer}} ·
`splitted_file` {props:[{col,value,type,props}]} (run_config.writer=SplitFileWriter) ·
`json`/`json_writer` {props:{convertor:single|multiple, convertor_props, destination:file|api,
destination_props}} · `rawdatastore` {props:{id}}.

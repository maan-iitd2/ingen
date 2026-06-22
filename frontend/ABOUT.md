# InGen Studio — Frontend

A no-code, browser-based authoring tool for **InGen**, BlackRock's YAML-driven data
interface generator (a pandas + great_expectations ETL engine that historically ran as a
CLI). InGen Studio turns the hand-edited YAML metadata file into a guided, validated,
visual editing experience.

---

## What problem it solves

InGen is configured by a single, deep YAML document: sources, ordered pre-processing steps,
per-column formatters (~40 of them), great_expectations validations, post-processing, and
output writers — all with strict shapes and cross-references the engine resolves at runtime.

Authoring that YAML by hand is the pain point:

- **Easy to get wrong.** A typo'd formatter name, an unknown source reference, or a
  `rawdatastore` consumer declared *before* its producer fails only at runtime, deep in a
  pandas stack trace.
- **High cognitive load.** You must remember the exact key shapes for every source type,
  pre-processor, formatter, and writer.
- **No feedback loop.** The CLI gives you nothing until you run a full pipeline against real
  data.

InGen Studio replaces hand-editing with **forms, tables, and steppers that know the schema**,
a **live YAML preview** that is the real serialized output, **inline validation** that catches
integrity errors before a run, and a **simulated run console** so you can rehearse a pipeline
without a backend.

---

## What it does

### Author a config without writing YAML
The **Interface Editor** is the primary screen — one interface at a time, six tabs mapping 1:1
to the engine's execution stages:

| Tab | What you configure |
|---|---|
| **Sources** | Which registered sources this interface reads, and their order (row 1 is the pipeline base). |
| **Pre-processing** | An ordered stepper of transforms (merge, filter, aggregate, union, outer join, mask, melt, drop-duplicates, not-equals-filter, json-array-expander). Order is meaningful — output of step N feeds N+1. |
| **Columns** | The source→output column map, with stackable per-column formatters edited inline. |
| **Post-processing** | The `pivot` reshape (pivot column → dynamic columns, filled from a value column). |
| **Validations** | great_expectations checks attached per column, with a severity (blocker / critical / warning) that explains the post-failure action. |
| **Output** | The writer (`delimited_file`, `excel`, `json`, `rawdatastore`, …) and its type-specific props. |

Source **definitions** are managed once in the **Sources Registry** and referenced by id across
interfaces.

### See the YAML it generates, live
A docked **YAML Preview** pane re-serializes the model on every edit using the real
`js-yaml`-based serializer — what you see is exactly what InGen would consume. Copy or download
it as a `.yml`. Serialization is deterministic (stable key order), and the round-trip
`model → YAML → model` is covered by unit tests.

### Catch mistakes before running
Cross-reference validation runs continuously and surfaces an issue count in the brand bar:
unknown source references, and the `rawdatastore` **declaration-order hazard** (a frame
consumed before any earlier interface produces it — a guaranteed runtime failure in the CLI).

### Three ways to edit the same model
A view switcher in the brand bar offers:
- **Manual** — the tabbed forms above.
- **Graph** — a React Flow canvas that renders the interface as a pipeline; drag transforms
  from the palette, click any node to open its editor in a drawer.
- **Chat** — a command-driven assistant (`add source …`, `filter …`, `change output to …`)
  that mutates the same config, with a persisted conversation history per interface.

All three write to one shared model, so the YAML and validation stay in sync no matter how you edit.

### Rehearse a run
The **Run Console** simulates execution (there is no backend today): set runtime overrides
(`run_date`, interface subset), then watch a staged timeline, mocked log stream, and a
validation summary. Past runs are saved to the **History** view for audit.

---

## Architecture at a glance

```
Form / table / graph / chat edits
        │
        ▼
  ConfigModel (normalized, in-memory)
        │                          │
        ▼                          ▼
  modelToYaml()  ──► live YAML   validateConfigModel() ──► inline issues
        │
        ▼
  ConfigService ──► MockAdapter ──► localStorage   (today)
                 └► HttpAdapter ──► FastAPI wrapper (future, same interface)
```

- **Single data model.** Everything is a view onto one normalized `ConfigModel`
  (`sourcesById` + order, `interfacesByName` + order). Pure, immutable model helpers do all
  mutation, so behavior is testable without React.
- **Real YAML generation.** Authoring is mocked-backend, but the YAML you export is produced by
  the actual serializer — not a stub.
- **Real persistence.** Configs save to `localStorage` (debounced autosave with a
  Saved / Unsaved / Saving pill), seeded with a realistic "Positions EOD" demo on first load.
- **One swap point for the future.** Every screen talks to service interfaces
  (`ConfigService`, `CatalogService`, `RunService`, …). Swapping the mock adapters for HTTP
  adapters that call a future FastAPI wrapper changes no component code.

---

## Tech stack

- **React 19** + **Next.js 15 (App Router)** — dev server, build, and file-based routing
- **File-based routes** — deep-linkable paths (`/configs/[configId]/interfaces/[interfaceName]`, `/run`, `/history`)
- **React Flow** — the Graph view canvas (used only for pipeline visualization)
- **js-yaml** — deterministic YAML serialization / parsing
- **lucide-react** — icons

---

## Running it

```bash
cd frontend
npm install      # first time only
npm run dev      # → http://localhost:5173
```

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload. |
| `npm run build` | Production bundle into `dist/`. |
| `npm run preview` | Serve the built bundle to verify it. |
| `npm run lint` | ESLint over `src/`. |
| `npm test` | Serializer round-trip / determinism tests. |

No environment setup is required — the app is fully functional on in-browser mocks and
`localStorage`. On first load it seeds a demo config and redirects you straight into its editor.

---

## Current scope

**Working today (on mocks):** the full authoring loop — Interface Editor (all six tabs),
Sources Registry, live YAML preview + export, inline validation, real localStorage save,
Graph and Chat editing, and a simulated Run Console + History.

**Intentionally non-functional:** *real* pipeline execution. There is no backend, so the engine
can't actually process data — the Run Console is a faithful **simulation**. This is the single
deferred capability; it drops in when the FastAPI wrapper is built, behind the existing service
interface, with no component changes.

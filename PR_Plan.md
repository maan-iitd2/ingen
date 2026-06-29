# PR Plan — splitting this fork into reviewable pieces

## The problem this solves

This branch (`feature/frontend-ui`) has diverged from upstream `ingen` by **374 files and
~76,700 insertions**. That is not humanly reviewable in one pass — a single PR that size gets
rubber-stamped, not reviewed. The diff is also misleading: most of it isn't human-written code.

It breaks down like this:

| Bucket | Lines | Reviewable? | Action |
|---|--:|---|---|
| `helper-repo/` — vendored **flowise + n8n** source (203 files) | 58,544 | No — 0 references from our code, licensing risk | **Deleted in this commit** |
| `frontend/package-lock.json` | 2,949 | No — auto-generated | Ships with PR 12, not line-reviewed |
| CRLF / whitespace churn in `test/` + `ingen/` | ~1,300 | No — e.g. `test_api_reader.py` showed 362 changed lines, **0 real**; `writer/util.py` 192/190 → **4/2 real** | **Renormalized in this commit** (`.gitattributes` + `git add --renormalize`) |
| `ingen/api/main.py` — second, dead FastAPI backend | 272 | No — superseded by `backend/app/`, unreferenced | **Deleted in this commit** |
| Stray AI-scaffolding docs (`implementation_plan.md`, `n8n_graph_prompt.md`) | 233 | No — throwaway | **Deleted in this commit** |
| **`frontend/src`** (111 files) | ~10,060 | **Yes** — the bulk of the real review | Waves 3–4 |
| **`backend/app`** (9 files) | 837 | **Yes** — new FastAPI wrapper | Wave 2 |
| `docs/`, real `ingen/` edits, root config | ~1,400 | **Yes** | Waves 1, 5 |

**After cleanup the genuinely human-reviewable surface drops from ~76k to ~13k lines** — three
distinct concerns bundled together (small `ingen` library fixes, a new backend wrapper, a new
Next.js frontend) that this plan carves into **25 path-scoped PRs**.

> This file is the **PR-splitting** plan. There is also a `plan.md` in the repo root — that is a
> separate **code-review remediation** task list (defects to fix). Different purpose; keep both.

## Cleanup already applied in this commit

So reviewers never see the dead weight, this commit already:

1. Deleted `helper-repo/` (58,544 lines of vendored flowise/n8n — unreferenced).
2. Deleted `ingen/api/` (272-line duplicate backend — superseded by `backend/app/`).
3. Deleted `implementation_plan.md` and `n8n_graph_prompt.md` (AI scaffolding).
4. Normalized line endings to LF (`.gitattributes` ships `* text=auto`), so the working tree is
   clean on any machine.
5. Added `.claude/` to `.gitignore` (local agent config, not committed).

> **Line-ending caveat (affects Waves 1–2).** `main` stores files with **CRLF**; this branch uses
> **LF**. Every file that exists in both `main` and the branch therefore renders as full-file churn
> on GitHub, even when the content is unchanged. Two flavours:
>
> - **~10 `ingen/` library + root files** (`json_source.py`, `setup.py`, `README`, …) have a tiny
>   real change (1–6 lines) buried in the EOL churn.
> - **7 `test/reader` files** (`test_api_reader.py`, `api_reader.py`, …) have **zero** real change —
>   pure EOL. When they land in a PR, skip them entirely.
>
> **Reviewers: enable "Hide whitespace changes" (the `?w=1` toggle on the PR Files tab)** and every
> diff collapses to just the real lines. The permanent fix is a separate one-off
> `git add --renormalize .` PR against `main` — do **not** bundle it into a feature PR.

## How to actually cut each PR

The existing commit history bundles huge unrelated chunks, so commit boundaries are **useless** as
review units. Cut PRs **by path** instead. Recipe per PR, off `main`:

```bash
git fetch origin
git checkout -b pr-13-frontend-models origin/main
git checkout feature/frontend-ui -- frontend/src/models      # the PR's paths
git commit -s -m "frontend: core config model + applyIntent"  # -s = DCO sign-off (required)
git push -u origin pr-13-frontend-models
gh pr create --base main --fill
```

- **Respect the waves / `Depends on` column.** A PR that imports code from an earlier PR should be
  opened after it (or stacked on its branch instead of `main`), or the reviewer sees dangling imports.
- **`git commit -s` is mandatory** — repo requires a DCO sign-off.
- Foundation PRs (12–16) before UI PRs (17–23). Within frontend, model → serializers → adapters →
  state → forms → components.

## The 25 PRs

### Wave 1 — `ingen` library (the published package; review first, most carefully)

| # | Title | Paths | ~Real lines | Depends | Review focus |
|--:|---|---|--:|---|---|
| 1 | ingen: pre-processor fixes | `ingen/pre_processor/not_equals_filter.py`, `ingen/pre_processor/outer_join.py` | ~10 | — | Filter/join semantics unchanged for existing configs |
| 2 | ingen: reader & source fixes | `ingen/data_source/json_source.py`, `ingen/reader/xml_file_reader.py`, `ingen/reader/api_reader.py`, `test/data_source/test_json_source.py`, `test/reader/*` | ~15 | — | Backwards-compatible parsing; tests still green |
| 3 | ingen: formatter / util / writer fixes | `ingen/formatters/common_formatters.py`, `ingen/utils/utils.py`, `ingen/writer/util.py`, `test/writer/test_util.py` | ~13 | — | No change to output shapes |
| 4 | packaging: deps & Python pin | `setup.py`, `requirements.txt` | ~46 | — | Why each pin (numpy<2, pandas<3, GE<1.0); Python 3.9–3.12 |

### Wave 2 — backend FastAPI wrapper (new)

| # | Title | Paths | ~Lines | Depends | Review focus |
|--:|---|---|--:|---|---|
| 5 | backend: app skeleton | `backend/app/__init__.py`, `backend/app/main.py` | ~150 | — | Routing only; CORS / env knobs; no business logic |
| 6 | backend: runner + store | `backend/app/runner.py`, `backend/app/store.py` | ~250 | 5 | Temp-YAML exec of `python -m ingen`; RunRecord; run history persistence |
| 7 | backend: validation | `backend/app/schema_validate.py`, `backend/app/validation.py` | ~110 | 5 | Validates config without running |
| 8 | backend: files + columns | `backend/app/files.py`, `backend/app/columns.py` | ~120 | 5 | Sample browsing; **upload size/type caps, header-only reads** (security) |
| 9 | backend: inChat assistant | `backend/app/chat.py`, `backend/requirements.txt`, `docs/chat_assistant.md` | ~300 | 5 | HF model load (Qwen3-4B); returns `{reply, ops}` JSON only — never writes YAML; torch/transformers cost |
| 10 | backend: tests | `backend/tests/*` | ~330 | 6–9 | Coverage of runner/store/validation/chat |
| 11 | backend: docs | `backend/README.md`, remaining `docs/*` | ~110 | 5 | Accuracy vs code |

### Wave 3 — frontend foundations (must merge before any UI PR)

| # | Title | Paths | ~Lines | Depends | Review focus |
|--:|---|---|--:|---|---|
| 12 | frontend: build scaffolding | `frontend/package.json`, `frontend/package-lock.json`, `frontend/next.config.mjs`, `frontend/jsconfig.json`, `frontend/eslint.config.js`, `frontend/.env*`, `frontend/.gitignore`, `frontend/public/`, `frontend/README.md` | ~3,100 (mostly lockfile) | — | Builds & lints; `@/*` alias; adapter-mode env. Lockfile not line-reviewed |
| 13 | frontend: core config model | `frontend/src/models/*` | ~700 | 12 | `configModel`, `types`, `constants`, `applyIntent` — the in-memory shape everything depends on |
| 14 | frontend: YAML serializers | `frontend/src/serializers/*` | ~600 | 13 | model ↔ ingen YAML round-trip; the two `*.test.js` |
| 15 | frontend: adapters + services | `frontend/src/adapters/*`, `frontend/src/services/*` | ~900 | 13 | mock vs http boundary; `fileService`, `chatService` |
| 16 | frontend: state, hooks, lib, utils | `frontend/src/state/*`, `frontend/src/hooks/*`, `frontend/src/lib/*`, `frontend/src/utils/*` | ~1,000 | 13 | React contexts (Config/Run/Chat/Catalog…), `useModelHistory` |

### Wave 4 — frontend UI

| # | Title | Paths | ~Lines | Depends | Review focus |
|--:|---|---|--:|---|---|
| 17 | frontend: forms engine + schemas | `frontend/src/forms/*` | ~900 | 13 | `SchemaForm`, `Fields`, per-stage schemas (source/output/formatter/preprocessor/validation) |
| 18 | frontend: app shell + routing | `frontend/src/app/*`, `frontend/src/components/layout/*`, `frontend/src/index.css`, `frontend/src/App.css`, `frontend/src/assets/*` | ~1,200 | 12,16 | Next file-routing; `NavRail`/`navPalette`; `BootGate` |
| 19 | frontend: start + common components | `frontend/src/components/start/*`, `frontend/src/components/common/*` | ~800 | 15,16 | Entry screen, `SourceLoader`; shared widgets |
| 20 | frontend: editor — tabs & manager | `frontend/src/components/editor/InterfaceEditor.jsx`, `InterfaceManager.jsx`, `editor/tabs/*` | ~1,400 | 14,16,17 | Columns/Sources/Output/PostProcessing/Validations tabs |
| 21 | frontend: editor — graph canvas + nodes | `frontend/src/components/editor/graph/*` | ~2,000 | 16,20 | The inFlow node-creator; canvas layout; per-stage nodes. The largest single review |
| 22 | frontend: editor — inChat UI | `frontend/src/components/editor/chat/InterfaceChatEditor.jsx` | ~300 | 15,16 | Applies `ops` client-side deterministically (pairs with PR 9) |
| 23 | frontend: run console + yaml view | `frontend/src/components/run/*`, `frontend/src/components/yaml/*` | ~900 | 15,16 | Run output rendering; raw YAML view |

### Wave 5 — samples, scripts, top-level docs

| # | Title | Paths | ~Lines | Depends | Review focus |
|--:|---|---|--:|---|---|
| 24 | sample fixtures + scripts | `sample-configs/`, `sample-data/`, `sample-output/`, `frontend/scripts/` | ~small | — | Runnable examples; no secrets |
| 25 | top-level docs & repo config | `CLAUDE.md`, `README.md`, `.gitattributes`, `.gitignore`, `plan.md`, `frontend/DESIGN.md`, `frontend/ABOUT.md`, `frontend/IMPROVEMENT_PLAN.md` | ~1,800 | — | Accuracy; consider whether the frontend design docs belong in-repo |

## Suggested merge order

Waves run in order. Within a wave, PRs are mostly independent and can be reviewed in parallel —
respect each row's `Depends on`. Waves 1, 4, and 5 are independent of each other and can overlap;
Wave 2 is self-contained; Wave 3 gates Wave 4.

**~25 PRs, median ~600 reviewable lines each** — every one fits in a single sitting.

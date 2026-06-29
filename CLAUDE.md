# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Three pieces, one repo:

- **`ingen/`** — the actual product: a CLI (`python -m ingen <config.yml>`) that does codeless data transforms/validations driven by a YAML config, built on pandas + great_expectations. This is the published PyPI package (`ingen-lib`).
- **`backend/`** — a thin FastAPI wrapper that shells out to `python -m ingen` and returns structured results. No business logic; it parses CLI output into JSON. For local/trusted dev only (it runs whatever the posted config says).
- **`frontend/`** — "InGen Studio", a Next.js 15 / React 19 SPA for building those YAML configs visually. Runs in `mock` mode (localStorage, simulated runs) or `http` mode (talks to `backend/`).

## Setup & common commands

Python (needs Python 3.9–3.12; **not 3.13+** — great_expectations needs numpy<2 which has no 3.13 wheels):

```bash
python -m venv .venv && .venv\Scripts\activate   # py 3.12
pip install -e .                   # ingen + runtime deps
pip install -r backend/requirements.txt
```

Run the CLI directly:
```bash
python -m ingen <config.yml> [run_date] --interfaces a,b --query_params k=v --override_params k=v --infile path
```

Run the backend (from repo root, so sample configs' relative paths resolve):
```bash
uvicorn backend.app.main:app --reload --port 8000
```

Frontend (in `frontend/`):
```bash
npm install
npm run dev      # next dev, http://localhost:3000
npm run lint     # eslint
npm run test     # node --test over src/**/*.test.js
```

Tests:
```bash
pytest test/                       # ingen library tests
pytest backend/tests/              # backend wrapper tests
pytest test/formatters/test_common_formatters.py::test_name   # single test
```

## ingen pipeline architecture

The whole library is one pipeline expressed as a **template method**. `BaseInterfaceGenerator.generate()` (`ingen/generators/base_interface_generator.py`) fixes the order; `InterfaceGenerator` supplies the steps:

```
read → validate(raw) → pre_process → format → post_process → validate(formatted) → notify → write
```

A "blocker" validation result on raw data short-circuits the rest. If the output `destination` has no `type`, the generated dataframe is returned as JSON instead of written.

Flow of control:
- `__main__.main()` builds a `MetaDataParser` (`ingen/metadata/metadata_parser.py`), which parses the YAML into a list of `Metadata` objects and a `run_config` (`ingen/utils/run_configuration.py`) that names which generator/writer/formatter classes to use.
- One `Metadata` = one interface. The config can define many; `--interfaces` filters which run.

Each pipeline stage is a pluggable package, dispatched by `type` strings from the YAML:
- **`data_source/`** — `SourceFactory.parse_source()` maps `type` → `FileSource`/`MYSQLSource`/`APISource`/`RawDataSource`/`JsonSource`. Readers live in `reader/`.
- **`pre_processor/`** — merge, union, filter, aggregate, melt, mask, drop_duplicates, outer_join, etc. Dispatched in `process.py`.
- **`formatters/`** — column-level transforms (`common_formatters.py`).
- **`post_processor/`** — runs after formatting (`common_post_processor.py`).
- **`validation/`** — great_expectations-backed checks (`common_validations.py`); can email on failure (`notification.py`, `send_email.py`).
- **`writer/`** — `dataframe_writer.py` for csv/excel; `json_writer/` uses a convertor factory for JSON shapes.

When adding a new source/pre-processor/formatter/etc., register it in the corresponding factory/dispatch table — that's the extension point, the pipeline itself doesn't change.

Config shape reference: `docs/config_reference.md`. Worked examples: `examples/`. Runnable samples: `sample-configs/` + `sample-data/`.

> **Note on great_expectations:** pinned `<1.0` deliberately — ingen uses the legacy `ge.from_pandas(...).expect_*` Dataset API removed in GE 1.0. Don't "upgrade" it. Same for `numpy<2` and `pandas<3` (see comments in `requirements.txt`/`setup.py`).

## backend wrapper

`backend/app/main.py` is HTTP routing only; logic is in pure modules: `schema_validate.py` (validate a config without running), `runner.py` (`execute_run` writes YAML to temp, runs ingen, returns a `RunRecord`), `store.py` (persists run history), `files.py` (sample data/config browsing). Env knobs: `INGEN_WORKDIR`, `INGEN_RUNS_DIR` (default `backend/.runs`), `INGEN_CORS_ORIGINS`.

The **inChat** assistant (`docs/chat_assistant.md`) lets users edit a pipeline in plain English. A small model returns `{reply, ops}` JSON — it never writes YAML; `ops` are applied deterministically client-side. `chat.py` loads a local HuggingFace model in-process (default `Qwen/Qwen3-4B`, override via `HF_CHAT_MODEL`) — no separate model server; weights download from HF Hub on first use. Needs `torch` + `transformers` (see `backend/requirements.txt`).

## frontend

File-based routing under `src/app/` (see `frontend/README.md` for the route map). Adapter mode is set by `NEXT_PUBLIC_ADAPTER_MODE` (`mock`/`http`); the `src/adapters/` layer swaps localStorage mocks for real backend calls behind the `src/services/` interface. `src/serializers/` converts between the in-memory config model (`src/models/`) and ingen YAML; `src/forms/schemas/` drive the editor forms per stage type. `@/*` import alias → `src/*`.

> The repo is mid-migration from Vite to Next.js — `package.json`/`README` are the source of truth (Next 15). Ignore stray Vite-era files if you see them in git status.

## Conventions

- Contributions require a DCO sign-off: commit with `git commit -s`.

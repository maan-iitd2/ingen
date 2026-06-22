# InGen

InGen is a three-tier data transformation and validation platform:

- **`ingen/`** — the core CLI (`python -m ingen <config.yml>`) that performs codeless data transforms/validations driven by YAML config, built on pandas + great_expectations. Published as PyPI package `ingen-lib`.
- **`backend/`** — thin FastAPI wrapper that shells out to the CLI and returns structured JSON results (local/trusted dev only).
- **`frontend/`** — "InGen Studio", a Next.js 15 / React 19 SPA for visually building YAML configs. Runs in mock mode (localStorage, simulated runs) or http mode (connects to backend).

## Quick Start

### Prerequisites
- Python 3.9–3.12 (not 3.13+; great_expectations requires numpy<2)
- Node.js 18+ (for frontend)

### Setup

**1. Python environment & CLI:**
```bash
./setup.ps1                        # Creates .venv (Python 3.12), installs packages
# or manually:
python -m venv .venv
.venv\Scripts\activate
pip install -e .                   # Install ingen + runtime deps
pip install -r backend/requirements.txt
```

**2. Run CLI directly:**
```bash
python -m ingen sample-configs/customer_pipeline.yaml
```

**3. Run backend (from repo root, so relative paths resolve):**
```bash
./start_backend.ps1                # uvicorn backend.app.main:app --reload --port 8000
```

**4. Run frontend (in `frontend/` directory):**
```bash
npm install
npm run dev                        # http://localhost:3000
```

When frontend starts, set `NEXT_PUBLIC_ADAPTER_MODE` to `http` in `.env` to connect to backend.

## Architecture

### Pipeline Flow
```
read → validate(raw) → pre_process → format → post_process → validate(formatted) → notify → write
```

Each stage is pluggable and dispatched by `type` strings in YAML:
- **data_source/** — file/database/API readers
- **pre_processor/** — merge, union, filter, aggregate, melt, etc.
- **formatters/** — column-level transforms
- **validation/** — great_expectations checks
- **writer/** — CSV, Excel, JSON outputs

### Backend
- `backend/app/main.py` — HTTP routing only
- `backend/app/runner.py` — executes CLI, returns run records
- `backend/app/schema_validate.py` — validates config without running

### Frontend
- File-based routing: `src/app/`
- Adapter pattern: `src/adapters/` switches between HTTP (backend) and mock (localStorage)
- Models: `src/models/` — in-memory config representation
- Serializers: `src/serializers/` — convert between app config and YAML

## Configuration

Config shape reference: [docs/config_reference.md](./docs/config_reference.md)

Examples of pipeline use cases:
- [Merge two CSV files](./examples/merge_two_csvs.md)
- [Extract data from database](./examples/extract_data_from_database.md)
- [Convert XML to CSV/Excel](./examples/xml_to_csv.md)

Sample configs to run: `sample-configs/`
Sample data for testing: `sample-data/`

## Testing

```bash
pytest test/                       # Core library tests
pytest backend/tests/              # Backend wrapper tests
pytest test/formatters/test_common_formatters.py::test_name   # Single test
cd frontend && npm run test        # Frontend tests
```

## Notes

- **great_expectations version:** pinned <1.0 (uses legacy Dataset API removed in GE 1.0)
- **numpy:** pinned <2 (for Python 3.12 compatibility; 3.13+ not supported)
- **DCO sign-off required:** `git commit -s`

## Contributing

All contributions are welcome. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License
[LICENSE](./LICENSE)

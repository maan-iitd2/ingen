"""
InGen Studio — FastAPI execution backend.

The frontend authors YAML independently via its own serializer. This service is the sole
backend boundary: it accepts a YAML payload, runs `python -m ingen`, and returns a
structured RunRecord that the frontend console can render.

Start with:
    uvicorn ingen.api.main:app --reload --port 8000

Endpoints:
    POST /api/runs             — run a YAML config, return RunRecord
    POST /api/configs/validate — parse & schema-check a YAML string
    GET  /api/runs/history     — list past runs (optional ?config_id=)
    GET  /api/runs/{run_id}    — fetch a single run record
    GET  /api/health           — liveness probe
"""

import json
import logging
import subprocess
import sys
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

log = logging.getLogger("ingen.api")

app = FastAPI(title="InGen Studio API", version="1.0.0")

# Allow the Vite dev server (and any localhost origin) to call this service.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory run history (per process). Replace with a DB or JSON file for persistence.
_run_store: dict[str, dict] = {}


# ── Request / response shapes ─────────────────────────────────────────────────

class RunRequest(BaseModel):
    yaml: str
    configId: Optional[str] = None
    configName: Optional[str] = None
    run_date: Optional[str] = None          # YYYY-MM-DD
    interfaces: Optional[list[str]] = None  # subset of interfaces to run
    query_params: Optional[dict[str, str]] = None
    override_params: Optional[dict[str, str]] = None


class ValidateRequest(BaseModel):
    yaml: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_ingen_cmd(config_path: str, req: RunRequest) -> list[str]:
    """Assemble the `python -m ingen` command from the run request."""
    cmd = [sys.executable, "-m", "ingen", config_path]

    if req.run_date:
        cmd.append(req.run_date)

    if req.interfaces:
        cmd += ["--interfaces", ",".join(req.interfaces)]

    if req.query_params:
        pairs = [f"{k}={v}" for k, v in req.query_params.items()]
        cmd += ["--query_params"] + pairs

    if req.override_params:
        pairs = [f"{k}={v}" for k, v in req.override_params.items()]
        cmd += ["--override_params"] + pairs

    return cmd


def _parse_output(stdout: str, stderr: str, exit_code: int, started: float) -> dict[str, Any]:
    """Convert raw ingen stdout/stderr into log entries and stage events."""
    logs = []
    stages = []
    finished = time.time()

    def _ts():
        return datetime.now(timezone.utc).isoformat()

    for line in (stdout + "\n" + stderr).splitlines():
        line = line.strip()
        if not line:
            continue
        level = "info"
        if "ERROR" in line or "error" in line.lower():
            level = "error"
        elif "WARNING" in line or "WARNING" in line:
            level = "warn"
        logs.append({"type": "log", "ts": _ts(), "level": level, "message": line})

        # Detect stage markers emitted by ingen's logger ("Generating interface X", "Writing…")
        lower = line.lower()
        for stage_name in ("read", "pre_process", "format", "validate", "write", "post_process"):
            if stage_name in lower or stage_name.replace("_", " ") in lower:
                status = "failed" if level == "error" else "ok"
                stages.append({"stage": stage_name, "status": status})
                break

    overall = "failed" if exit_code != 0 else "passed"
    duration_ms = int((finished - started) * 1000)

    return {
        "logs": logs,
        "stages": stages,
        "status": overall,
        "durationMs": duration_ms,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/runs")
def run_config(req: RunRequest):
    """
    Serialize the provided YAML to a temp file, execute python -m ingen, and return a
    RunRecord that the frontend console can render identically to the mock adapter output.
    """
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    started_iso = _now_iso()
    started_ts = time.time()

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".yml", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(req.yaml)
        config_path = tmp.name

    try:
        cmd = _build_ingen_cmd(config_path, req)
        log.info("Executing: %s", " ".join(cmd))

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5-minute hard limit per run
        )

        parsed = _parse_output(result.stdout, result.stderr, result.returncode, started_ts)

    except subprocess.TimeoutExpired:
        parsed = {
            "logs": [{"type": "log", "ts": _now_iso(), "level": "error", "message": "Run timed out after 5 minutes."}],
            "stages": [],
            "status": "failed",
            "durationMs": 300_000,
        }
    except Exception as exc:
        parsed = {
            "logs": [{"type": "log", "ts": _now_iso(), "level": "error", "message": str(exc)}],
            "stages": [],
            "status": "failed",
            "durationMs": int((time.time() - started_ts) * 1000),
        }
    finally:
        Path(config_path).unlink(missing_ok=True)

    record = {
        "runId": run_id,
        "configId": req.configId or "unknown",
        "configName": req.configName or "unknown",
        "status": parsed["status"],
        "startedAt": started_iso,
        "finishedAt": _now_iso(),
        "durationMs": parsed["durationMs"],
        "stages": parsed["stages"],
        "logs": parsed["logs"],
        "validation": {
            "results": [],
            "summary": {"passed": 0, "failed": 0, "warning": 0, "total": 0},
        },
        "overrides": {
            "run_date": req.run_date,
            "interfaces": req.interfaces,
            "query_params": req.query_params,
            "override_params": req.override_params,
        },
    }

    _run_store[run_id] = record
    return record


@app.post("/api/configs/validate")
def validate_config(req: ValidateRequest):
    """
    Parse and basic-validate a YAML string without executing it.
    Returns a list of { field, message } issue objects.
    """
    issues = []
    try:
        config = yaml.safe_load(req.yaml)
    except yaml.YAMLError as exc:
        return {"issues": [{"field": "yaml", "message": f"YAML parse error: {exc}"}]}

    if not isinstance(config, dict):
        issues.append({"field": "root", "message": "Config must be a YAML mapping."})
        return {"issues": issues}

    if "sources" not in config:
        issues.append({"field": "sources", "message": "Top-level 'sources' list is required."})
    elif not isinstance(config["sources"], list):
        issues.append({"field": "sources", "message": "'sources' must be a list."})
    else:
        for i, src in enumerate(config["sources"]):
            if not isinstance(src, dict) or "id" not in src:
                issues.append({"field": f"sources[{i}]", "message": "Each source must have an 'id' key."})
            if not isinstance(src, dict) or "type" not in src:
                issues.append({"field": f"sources[{i}]", "message": "Each source must have a 'type' key."})

    if "interfaces" not in config:
        issues.append({"field": "interfaces", "message": "Top-level 'interfaces' mapping is required."})
    elif not isinstance(config["interfaces"], dict):
        issues.append({"field": "interfaces", "message": "'interfaces' must be a mapping (object)."})
    else:
        for iface_name, iface in config["interfaces"].items():
            if not isinstance(iface, dict):
                issues.append({"field": f"interfaces.{iface_name}", "message": "Interface must be a mapping."})
                continue
            if "columns" not in iface:
                issues.append({"field": f"interfaces.{iface_name}.columns", "message": "'columns' is required."})
            if "output" not in iface:
                issues.append({"field": f"interfaces.{iface_name}.output", "message": "'output' is required."})

    return {"issues": issues}


@app.get("/api/runs/history")
def list_history(config_id: Optional[str] = None):
    """Return all run records, newest first. Filter by config_id if provided."""
    records = list(_run_store.values())
    if config_id:
        records = [r for r in records if r.get("configId") == config_id]
    records.sort(key=lambda r: r.get("startedAt", ""), reverse=True)
    return records


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    record = _run_store.get(run_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return record

#  InGen wrapper — inChat intent extraction via a local Ollama model (pure logic).
#
#  The model NEVER writes YAML. It returns a small, schema-constrained LIST of "edit ops" which the
#  frontend applies through its existing model mutators (then the real serializer renders YAML).
#  A 4B local model (gemma3:4b) is plenty for this classify-and-extract job; it is not for authoring
#  YAML. One message can produce several ops ("add columns A, B, C and drop status=inactive").

import json
import os

import httpx

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/chat")
MODEL = os.environ.get("INGEN_CHAT_MODEL", "gemma3:4b")  # fallback: mistral:latest

OPS = {"add_columns", "rename_column", "add_source", "add_filter", "set_output", "none"}

# Constrained output — Ollama enforces this JSON shape (the `format` field), so we get a parseable
# {"ops": [...]} every time instead of free-form prose.
INTENT_SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "ops": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "op": {"type": "string", "enum": sorted(OPS)},
                    "cols": {"type": "array", "items": {"type": "string"}},
                    "from": {"type": "string"},
                    "to": {"type": "string"},
                    "name": {"type": "string"},
                    "type": {"type": "string"},
                    "col": {"type": "string"},
                    "val": {"type": "string"},
                },
                "required": ["op"],
            },
        }
    },
    "required": ["ops", "reply"],
}

SYSTEM = """You are inChat, a friendly assistant for building data pipelines in InGen Studio.
Always respond with JSON only: {"reply": "...", "ops": [ ... ]}. You have two jobs:

1. EDITS — if the user asks to change the pipeline, fill `ops` with the edits (in order). Each op:
   - add_columns: cols=[column names to add]
   - rename_column: from=current name, to=new name
   - add_source: name=identifier, type=one of file|mysql|api|rawdatastore|json
   - add_filter: col=column to filter on, val=value to drop (EXACT column from the provided list)
   - set_output: type=one of delimited_file|excel|json|json_writer|rawdatastore
   Only use column names from the provided list. One request can map to several ops.

2. CONVERSATION — if the user is greeting, asking a question, or saying something that is NOT an
   edit, set "ops": [] and put a genuinely helpful answer in `reply` (explain pipelines, suggest
   what they can do, answer the question).

EDIT THE EXISTING PIPELINE. The user message includes the current pipeline as YAML (for reference
only — never rewrite it; only emit ops that modify it). "the current config", "make changes", "add
to it" mean modify the pipeline shown — NEVER start from scratch. If it already has sources/columns,
build on them.

ASK BEFORE ACTING when a request can't be fully expressed with the ops above. Set "ops": [] and ask
ONE short clarifying question in `reply`. In particular: an interface writes exactly ONE output
destination — you cannot create "two output files". To split one output into many files by a column,
that is a `splitted_file` writer; if the user asks for multiple files, ask whether they want a single
file or a splitted_file before changing anything.

The `reply` is shown directly to the user. Talk to THEM about their pipeline in plain English.
NEVER mention JSON, ops, schemas, or that you are "formatting a request". Keep it to 1-2 sentences."""


def interpret(message: str, columns: list[str], yaml: str = "", interface: str = "") -> dict:
    """Ask the local model for a short reply + an ordered list of edit ops. Whitespace-only messages
    (used by the UI to pre-warm the model) short-circuit. Raises on connection/model errors so the
    caller (and ultimately the UI) can fall back to its built-in command parser.

    `yaml` is the current pipeline (reference context so the model edits what exists instead of
    starting fresh); `interface` names the active interface. Returns {"reply": str, "ops": [...]}.
    The model authors the conversational `reply`; `ops` are the machine-readable edits the frontend
    applies deterministically (the model never writes YAML)."""
    if not message or not message.strip():
        return {"reply": "", "ops": []}  # warm-up ping: load the model without running prompt logic

    parts = []
    if interface:
        parts.append(f"Active interface: {interface}")
    if yaml and yaml.strip():
        parts.append(
            "Current pipeline YAML (reference only — DO NOT rewrite it; emit ops that modify it):\n"
            + yaml.strip()
        )
    parts.append(f"Known columns: {columns}")
    parts.append(f"Request: {message}")
    user = "\n\n".join(parts)
    payload = {
        "model": MODEL,
        "stream": False,
        "format": INTENT_SCHEMA,
        "keep_alive": "30m",  # keep the model resident between messages (default unload is 5m)
        # gemma3's base prompt is ~3.5k tokens, so the default 4096 context overflows once we add the
        # full YAML — the model then has no room to finish the JSON ("length" stop). 64k effectively
        # never overflows (gemma3 supports 128k); num_predict caps the reply; temperature 0 = stable.
        # ponytail: 64k KV cache costs extra RAM/VRAM; drop to 8192 if the box is memory-constrained.
        "options": {"num_ctx": 65536, "num_predict": 512, "temperature": 0},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
    }
    resp = httpx.post(OLLAMA_URL, json=payload, timeout=120)
    resp.raise_for_status()
    content = resp.json()["message"]["content"]
    parsed = json.loads(content) if content.strip() else {}
    if not isinstance(parsed, dict):
        parsed = {}
    ops = parsed.get("ops", [])
    return {
        "reply": str(parsed.get("reply", "")),
        # Drop anything the model invented that isn't a known op — the frontend only trusts these.
        "ops": [o for o in ops if isinstance(o, dict) and o.get("op") in OPS],
    }


def warmup() -> None:
    """Load the model into RAM (and pin it for 30m) so the first real message is fast. Best-effort:
    swallows errors — if Ollama is down the UI just falls back to its regex parser."""
    try:
        httpx.post(
            OLLAMA_URL,
            json={"model": MODEL, "stream": False, "keep_alive": "30m",
                  "messages": [{"role": "user", "content": "hi"}]},
            timeout=120,
        )
    except Exception:
        pass

# inChat — the gemma3:4b pipeline assistant

InGen Studio's chat ("inChat") lets you edit a pipeline in plain English. A small local model
(`gemma3:4b`, served by [Ollama]) does **one narrow job**: read your request + the list of known
columns, and return **two things** as JSON:

```json
{ "reply": "Adding three columns for you.", "ops": [ { "op": "add_columns", "cols": ["C1","C2","C3"] } ] }
```

- **`reply`** — one short, friendly sentence. Shown to you in the chat bubble. Conversation only.
- **`ops`** — a machine-readable list of edit operations. **This is the part that changes your config.**

### Two modes, one model (no separate agents)

The same `gemma3:4b` call covers both an "executor" and a "general queries" assistant — dispatched by
whether `ops` is empty, not by a second model or an orchestrator:

- **Edit mode** — the request maps to changes → `ops` is filled, applied deterministically.
- **Conversation mode** — a greeting or question ("hi", "what does this pipeline do?") → `ops: []`
  and `reply` carries the answer. The frontend shows the model's `reply` whenever an edit applied
  *or* there were no ops; it only falls back to the canned message when an edit was attempted but
  nothing changed (dedupe / unknown column) or the backend is down.

A true multi-agent setup (separate executor + router models) is overkill here — a 4B model handles
both jobs in a single round-trip.

## The model never writes YAML

This is the whole design. A 4B model is great at *classify-and-extract* ("which op, which columns")
and bad at authoring a strict YAML schema. So it never touches YAML. Instead:

1. The model emits `ops` (constrained to a fixed JSON schema — Ollama's `format` field enforces the
   shape, so we always get parseable JSON, never prose).
2. The frontend's **rule-based applier** (`frontend/src/models/applyIntent.js`) maps each op onto the
   existing pure model mutators. `add_columns C1 C2 C3` → `listAdd('columns', ...)` for each, with
   dedupe and validation.
3. The existing **serializer** renders the YAML from the mutated model.

So the LLM picks the *intent*; deterministic Python/JS does the *construction*. If the model
hallucinates an unknown op or column, the applier drops/corrects it — the YAML can't be corrupted by
a bad model response.

## Supported ops

| op | args | effect |
|----|------|--------|
| `add_columns`   | `cols: [str]`        | add each column (deduped against existing) |
| `rename_column` | `from`, `to`         | rename, or add a src→dest mapping |
| `add_source`    | `name`, `type`       | type ∈ file, mysql, api, rawdatastore, json |
| `add_filter`    | `col`, `val`         | drop rows where `col == val` (col must be a known column) |
| `set_output`    | `type`               | type ∈ delimited_file, excel, json, json_writer, rawdatastore |
| `none`          | —                    | nothing matched |

One message can produce several ops, applied in order ("add columns A,B and drop status=inactive").

## Where the pieces live

| concern | file |
|---|---|
| model call + intent schema + system prompt | `backend/app/chat.py` |
| HTTP routes (`/api/chat`, `/api/chat/warmup`) | `backend/app/main.py` |
| frontend client | `frontend/src/services/chatService.js` |
| op → model mutation (rule-based build) | `frontend/src/models/applyIntent.js` |
| regex fallback (used when backend/Ollama is down) | `InterfaceChatEditor.jsx` |

## Running it

The chat needs **two** servers up (Ollama itself is enough for the LLM; the FastAPI backend bridges
the browser to it):

1. **Ollama server** — runs in the background via the Ollama desktop app, or `ollama serve`.
   Check: `curl http://localhost:11434/api/tags` should list `gemma3:4b`.
   > You do **not** need `ollama run gemma3:4b` — that just opens an interactive REPL in your
   > terminal. The server is what matters, and the desktop app already runs it.
2. **InGen backend** — `./start_backend.ps1` (port 8000). If this is down, chat silently falls back
   to the regex parser (only a few exact patterns like `add columns ...` work).

First message is slow (model load). The UI fires `/api/chat/warmup` when the chat opens, and the
model is pinned in RAM for 30m (`keep_alive`), so subsequent messages are fast.

### Config knobs (env)

| var | default | meaning |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434/api/chat` | Ollama chat endpoint |
| `INGEN_CHAT_MODEL` | `gemma3:4b` | model name (fallback: `mistral:latest`) |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | backend base URL (frontend) |

[Ollama]: https://ollama.com

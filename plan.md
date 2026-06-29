# Review-Remediation Implementation Plan

> **For agentic workers:** Each task below is sized to be done in **its own fresh chat** (the context
> window won't survive all of them in one session). Tasks are **independent** — do them in any order,
> one per chat. Each task is self-contained: it names the files, the exact change, how to verify, and
> how to commit. Steps use checkbox (`- [ ]`) syntax. **Do not batch multiple tasks into one chat.**

**Goal:** Fix the concrete defects found in the post-`ingen` code review (the backend wrapper + the
InGen Studio frontend) — without rewriting anything that already works.

**Architecture:** Surgical edits. The biggest one (Task 1) realigns three places that disagree about
the inChat op vocabulary; the rest are 1–20 line fixes to security caps, drift, and cosmetic lies.

**Tech Stack:** FastAPI + pandas + `python -m ingen` (backend), Next 15 / React 19 (frontend),
`unittest`/pytest (backend tests), `node --test` (frontend tests), js-yaml.

## Global Constraints (apply to EVERY task)

- **Use the project venv (Python 3.12), not global Python.** Global `python` is 3.14 and has **no
  deps installed**; ingen needs 3.9–3.12. Always invoke `.venv\Scripts\python.exe` (Git Bash:
  `.venv/Scripts/python.exe`). Run backend things **from the repo root** so sample paths resolve.
- **Backend tests:** `.venv/Scripts/python.exe -m pytest backend/tests/ -q`
- **Frontend tests:** in `frontend/`, `npm run test` (runs `node --test` over `src/**/*.test.js`).
- **Commit with DCO sign-off:** `git commit -s -m "..."` (repo requires it). End the commit body with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` only if you want attribution; the `-s` is
  mandatory.
- **Ground rule:** the committed backend behavior is the source of truth — don't "fix" ingen itself.
- **Stay lazy (ponytail):** ship the smallest change that holds. Don't add abstractions, don't
  restructure neighboring code, don't expand scope beyond the task.
- **Branch:** work is on `feature/frontend-ui`. Stay on it unless told otherwise.

---

## Task 1 — Align the inChat op vocabulary (the headline bug)

**Context for a cold start:** inChat lets users edit a pipeline in English. Two things turn English
into "ops": (a) a local LLM in `backend/app/chat.py`, and (b) a regex fallback `regexOps()` in
`frontend/src/components/editor/chat/InterfaceChatEditor.jsx` (used when the model is down). Both feed
`frontend/src/models/applyIntent.js`, whose `switch (op?.op)` is the **real authority** on what ops
actually do something. Today `chat.py` only whitelists/documents 5 ops, while `applyIntent.js`
implements 11. Result: when the LLM is up, "remove column X", "remove source Y", "add transform
merge", "remove transform", and "explain" silently no-op; when the LLM is down, they work. The
assistant gets *less* capable when the expensive model loads. We fix by making `chat.py` cover the
full vocabulary and relaxing its prompt. `applyIntent.js` is already correct.

**Canonical op set** (what `applyIntent.js` implements — this is the contract):
`add_columns, remove_column, rename_column, add_source, remove_source, add_transform,
remove_transform, add_filter, set_output, explain, none`

**Files:**
- Modify: `backend/app/chat.py` (the `OPS` set, the `SYSTEM_PROMPT`, and extract a testable filter)
- Create: `backend/tests/test_chat.py`
- Modify (small): `frontend/src/components/editor/chat/InterfaceChatEditor.jsx` (one regex line + a comment)

**Interfaces produced:** `chat._filter_ops(ops: list) -> list` (pure; keeps only dict ops whose
`"op"` is in `OPS`). `chat.OPS` equals the canonical set above.

- [ ] **Step 1 — Replace the `OPS` set in `backend/app/chat.py`.** Find `OPS = {...}` (near line 28) and replace with:

```python
# The ops the executor (frontend/src/models/applyIntent.js `switch (op?.op)`) actually implements.
# THAT FILE IS THE AUTHORITY — if you add/remove a case there, mirror it here and in the prompt below.
OPS = {
    "add_columns", "remove_column", "rename_column",
    "add_source", "remove_source",
    "add_transform", "remove_transform",
    "add_filter", "set_output", "explain", "none",
}
```

- [ ] **Step 2 — Relax + complete the `SYSTEM_PROMPT`.** Replace the whole `SYSTEM_PROMPT = (...)`
  block. The old prompt forbade anything but bare JSON; `_extract_json()` already strips code fences,
  `<think>` blocks, and surrounding prose, so the rigidity is unnecessary and was starving the model.
  New prompt documents every op and loosens the tone:

```python
SYSTEM_PROMPT = (
    "You are inChat, a friendly assistant for building data pipelines in InGen Studio. "
    "You help by emitting small edit operations that the app applies to the pipeline — "
    "you never write or rewrite YAML yourself.\n\n"
    'Respond with a single JSON object: {"reply": "<1-2 sentence reply>", '
    '"ops": [<ops in order, or empty>]}. Plain JSON is best, but if you wrap it in a ```json fence '
    "or add a short note around it, that's fine — it will be parsed out.\n\n"
    "Available ops:\n"
    '  {"op": "add_columns", "cols": ["c1", "c2"]}                 - add output columns\n'
    '  {"op": "remove_column", "name": "col"}                       - drop an output column\n'
    '  {"op": "rename_column", "from": "old", "to": "new"}          - rename a column\n'
    '  {"op": "add_source", "name": "id", "type": "file|mysql|api|json"}  - add a data source\n'
    '  {"op": "remove_source", "name": "id"}                        - remove a source everywhere\n'
    '  {"op": "add_transform", "type": "merge|outer_join|mask|not_equals_filter|union|melt|'
    'aggregate|drop_duplicates|json_array_expander"}  - add a pre-processing step\n'
    '  {"op": "remove_transform", "type": "<transform type>"}       - remove a pre-processing step '
    '(or pass {"index": N})\n'
    '  {"op": "add_filter", "col": "column", "val": "value_to_drop"}  - drop rows where column == value\n'
    '  {"op": "set_output", "type": "delimited_file|excel|json|json_writer"}  - set the output format\n'
    '  {"op": "explain"}                                             - describe the current pipeline\n\n'
    "Guidelines:\n"
    "- Prefer column names from the provided known-columns list; if unsure, still emit the op and "
    "the app will guide the user.\n"
    "- A greeting or a question that is not an edit -> ops=[] and a helpful reply.\n"
    "- One request may need several ops; emit them in order."
)
```

- [ ] **Step 3 — Extract a testable filter.** Add this pure helper (put it just above `interpret`):

```python
def _filter_ops(ops) -> list:
    """Keep only well-formed ops whose name the executor implements. Pure + model-free (testable)."""
    if not isinstance(ops, list):
        return []
    return [o for o in ops if isinstance(o, dict) and o.get("op") in OPS]
```

  Then in `interpret()`, replace the inline list comprehension in the final `return` with it:

```python
    return {
        "reply": str(parsed.get("reply", "")),
        "ops": _filter_ops(parsed.get("ops")),
    }
```

- [ ] **Step 4 — Write the test.** Create `backend/tests/test_chat.py`:

```python
#  Tests for backend/app/chat.py — the model-free pieces (op vocabulary + filter).
#  We do NOT load the HF model here; we pin the contract that guards against the vocabulary drift
#  the code review flagged (LLM vocabulary must equal what frontend/src/models/applyIntent.js runs).

import unittest

from backend.app.chat import _filter_ops, OPS


class FilterOps(unittest.TestCase):
    def test_keeps_supported_ops(self):
        ops = [{"op": "remove_source", "name": "s"}, {"op": "explain"}]
        self.assertEqual(_filter_ops(ops), ops)

    def test_drops_unknown_and_malformed(self):
        self.assertEqual(_filter_ops([{"op": "nope"}, "x", 3, {}]), [])

    def test_non_list_is_empty(self):
        self.assertEqual(_filter_ops(None), [])

    def test_vocabulary_matches_executor(self):
        # If this fails, chat.py and applyIntent.js have drifted again. Re-sync them.
        self.assertEqual(OPS, {
            "add_columns", "remove_column", "rename_column",
            "add_source", "remove_source",
            "add_transform", "remove_transform",
            "add_filter", "set_output", "explain", "none",
        })


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 5 — Run the backend test.** `Expected: PASS`
```
.venv/Scripts/python.exe -m pytest backend/tests/test_chat.py -q
```

- [ ] **Step 6 — Frontend parity (small).** In `InterfaceChatEditor.jsx`, `regexOps()` already emits
  most ops but not `remove_transform`. Add one line next to the existing `add transform` line (~line 38):

```javascript
  if ((m = t.match(/^remove\s+transform\s+(\w+)/i))) return [{ op: 'remove_transform', type: m[1].toLowerCase() }];
```
  And add a one-line comment above `regexOps` noting `applyIntent.js` is the op authority.

- [ ] **Step 7 — Confirm the executor already covers everything (no code change expected).** Run the
  frontend tests; `applyIntent.test.js` + `applyIntent.phase5.test.js` exercise the ops. `Expected: PASS`
```
cd frontend && npm run test
```

- [ ] **Step 8 — Commit.**
```bash
git add backend/app/chat.py backend/tests/test_chat.py frontend/src/components/editor/chat/InterfaceChatEditor.jsx
git commit -s -m "fix(inchat): align LLM op vocabulary with the executor (applyIntent)"
```

**Done when:** `chat.OPS` == the canonical set, the prompt documents all 11 ops, `_filter_ops` is
unit-tested, and both backend + frontend test suites pass.

---

## Task 2 — Stop `schema_validate.py` from mirroring ingen's source-type list

**Context for a cold start:** `backend/app/schema_validate.py` does lightweight structural validation
of a config without running it (used by `POST /api/configs/validate`). Its one volatile, drift-prone
piece is a hardcoded `_VALID_SOURCE_TYPES = {"file","mysql","api","json"}`. ingen's actual authority is
the `DataSourceType` enum in `ingen/data_source/data_source_type.py` (used by `SourceFactory`) — and it
includes more (e.g. `rawdata`), so the hardcoded set is *already* wrong. Fix: derive the set from the
enum. Keep the rest of the validator (the structural checks for missing ids / undefined source refs are
generic and stable — not worth deleting). We are explicitly **not** rerouting validation through
`MetaDataParser`; that's more code and worse error messages for no real gain here.

**Files:**
- Modify: `backend/app/schema_validate.py` (replace the hardcoded set with an enum-derived one)
- Modify if needed: `backend/tests/test_schema_validate.py` (only if a test asserted a now-valid type is invalid)

- [ ] **Step 1 — Confirm the enum values first.** Run:
```
.venv/Scripts/python.exe -c "from ingen.data_source.data_source_type import DataSourceType; print(sorted(e.value for e in DataSourceType))"
```
  Note the printed set (expect `file, mysql, api, rawdata, json` or similar). This is now the source of truth.

- [ ] **Step 2 — Replace the hardcoded set.** In `schema_validate.py`, delete
  `_VALID_SOURCE_TYPES = {"file", "mysql", "api", "json"}` and add at the top (after `import yaml`):

```python
from ingen.data_source.data_source_type import DataSourceType

# Source of truth: ingen's own enum. Adding a source type to ingen makes this validator accept it
# automatically — no parallel list to keep in sync. (Killed the drift the code review flagged.)
_VALID_SOURCE_TYPES = {e.value for e in DataSourceType}
```

- [ ] **Step 3 — Run the existing test.** `Expected: PASS` (adjust only if a test used a type that is
  now valid, e.g. it asserted `rawdata` is `UNKNOWN_SOURCE_TYPE`). Pick a genuinely invalid type like
  `"bogus"` for the negative case.
```
.venv/Scripts/python.exe -m pytest backend/tests/test_schema_validate.py -q
```

- [ ] **Step 4 — Commit.**
```bash
git add backend/app/schema_validate.py backend/tests/test_schema_validate.py
git commit -s -m "fix(backend): derive valid source types from ingen's enum, not a hardcoded copy"
```

**Done when:** `_VALID_SOURCE_TYPES` is derived from `DataSourceType`, and `test_schema_validate.py`
passes. (The frontend's `SOURCE_TYPES` in `applyIntent.js` is intentionally left as-is — a separate
language; a build-time codegen to dedupe across Python+JS is not worth it. Leave a comment there
pointing at the backend as authority if you like.)

---

## Task 3 — Add the two missing security caps (upload size/type + columns read cap)

**Context for a cold start:** The backend is "trusted dev only," but two foot-guns are cheap to close
and the code even admits them. (1) `backend/app/files.py` `save_and_parse()` reads an entire upload
into memory and writes it with no size limit and no extension allowlist — a huge or junk file OOMs or
pollutes `Data/`. (2) `backend/app/columns.py` `source_columns()` calls `src.fetch()`, which reads the
WHOLE source just to return the header — its own comment flags this. We cap both with minimal code.

**Files:**
- Modify: `backend/app/files.py` (size + extension guard)
- Modify: `backend/app/main.py` (map the new `ValueError` to a 400 on the upload route)
- Modify: `backend/app/columns.py` (header-only read for file sources)
- Modify: `backend/tests/test_columns.py` (still passes; add a cap assertion if easy)

- [ ] **Step 1 — Guard the upload in `files.py`.** Add constants near the top (after `PREVIEW_ROWS`):

```python
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB — trusted-dev guard against accidental OOM
ALLOWED_SUFFIXES = {".csv", ".tsv", ".txt", ".xlsx", ".xls", ".json"}
```

  In `save_and_parse()`, add these checks as the FIRST lines of the function body (before any mkdir/write):

```python
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError(f"File too large ({len(content)} bytes; max {MAX_UPLOAD_BYTES}).")
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise ValueError(f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_SUFFIXES))}.")
```

  (The `if __name__ == "__main__"` self-check at the bottom uses `.csv` and tiny bytes, so it still passes.)

- [ ] **Step 2 — Map the error in `main.py`.** The `upload_file` route currently calls
  `save_and_parse` with no error handling. Wrap it:

```python
@app.post("/api/files/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    try:
        return save_and_parse(file.filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
```

- [ ] **Step 3 — Cap the read in `columns.py`.** Replace the body of `source_columns()` so file
  sources read only a header (reusing `files._parse`, which already does a capped pandas read), and
  non-file sources keep ingen's reader. Add `from pathlib import Path` at the top.

```python
PREVIEW_ROWS = 5  # we only need the header; never read the whole source for "show columns"


def source_columns(source: dict, run_date=None) -> dict:
    """Column names for one source dict (same shape the frontend serializes). Returns {"columns": [...]}.
    Raises on read failure — the route maps that to a 4xx with the message."""
    if not isinstance(source, dict) or not source.get("type"):
        raise ValueError("source must be an object with a 'type'")

    # File sources: read only the first few rows for the header — never the whole file.
    if source.get("type") == "file" and source.get("file_path"):
        from .files import _parse
        cols, _preview = _parse(Path(source["file_path"]), n=PREVIEW_ROWS)
        return {"columns": cols}

    # Non-file (mysql/api/json): fall back to ingen's reader.
    # ponytail: we don't rewrite user SQL to inject LIMIT — a row cap belongs in the source config;
    #           tighten here if a live DB/API read ever bites.
    params_map = {"run_date": run_date} if run_date else None
    src = SourceFactory().parse_source(source, params_map)
    df = src.fetch()
    return {"columns": [str(c) for c in df.columns]}
```

  Note: this means file sources are parsed by pandas' delimiter sniffer (same as the upload preview),
  not ingen's configured delimiter/`skip_header_size`. Acceptable for a header peek; the ponytail
  comment marks the ceiling.

- [ ] **Step 4 — Verify.** `Expected: PASS` (the file-source test still returns `["id","name","amount"]`).
```
.venv/Scripts/python.exe -m pytest backend/tests/test_columns.py -q
.venv/Scripts/python.exe backend/app/files.py    # runs the self-check, prints "files.py self-check ok"
.venv/Scripts/python.exe backend/app/columns.py   # prints "columns.py self-check ok"
```

- [ ] **Step 5 — Commit.**
```bash
git add backend/app/files.py backend/app/main.py backend/app/columns.py backend/tests/test_columns.py
git commit -s -m "fix(backend): cap upload size/type and read only headers for source columns"
```

**Done when:** oversized/unknown-extension uploads raise a 400 with a clear message, file-source column
reads no longer pull the whole file, and `test_columns.py` + both self-checks pass.

---

## Task 4 — Collapse the `yamlSerializer` emitter registry into a plain loop

**Context for a cold start:** `frontend/src/serializers/yamlSerializer.js` builds an interface's YAML
body via `INTERFACE_SECTIONS` — an array of `{ key, emit }` objects where every `emit` is just
`(i) => i.key`. That's a registry pattern (with a "add one entry later" justification) wrapping what is
really an ordered key list + a loop. Replace it. Output must stay byte-identical — the existing tests
pin key order and the empty-section dropping.

**Files:**
- Modify: `frontend/src/serializers/yamlSerializer.js`
- Tests already exist: `frontend/src/serializers/yamlSerializer.test.js` (do not change them)

- [ ] **Step 1 — Replace the registry + builder.** Delete the `INTERFACE_SECTIONS` array and the
  `interfaceToObject` function, and replace both with:

```javascript
// Order of sections in an emitted interface body (matches DESIGN.md). Empty sections are dropped.
const INTERFACE_SECTION_ORDER = [
  'sources', 'pre_processing', 'columns', 'post_processing', 'validation_action', 'output',
];

/** Build the ordered plain object for a single interface, omitting empty sections. */
function interfaceToObject(iface) {
  const obj = {};
  for (const key of INTERFACE_SECTION_ORDER) {
    if (!isEmpty(iface[key])) obj[key] = iface[key];
  }
  return obj;
}
```

- [ ] **Step 2 — Verify output is unchanged.** `Expected: PASS` (round-trip, idempotence, key-order,
  empty-drop tests all green):
```
cd frontend && npm run test
```

- [ ] **Step 3 — Commit.**
```bash
git add frontend/src/serializers/yamlSerializer.js
git commit -s -m "refactor(serializer): replace section emitter registry with an ordered key loop"
```

**Done when:** the registry is gone, `interfaceToObject` is a loop over `INTERFACE_SECTION_ORDER`, and
`yamlSerializer.test.js` passes unchanged.

---

## Task 5 — Stop `runner.py` from reporting fake stage timings and false error levels

**Context for a cold start:** `backend/app/runner.py` parses ingen's log text into a `RunRecord`. Two
cosmetic lies: (a) every stage gets `durationMs: 0` — and **no UI component reads per-stage duration**
(verified: `HistoryView.jsx` and `RunConsole.jsx` read the *record*-level `durationMs`, which is real),
so the per-stage field is a write-only fake; drop it. (b) `_level_of()` tags any log line containing
`" error"`/`"failed"` as an error — so a data row or a column literally named "error" turns a green
run's log red. ingen logs in the standard ` - LEVEL - ` format, so parse the level token instead.

**Files:**
- Modify: `backend/app/runner.py` (`_level_of`, and drop per-stage `durationMs` in `build_run_record`)
- Modify: `backend/tests/test_runner.py` (update expectations; add a `_level_of` test)
- Modify (1 line): `frontend/src/services/runService.js` (remove the stage-level `durationMs` typedef)

- [ ] **Step 1 — Verify nothing reads per-stage duration (safety check).** Search the frontend for
  `durationMs` (use your Grep tool, or `rg -n durationMs frontend/src`, or `git grep -n durationMs -- frontend/src`).
  Confirm the only *reads* are `record.durationMs` / `r.durationMs` in
  `HistoryView.jsx` and `RunConsole.jsx`. If a component reads a *stage's* `durationMs`, STOP and keep
  the field (populate it from the parsed interface total instead) — otherwise proceed to drop it.

- [ ] **Step 2 — Drop per-stage `durationMs` in `build_run_record`.** In `runner.py`, the function
  appends stage dicts in two places (the "ok" loop and the failure loop). Remove `"durationMs": 0`
  from both, so stages look like `{"interface": name, "stage": st, "status": "ok"}` and
  `{"interface": name, "stage": st, "status": status}`.

- [ ] **Step 3 — Rewrite `_level_of` to parse the log level token.** Replace the whole `_level_of`
  function with:

```python
_LEVEL_RE = re.compile(r"\s-\s(DEBUG|INFO|WARNING|ERROR|CRITICAL)\s-\s")
_LEVEL_MAP = {"CRITICAL": "error", "ERROR": "error", "WARNING": "warn", "DEBUG": "info", "INFO": "info"}


def _level_of(line: str) -> str:
    """Use ingen's ' - LEVEL - ' log prefix; fall back to a narrow heuristic for prefix-less lines
    (e.g. raw traceback lines). Avoids flagging data/columns named 'error' as errors."""
    m = _LEVEL_RE.search(line)
    if m:
        return _LEVEL_MAP[m.group(1)]
    low = line.lower()
    if "traceback" in low or low.startswith("error"):
        return "error"
    return "info"
```

- [ ] **Step 4 — Update + extend `test_runner.py`.** Remove any assertion that expects
  `durationMs` on a stage. Add a focused test:

```python
def test_level_of_uses_log_prefix_not_substring(self):
    from backend.app.runner import _level_of
    # A data value containing "error" must NOT be flagged as an error.
    self.assertEqual(_level_of("2026-01-01 00:00:00 - root - INFO - balance error column loaded"), "info")
    self.assertEqual(_level_of("2026-01-01 00:00:00 - root - ERROR - boom"), "error")
    self.assertEqual(_level_of("2026-01-01 00:00:00 - py.warnings - WARNING - FutureWarning"), "warn")
    self.assertEqual(_level_of("Traceback (most recent call last):"), "error")
```
  (If the file is `unittest.TestCase`-based, put this method on the existing test class.)

- [ ] **Step 5 — Remove the stage-level `durationMs` typedef.** In
  `frontend/src/services/runService.js` there are two `@property {number} durationMs` lines. Remove the
  one on the **stage** typedef (the one describing a single `{ interface, stage, status }` entry); keep
  the one on the **record** typedef.

- [ ] **Step 6 — Verify.** `Expected: PASS`
```
.venv/Scripts/python.exe -m pytest backend/tests/test_runner.py -q
```

- [ ] **Step 7 — Commit.**
```bash
git add backend/app/runner.py backend/tests/test_runner.py frontend/src/services/runService.js
git commit -s -m "fix(runner): drop fake per-stage durations and parse real log levels"
```

**Done when:** stage dicts have no `durationMs`, `_level_of` reads the log level token (with a narrow
fallback), the new test passes, and the stage typedef no longer advertises a field that isn't emitted.

---

## Task 6 (OPTIONAL — do last, only if you want to) — Trim the frontend layering

**Context for a cold start:** This is taste, not a bug. The review flagged (a) a service-per-endpoint
layer plus an `adapters/` layer plus 6 `state/*Context.jsx` files — a lot of seams for a YAML builder,
with likely overlap between `historyService` / `chatHistoryService` / `useModelHistory` /
`RunContext` history; and (b) `frontend/src/models/types.js` — 144 lines of JSDoc `@typedef` in a
plain-JS project that nothing enforces at runtime. **Low payoff; skip unless it's actively annoying
you.** This task is investigation-first — don't rip things out blind.

**Files:** investigate under `frontend/src/services/`, `frontend/src/state/`, `frontend/src/adapters/`,
and `frontend/src/models/types.js`.

- [ ] **Step 1 — Map the history overlap.** Read `services/historyService.js`,
  `services/chatHistoryService.js`, `state/useModelHistory.js`, and the history bits of
  `state/RunContext.jsx`. Write down (in the PR description, not in code) what each is responsible for
  and where they genuinely overlap. If two truly do the same job, collapse into one and update imports.
  If they're distinct (run-history vs chat-history vs undo/redo model-history), leave them — the names
  just look similar.
- [ ] **Step 2 — Decide on `types.js`.** Grep for which typedefs are actually referenced
  (`import('../models/types.js')`). Delete the unreferenced ones; keep the few that document real
  shapes used across files. Do **not** introduce TypeScript as part of this task — that's a separate,
  much bigger decision.
- [ ] **Step 3 — Verify + commit (only if you changed something).**
```
cd frontend && npm run test && npm run lint
git commit -s -m "refactor(frontend): trim duplicated history layers / unused typedefs"
```

**Done when:** either you've collapsed a genuine duplication and tests pass, or you've confirmed the
layers are distinct and consciously left them. "Left as-is, on purpose" is an acceptable outcome.

---

## How to run this plan across chats

1. Open a fresh chat. Say: *"Open `plan.md` and do Task N."* (Tasks are independent — any order.)
2. The chat does only that task, runs the listed verification, and commits with `-s`.
3. Close it. Open another for the next task. **Don't do two tasks in one chat** — that's the whole point.

**Suggested order by value:** Task 1 (real bug) → Task 3 (security) → Task 2 (drift) → Task 5
(honesty) → Task 4 (cleanup) → Task 6 (optional). But nothing forces this order.

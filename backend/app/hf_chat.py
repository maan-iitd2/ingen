#  InGen wrapper — inChat intent extraction via a local HuggingFace model (no Ollama server needed).
#
#  Drop-in replacement for chat.py. Set INGEN_CHAT_BACKEND=hf in the environment to activate.
#  Uses AutoTokenizer + AutoModelForCausalLM directly so chat templates are applied correctly.
#  The model is loaded once at first call and kept resident (lazy init).
#
#  Default model: Qwen/Qwen3-4B  (4B params, open licence, chat-template, ~8 GB RAM on CPU)
#  Works well on any machine with 16 GB+ RAM. With 32 GB RAM you get comfortable headroom.
#
#  Other options (set HF_CHAT_MODEL env var):
#    Qwen/Qwen3-4B                    — default, best open model for structured JSON (8 GB RAM)
#    Qwen/Qwen2.5-7B-Instruct         — larger, higher quality             (~15 GB RAM)
#    Qwen/Qwen2.5-3B-Instruct         — smaller, faster                    (~7 GB RAM)
#    Qwen/Qwen2.5-1.5B-Instruct       — fast, lightweight                  (~3 GB RAM)
#    HuggingFaceTB/SmolLM2-360M-Instruct — smoke-test / very low RAM       (~0.7 GB RAM)
#
#  NOTE: All Gemma models (google/gemma-*) are GATED and require an HF token + licence accept.
#  All models above are fully open and download automatically from HuggingFace Hub.

import json
import os
import re
import threading

HF_MODEL = os.environ.get("HF_CHAT_MODEL", "Qwen/Qwen3-4B")

OPS = {"add_columns", "rename_column", "add_source", "add_filter", "set_output", "none"}

SYSTEM_PROMPT = (
    "You are inChat, a friendly assistant for building data pipelines in InGen Studio. "
    "Always respond with ONLY a single JSON object — no prose, no markdown fences, no explanation. "
    'Format: {"reply": "<1-2 sentence reply to the user>", "ops": [<ordered list of edit ops or empty>]}\n\n'
    "Available ops:\n"
    '  {"op": "add_columns", "cols": ["col1", "col2"]}\n'
    '  {"op": "rename_column", "from": "old_name", "to": "new_name"}\n'
    '  {"op": "add_source", "name": "identifier", "type": "file|mysql|api|rawdatastore|json"}\n'
    '  {"op": "add_filter", "col": "column_name", "val": "value_to_drop"}\n'
    '  {"op": "set_output", "type": "delimited_file|excel|json|json_writer|rawdatastore"}\n\n'
    "Rules:\n"
    "- Only use column names from the provided known columns list.\n"
    "- If the user is greeting or asking a question (not an edit), set ops=[] and reply helpfully.\n"
    "- If the user asks to modify the pipeline, fill ops in order. One request can have multiple ops.\n"
    "- NEVER rewrite the YAML. Only emit ops that modify it.\n"
    "- Output JSON only. Nothing before or after the JSON object."
)

# Lazy-loaded model + tokenizer (thread-safe via lock)
_model = None
_tokenizer = None
_model_lock = threading.Lock()


def _load_model():
    """Load tokenizer + model once and cache globally. Thread-safe double-checked locking."""
    global _model, _tokenizer
    if _model is not None:
        return _tokenizer, _model
    with _model_lock:
        if _model is not None:
            return _tokenizer, _model
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM

        tok = AutoTokenizer.from_pretrained(HF_MODEL, trust_remote_code=False)
        mdl = AutoModelForCausalLM.from_pretrained(
            HF_MODEL,
            dtype=torch.float32,    # CPU-safe; use bfloat16 if CUDA available
            device_map="cpu",
            trust_remote_code=False,
        )
        mdl.eval()
        _tokenizer = tok
        _model = mdl
    return _tokenizer, _model


def _extract_json(text: str) -> dict:
    """Best-effort JSON extraction — handles markdown fences and leading/trailing prose."""
    text = text.strip()
    # Remove Qwen3 thinking block if present (<think>...</think>)
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    # Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Markdown code fence: ```json { ... } ```
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            pass
    # First standalone { ... } block (greedy, handles nested braces via rfind)
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return {}


def _build_user_content(message: str, columns: list, yaml: str, interface: str) -> str:
    """Assemble the user turn content — context first, then the request."""
    parts = []
    if interface:
        parts.append(f"Active interface: {interface}")
    if yaml and yaml.strip():
        parts.append(
            "Current pipeline YAML (reference only — do NOT rewrite; emit ops to modify it):\n"
            + yaml.strip()
        )
    parts.append(f"Known columns: {columns if columns else []}")
    parts.append(f"Request: {message}")
    return "\n\n".join(parts)


def interpret(message: str, columns: list, yaml: str = "", interface: str = "") -> dict:
    """Ask the local HF model for a reply + ordered list of edit ops.
    Same public contract as chat.interpret(). Raises on load/inference errors so the
    FastAPI caller can return 502 and the frontend falls back to its regex parser."""
    if not message or not message.strip():
        return {"reply": "", "ops": []}  # warm-up ping — short-circuit

    tok, mdl = _load_model()
    import torch

    user_content = _build_user_content(message, columns, yaml, interface)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    # apply_chat_template — use enable_thinking=False for Qwen3 to skip CoT reasoning block
    # (faster + output goes straight to JSON). Falls back gracefully for other models.
    try:
        input_text = tok.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=False,
        )
    except TypeError:
        # model tokenizer doesn't support enable_thinking (non-Qwen3)
        input_text = tok.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

    inputs = tok(input_text, return_tensors="pt")
    input_len = inputs["input_ids"].shape[1]

    with torch.no_grad():
        output_ids = mdl.generate(
            **inputs,
            max_new_tokens=512,
            do_sample=False,        # greedy — deterministic, no randomness
            temperature=None,       # must be None when do_sample=False (transformers 5.x)
            top_p=None,             # same
            pad_token_id=tok.eos_token_id,
        )

    # Decode only the newly generated tokens (slice off the prompt)
    new_tokens = output_ids[0][input_len:]
    raw = tok.decode(new_tokens, skip_special_tokens=True)
    parsed = _extract_json(raw)

    if not isinstance(parsed, dict):
        parsed = {}

    ops = parsed.get("ops", [])
    return {
        "reply": str(parsed.get("reply", "")),
        "ops": [o for o in ops if isinstance(o, dict) and o.get("op") in OPS],
    }


def warmup() -> None:
    """Pre-load model weights into RAM. Best-effort — swallows all errors."""
    try:
        _load_model()
    except Exception:
        pass

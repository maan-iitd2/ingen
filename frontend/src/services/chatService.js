//  inChat — sends a message + known columns to the local HuggingFace-backed endpoint and gets back
//  an ordered list of edit ops (the model never writes YAML). Throws if the LLM is unavailable so the
//  caller can fall back to its regex parser.

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export async function interpretMessage(message, columns = [], yaml = '', interface_ = '', history = []) {
  const res = await fetch(`${API}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // yaml = current pipeline so the model edits what exists; interface = active interface name;
    // history = recent [{role, content}] turns so follow-ups ("now also add X") resolve.
    body: JSON.stringify({ message, columns, yaml, interface: interface_, history }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Chat failed (${res.status})`);
  }
  const { ops, reply } = await res.json();
  // reply: model-authored concise ack (shown to the user). ops: machine edits applied deterministically.
  return { ops: Array.isArray(ops) ? ops : [], reply: typeof reply === 'string' ? reply : '' };
}

// Fire-and-forget: nudge the backend to load the model so the first real message isn't slow.
export function warmup() {
  fetch(`${API}/api/chat/warmup`, { method: 'POST' }).catch(() => {});
}

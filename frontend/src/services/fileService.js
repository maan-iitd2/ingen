//  inFlow/inChat — file upload service. Talks directly to the local FastAPI wrapper (local-only
//  app, no adapter indirection needed for this). Returns { file_path, columns, preview, cached }.

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export async function uploadFile(file) {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API}/api/files/upload`, { method: 'POST', body });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

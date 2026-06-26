'use client';

//  Index route — the pipelines ledger. Lists every saved pipeline (localStorage, via ConfigService)
//  so you can resume past work or start a new one. Replaces the old straight-to-draft redirect.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Layers, Pencil, Check, X, Copy, Upload } from 'lucide-react';

import { getServices } from '../services/index.js';
import { makeId } from '../utils/id.js';
import {
  createEmptyConfig,
  createEmptyInterface,
  upsertInterface,
} from '../models/configModel.js';
import { yamlToModel } from '../serializers/index.js';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';
import { useDocTitle } from '../hooks/useDocTitle.js';

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d) ? '—' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState(null); // null = loading, [] = empty
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name } | null
  const [editingId, setEditingId] = useState(null);  // id of item being renamed
  const [editName, setEditName] = useState('');
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  useDocTitle('Your pipelines');
  const refresh = useCallback(() => { getServices().config.list().then(setItems); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const createPipeline = () => {
    if (busy) return;
    setBusy(true);
    const id = makeId('cfg');
    let model = createEmptyConfig({ id, name: 'Untitled pipeline' });
    model = upsertInterface(model, 'interface_1', createEmptyInterface());
    // Navigate optimistically, persist in the background.
    getServices().config.create(model).catch(() => {}).finally(() => setBusy(false));
    router.push(`/configs/${id}`);
  };

  const requestDelete = (e, id, name) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete({ id, name });
  };

  const confirmDeletePipeline = async () => {
    if (!confirmDelete) return;
    await getServices().config.remove(confirmDelete.id);
    setConfirmDelete(null);
    refresh();
  };

  const startRename = (e, id, name) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(id);
    setEditName(name || '');
  };

  const commitRename = async () => {
    const name = editName.trim();
    if (!name || !editingId) { setEditingId(null); return; }
    const svc = getServices().config;
    const m = await svc.get(editingId);
    if (m) await svc.update({ ...m, meta: { ...m.meta, name } });
    setEditingId(null);
    refresh();
  };

  const cancelRename = () => setEditingId(null);

  // ── Duplicate pipeline ────────────────────────────────────────────────────
  const duplicatePipeline = async (e, id, name) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const svc = getServices().config;
      const original = await svc.get(id);
      if (!original) return;
      const newId = makeId('cfg');
      const copy = {
        ...original,
        meta: { ...original.meta, id: newId, name: `${name || 'Untitled'} (copy)` },
      };
      await svc.create(copy);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  // ── Import YAML ───────────────────────────────────────────────────────────
  const triggerImport = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;
    setBusy(true);
    setImportError(null);
    try {
      const text = await file.text();
      const newId = makeId('cfg');
      const parsed = yamlToModel(text, { id: newId, name: file.name.replace(/\.ya?ml$/i, '') });
      await getServices().config.create(parsed);
      router.push(`/configs/${newId}`);
    } catch (err) {
      setImportError(err.message ?? 'Failed to parse YAML');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="plx">
      <header className="plx__head">
        <div>
          <span className="plx__eyebrow">⌗ InGen Studio</span>
          <h1 className="plx__title">Your pipelines</h1>
          <p className="plx__sub">Pick up where you left off, or start a new one. Everything is saved locally in this browser.</p>
        </div>
        <div className="plx__head-actions">
          <button className="btn btn--ghost" onClick={triggerImport} disabled={busy} title="Import an InGen YAML file as a new pipeline">
            <Upload size={15} /> Import YAML
          </button>
          <button className="btn btn--accent plx__new" onClick={createPipeline} disabled={busy}>
            <Plus size={16} /> New pipeline
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".yml,.yaml"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
      </header>
      {importError && (
        <div className="plx__import-err" role="alert">
          <strong>Import failed:</strong> {importError}
          <button className="plx__import-err-close" onClick={() => setImportError(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {items === null ? (
        <p className="plx__state">Loading…</p>
      ) : items.length === 0 ? (
        <button className="plx__empty" onClick={createPipeline} disabled={busy}>
          <span className="plx__empty-glyph"><Layers size={26} /></span>
          <strong>No pipelines yet</strong>
          <span>Create your first pipeline to start authoring a config.</span>
        </button>
      ) : (
        <ol className="plx__list">
          {items.map((it, i) => (
            <li key={it.id}>
              {editingId === it.id ? (
                <div className="plx__row plx__row--editing" onClick={(e) => e.preventDefault()}>
                  <span className="plx__rank">{String(i + 1).padStart(2, '0')}</span>
                  <input
                    className="plx__rename-input"
                    value={editName}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') cancelRename();
                    }}
                    onBlur={commitRename}
                  />
                  <button className="plx__rename-btn" title="Confirm" onMouseDown={(e) => { e.preventDefault(); commitRename(); }}>
                    <Check size={15} />
                  </button>
                  <button className="plx__rename-btn plx__rename-btn--cancel" title="Cancel" onMouseDown={(e) => { e.preventDefault(); cancelRename(); }}>
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <Link href={`/configs/${it.id}`} className="plx__row">
                  <span className="plx__rank">{String(i + 1).padStart(2, '0')}</span>
                  <span className="plx__info">
                    <span className="plx__name">{it.name || 'Untitled pipeline'}</span>
                    <span className="plx__meta">
                      {it.interfaceCount} interface{it.interfaceCount === 1 ? '' : 's'} · edited {fmtDate(it.updatedAt)}
                    </span>
                  </span>
                  <button
                    className="plx__icon-btn"
                    onClick={(e) => startRename(e, it.id, it.name)}
                    aria-label={`Rename ${it.name}`}
                    title="Rename"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="plx__icon-btn"
                    onClick={(e) => duplicatePipeline(e, it.id, it.name)}
                    aria-label={`Duplicate ${it.name}`}
                    title="Duplicate"
                    disabled={busy}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    className="plx__del"
                    onClick={(e) => requestDelete(e, it.id, it.name)}
                    aria-label={`Delete ${it.name}`}
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete pipeline"
        message={`Delete "${confirmDelete?.name}"? This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeletePipeline}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

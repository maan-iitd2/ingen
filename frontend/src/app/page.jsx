'use client';

//  Index route — the pipelines ledger. Lists every saved pipeline (localStorage, via ConfigService)
//  so you can resume past work or start a new one. Replaces the old straight-to-draft redirect.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Layers } from 'lucide-react';

import { getServices } from '../services/index.js';
import { makeId } from '../utils/id.js';
import {
  createEmptyConfig,
  createEmptyInterface,
  upsertInterface,
} from '../models/configModel.js';

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d) ? '—' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState(null); // null = loading, [] = empty
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => { getServices().config.list().then(setItems); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const createPipeline = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const id = makeId('cfg');
      let model = createEmptyConfig({ id, name: 'Untitled pipeline' });
      model = upsertInterface(model, 'interface_1', createEmptyInterface());
      await getServices().config.create(model);
      router.push(`/configs/${id}`);
    } finally {
      setBusy(false);
    }
  };

  const deletePipeline = async (e, id, name) => {
    e.preventDefault();           // the row is a Link — don't navigate
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    await getServices().config.remove(id);
    refresh();
  };

  return (
    <div className="plx">
      <header className="plx__head">
        <div>
          <span className="plx__eyebrow">⌗ InGen Studio</span>
          <h1 className="plx__title">Your pipelines</h1>
          <p className="plx__sub">Pick up where you left off, or start a new one. Everything is saved locally in this browser.</p>
        </div>
        <button className="btn btn--accent plx__new" onClick={createPipeline} disabled={busy}>
          <Plus size={16} /> New pipeline
        </button>
      </header>

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
              <Link href={`/configs/${it.id}`} className="plx__row">
                <span className="plx__rank">{String(i + 1).padStart(2, '0')}</span>
                <span className="plx__info">
                  <span className="plx__name">{it.name || 'Untitled pipeline'}</span>
                  <span className="plx__meta">
                    {it.interfaceCount} interface{it.interfaceCount === 1 ? '' : 's'} · edited {fmtDate(it.updatedAt)}
                  </span>
                </span>
                <button
                  className="plx__del"
                  onClick={(e) => deletePipeline(e, it.id, it.name)}
                  aria-label={`Delete ${it.name}`}
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

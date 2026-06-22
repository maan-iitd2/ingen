//  Sources tab — manages which config sources this interface consumes, and their order (source[0] is
//  the pre-process base input). Now supports INLINE source creation: users can create a new source
//  definition AND add it to the interface in a single action — no need to navigate to the separate
//  Sources registry page first.

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Database, FileText, Globe, Braces, HardDrive, ChevronDown, ChevronUp, Trash2, GripVertical } from 'lucide-react';
import { useConfig } from '../../../state/ConfigContext.jsx';
import { upsertSource } from '../../../models/configModel.js';
import { SOURCE_TYPES } from '../../../models/constants.js';
import ListControls from '../../common/ListControls.jsx';
import { listAdd, listRemove, listMove } from '../../../models/interfaceOps.js';

const TYPE_OPTIONS = Object.values(SOURCE_TYPES);

const TYPE_META = {
  file:         { icon: FileText,  color: '#3b82f6', label: 'File',          desc: 'CSV, Excel, XML, JSON, or fixed-width file' },
  mysql:        { icon: Database,  color: '#f59e0b', label: 'MySQL',         desc: 'SQL query against a database' },
  api:          { icon: Globe,     color: '#8b5cf6', label: 'API',           desc: 'HTTP endpoint (REST / SOAP)' },
  json:         { icon: Braces,    color: '#10b981', label: 'JSON',          desc: 'Runtime JSON payload' },
  rawdatastore: { icon: HardDrive, color: '#ec4899', label: 'Raw Datastore', desc: 'In-memory frame from another interface' },
};

function summarize(src) {
  if (!src) return '—';
  switch (src.type) {
    case 'file': return src.file_path || src.file_type || 'file';
    case 'mysql': return src.database || src.db_token || 'database';
    case 'rawdatastore': return 'in-memory frame';
    case 'api': return src.url || 'HTTP endpoint';
    case 'json': return 'runtime payload';
    default: return '';
  }
}

export default function SourcesTab({ interfaceName, iface }) {
  const { model, updateModel, updateInterface } = useConfig();
  const ids = iface.sources ?? [];
  const available = model.sourceOrder.filter((id) => !ids.includes(id));

  // Existing source picker
  const [pick, setPick] = useState('');

  // Inline creation form
  const [showCreate, setShowCreate] = useState(false);
  const [newId, setNewId] = useState('');
  const [newType, setNewType] = useState('file');

  const idTaken = Boolean(model.sourcesById[newId.trim()]);
  const canCreate = newId.trim().length > 0 && !idTaken;

  const apply = (fn) => updateInterface(interfaceName, fn);

  // Create a new source in the registry AND add it to this interface
  const createAndAdd = () => {
    const id = newId.trim();
    if (!id || model.sourcesById[id]) return;
    // 1. Create in registry
    updateModel((m) => upsertSource(m, { id, type: newType }));
    // 2. Add to this interface (need to do it after model update via a chained call)
    apply((it) => listAdd(it, 'sources', id));
    setNewId('');
    setShowCreate(false);
  };

  // Add existing source
  const addExisting = () => {
    if (!pick) return;
    apply((it) => listAdd(it, 'sources', pick));
    setPick('');
  };

  return (
    <div className="tabcontent">
      <p className="tabcontent__hint">
        Ordered source inputs (row 1 is the pipeline base). Manage all definitions in the{' '}
        <Link href={`/configs/${model.meta.id}/sources`}>Sources registry</Link>.
      </p>

      {/* ── Source cards ── */}
      {ids.length > 0 ? (
        <div className="src-cards">
          {ids.map((id, i) => {
            const src = model.sourcesById[id];
            const meta = TYPE_META[src?.type] || TYPE_META.file;
            const Icon = meta.icon;
            return (
              <div key={id} className="src-card">
                <div className="src-card__left">
                  <span className="src-card__rank">{i + 1}</span>
                  <div className="src-card__icon" style={{ backgroundColor: `${meta.color}12`, color: meta.color }}>
                    <Icon size={16} />
                  </div>
                  <div className="src-card__info">
                    <span className="src-card__id">{id}</span>
                    <span className="src-card__detail">
                      <span className="src-card__type-chip" style={{ color: meta.color, background: `${meta.color}10`, borderColor: `${meta.color}30` }}>{meta.label}</span>
                      {summarize(src) && <span className="src-card__summary">{summarize(src)}</span>}
                    </span>
                  </div>
                </div>
                <ListControls
                  index={i}
                  count={ids.length}
                  onMove={(d) => apply((it) => listMove(it, 'sources', i, d))}
                  onRemove={() => apply((it) => listRemove(it, 'sources', i))}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state__icon">
            <Database size={28} />
          </div>
          <div className="empty-state__text">
            <strong>No sources on this interface</strong>
            <span>Create a new source or add an existing one to get started.</span>
          </div>
        </div>
      )}

      {/* ── Add actions ── */}
      <div className="src-actions">
        {/* Add existing source */}
        {available.length > 0 && (
          <div className="src-actions__existing">
            <select className="field__input" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">— select an existing source —</option>
              {available.map((id) => {
                const src = model.sourcesById[id];
                const meta = TYPE_META[src?.type] || TYPE_META.file;
                return <option key={id} value={id}>{id} ({meta.label})</option>;
              })}
            </select>
            <button className="btn btn--ghost" disabled={!pick} onClick={addExisting}>
              <Plus size={14} /> Add
            </button>
          </div>
        )}

        {/* Create new source */}
        {!showCreate ? (
          <button className="btn btn--solid src-actions__create-btn" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Create new source
          </button>
        ) : (
          <div className="src-create-form">
            <div className="src-create-form__header">
              <span className="src-create-form__title">Create new source</span>
              <button className="navrail__icon-btn" onClick={() => { setShowCreate(false); setNewId(''); }}>
                ✕
              </button>
            </div>
            <div className="src-create-form__body">
              <div className="src-create-form__row">
                <div className="field">
                  <label className="field__label">Source ID</label>
                  <input
                    className={`field__input${idTaken ? ' field__input--err' : ''}`}
                    placeholder="e.g. my_data_file"
                    value={newId}
                    autoFocus
                    onChange={(e) => setNewId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canCreate) createAndAdd();
                      if (e.key === 'Escape') { setShowCreate(false); setNewId(''); }
                    }}
                  />
                  {idTaken && <span className="field__help field__help--err">A source with this ID already exists</span>}
                </div>
                <div className="field">
                  <label className="field__label">Type</label>
                  <select className="field__input" value={newType} onChange={(e) => setNewType(e.target.value)}>
                    {TYPE_OPTIONS.map((t) => {
                      const m = TYPE_META[t] || {};
                      return <option key={t} value={t}>{m.label || t}</option>;
                    })}
                  </select>
                </div>
              </div>
              {/* Type description */}
              <p className="src-create-form__type-desc">
                {TYPE_META[newType]?.desc || ''}
              </p>
              <button
                className="btn btn--solid"
                disabled={!canCreate}
                onClick={createAndAdd}
              >
                <Plus size={14} /> Create & add to interface
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

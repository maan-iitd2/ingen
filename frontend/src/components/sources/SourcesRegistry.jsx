//  Sources registry — config-level CRUD for source DEFINITIONS (file/mysql/api/json/rawdatastore).
//  Create with an id + type, edit type-specific fields via SchemaForm, delete. All edits go through
//  the Phase-0 model helpers and immediately update validation + YAML.

import { useState } from 'react';
import { useConfig } from '../../state/ConfigContext.jsx';
import { upsertSource, removeSource } from '../../models/configModel.js';
import { SOURCE_TYPES } from '../../models/constants.js';
import SchemaForm from '../../forms/SchemaForm.jsx';
import { sourceSchema } from '../../forms/schemas/sourceSchemas.js';

const TYPE_OPTIONS = Object.values(SOURCE_TYPES);

export default function SourcesRegistry() {
  const { model, updateModel } = useConfig();
  const [newId, setNewId] = useState('');
  const [newType, setNewType] = useState('file');
  const [openId, setOpenId] = useState(null);

  if (!model) return null;
  const ids = model.sourceOrder;

  const createSource = () => {
    const id = newId.trim();
    if (!id || model.sourcesById[id]) return;
    updateModel((m) => upsertSource(m, { id, type: newType }));
    setNewId('');
    setOpenId(id);
  };

  return (
    <section className="editor">
      <header className="editor__head">
        <h1 className="editor__title">Sources</h1>
        <p className="editor__subtitle">Shared source definitions referenced by interfaces.</p>
      </header>

      <div className="addbar addbar--card">
        <input
          className="field__input"
          placeholder="source id"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
        />
        <select className="field__input" value={newType} onChange={(e) => setNewType(e.target.value)}>
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn btn--solid" disabled={!newId.trim() || Boolean(model.sourcesById[newId.trim()])} onClick={createSource}>
          + Add source
        </button>
      </div>

      <div className="srclist">
        {ids.map((id) => {
          const src = model.sourcesById[id];
          const open = openId === id;
          return (
            <div key={id} className="srccard">
              <button className="srccard__head" onClick={() => setOpenId(open ? null : id)}>
                <span className="mono srccard__id">{id}</span>
                <span className="chip chip--accent">{src.type}</span>
                <span className="srccard__caret">{open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div className="srccard__body">
                  <SchemaForm
                    schema={sourceSchema(src.type)}
                    value={src}
                    onChange={(next) => updateModel((m) => upsertSource(m, { ...next, id, type: src.type }))}
                  />
                  {sourceSchema(src.type).length === 0 && (
                    <p className="muted">No configuration — payload/frame is provided at runtime.</p>
                  )}
                  <button
                    className="btn btn--danger"
                    onClick={() => { updateModel((m) => removeSource(m, id)); setOpenId(null); }}
                  >
                    Delete source
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {ids.length === 0 && <div className="emptyblock">No sources yet.</div>}
      </div>
    </section>
  );
}

//  Sources tab — manages which config sources this interface consumes, and their order (source[0] is
//  the pre-process base input). Source DEFINITIONS are created/edited in the Sources registry; this
//  tab only references them by id. Add / remove / reorder.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfig } from '../../../state/ConfigContext.jsx';
import ListControls from '../../common/ListControls.jsx';
import { listAdd, listRemove, listMove } from '../../../models/interfaceOps.js';

function summarize(src) {
  if (!src) return '— undefined source —';
  switch (src.type) {
    case 'file': return `${src.file_type ?? 'file'} · ${src.file_path ?? ''}`;
    case 'mysql': return `db: ${src.db_token ?? ''}`;
    case 'rawdatastore': return 'in-memory frame';
    case 'api': return src.url ?? '';
    case 'json': return 'runtime JSON payload';
    default: return '';
  }
}

export default function SourcesTab({ interfaceName, iface }) {
  const { model, updateInterface } = useConfig();
  const ids = iface.sources ?? [];
  const available = model.sourceOrder.filter((id) => !ids.includes(id));
  const [pick, setPick] = useState('');

  const apply = (fn) => updateInterface(interfaceName, fn);

  return (
    <div className="tabcontent">
      <p className="tabcontent__hint">
        Ordered source inputs (row 1 is the pipeline base). Define sources in the{' '}
        <Link to={`/configs/${model.meta.id}/sources`}>Sources registry</Link>.
      </p>

      <div className="addbar">
        <select className="field__input field__input--wide" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">— add a source —</option>
          {available.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <button
          className="btn btn--solid"
          disabled={!pick}
          onClick={() => { apply((it) => listAdd(it, 'sources', pick)); setPick(''); }}
        >
          + Add
        </button>
      </div>

      <table className="dgrid">
        <thead><tr><th>#</th><th>id</th><th>type</th><th>detail</th><th /></tr></thead>
        <tbody>
          {ids.map((id, i) => {
            const src = model.sourcesById[id];
            return (
              <tr key={id}>
                <td className="dgrid__idx">{i + 1}</td>
                <td className="mono">{id}</td>
                <td><span className="chip">{src?.type ?? 'unknown'}</span></td>
                <td className="mono dgrid__detail">{summarize(src)}</td>
                <td>
                  <ListControls
                    index={i}
                    count={ids.length}
                    onMove={(d) => apply((it) => listMove(it, 'sources', i, d))}
                    onRemove={() => apply((it) => listRemove(it, 'sources', i))}
                  />
                </td>
              </tr>
            );
          })}
          {ids.length === 0 && <tr><td colSpan={5} className="dgrid__empty">No sources on this interface.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

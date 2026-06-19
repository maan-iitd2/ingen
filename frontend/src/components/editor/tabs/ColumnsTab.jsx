//  Columns & Formatters editor — add/edit/delete/reorder columns; per column, stack formatters with
//  type selection + schema-driven configuration, also add/remove/reorder. Every edit flows through
//  the shared list ops → ConfigContext → live YAML.

import { useState } from 'react';
import { useConfig } from '../../../state/ConfigContext.jsx';
import { useCatalog } from '../../../state/CatalogContext.jsx';
import SchemaForm from '../../../forms/SchemaForm.jsx';
import ListControls from '../../common/ListControls.jsx';
import { listAdd, listUpdate, listRemove, listMove } from '../../../models/interfaceOps.js';
import { formatterSchema } from '../../../forms/schemas/formatterSchemas.js';

function FormatterRow({ formatter, index, count, onChange, onMove, onRemove }) {
  return (
    <div className="fmtrow">
      <div className="fmtrow__head">
        <span className="chip chip--mono">{formatter.type}</span>
        <ListControls index={index} count={count} onMove={onMove} onRemove={onRemove} />
      </div>
      <SchemaForm
        schema={formatterSchema(formatter.type)}
        value={formatter}
        onChange={(next) => onChange({ ...next, type: formatter.type })}
      />
    </div>
  );
}

function ColumnCard({ col, index, count, formatterTypes, onChangeCol, onMoveCol, onRemoveCol }) {
  const [addFmt, setAddFmt] = useState('date');
  const formatters = col.formatters ?? [];

  const setFormatters = (next) => onChangeCol({ ...col, formatters: next.length ? next : undefined });

  return (
    <div className="colcard">
      <div className="colcard__head">
        <input
          className="field__input colcard__src"
          placeholder="src_col_name"
          value={col.src_col_name ?? ''}
          onChange={(e) => onChangeCol({ ...col, src_col_name: e.target.value })}
        />
        <span className="colcard__arrow">→</span>
        <input
          className="field__input colcard__dest"
          placeholder={col.src_col_name || 'dest_col_name'}
          value={col.dest_col_name ?? ''}
          onChange={(e) => onChangeCol({ ...col, dest_col_name: e.target.value || undefined })}
        />
        <ListControls index={index} count={count} onMove={onMoveCol} onRemove={onRemoveCol} />
      </div>

      <div className="colcard__fmts">
        {formatters.map((f, fi) => (
          <FormatterRow
            key={fi}
            formatter={f}
            index={fi}
            count={formatters.length}
            onChange={(nf) => setFormatters(formatters.map((x, i) => (i === fi ? nf : x)))}
            onMove={(d) => {
              const t = fi + d;
              if (t < 0 || t >= formatters.length) return;
              const arr = [...formatters];
              [arr[fi], arr[t]] = [arr[t], arr[fi]];
              setFormatters(arr);
            }}
            onRemove={() => setFormatters(formatters.filter((_, i) => i !== fi))}
          />
        ))}
        <div className="addbar addbar--sub">
          <select className="field__input" value={addFmt} onChange={(e) => setAddFmt(e.target.value)}>
            {formatterTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn--ghost-dark" onClick={() => setFormatters([...formatters, { type: addFmt }])}>
            + formatter
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ColumnsTab({ interfaceName, iface }) {
  const { updateInterface } = useConfig();
  const { catalog } = useCatalog();
  const columns = iface.columns ?? [];
  const formatterTypes = catalog?.formatters ?? [];

  const apply = (fn) => updateInterface(interfaceName, fn);

  return (
    <div className="tabcontent">
      <p className="tabcontent__hint">Source-to-output column mapping. Edits update the YAML live.</p>

      <div className="colcards">
        {columns.map((col, i) => (
          <ColumnCard
            key={i}
            col={col}
            index={i}
            count={columns.length}
            formatterTypes={formatterTypes}
            onChangeCol={(next) => apply((it) => listUpdate(it, 'columns', i, next))}
            onMoveCol={(d) => apply((it) => listMove(it, 'columns', i, d))}
            onRemoveCol={() => apply((it) => listRemove(it, 'columns', i))}
          />
        ))}
        {columns.length === 0 && <div className="emptyblock">No columns yet.</div>}
      </div>

      <button
        className="btn btn--solid"
        onClick={() => apply((it) => listAdd(it, 'columns', { src_col_name: '' }))}
      >
        + Add column
      </button>
    </div>
  );
}

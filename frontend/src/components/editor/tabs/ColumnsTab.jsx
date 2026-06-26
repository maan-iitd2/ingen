//  Columns & Formatters editor — card-based layout with clear source → dest mapping.
//  Each column is a visual card; formatters are chips that expand inline for editing.

import { useState } from 'react';
import { Plus, ArrowRight, ChevronDown, ChevronUp, Columns } from 'lucide-react';
import { useConfig } from '../../../state/ConfigContext.jsx';
import { useCatalog } from '../../../state/CatalogContext.jsx';
import SchemaForm from '../../../forms/SchemaForm.jsx';
import ListControls from '../../common/ListControls.jsx';
import { listAdd, listUpdate, listRemove, listMove } from '../../../models/interfaceOps.js';
import { formatterSchema } from '../../../forms/schemas/formatterSchemas.js';

function FormatterRow({ formatter, index, count, onChange, onMove, onRemove }) {
  return (
    <div className="colcard__fmt-row">
      <div className="colcard__fmt-head">
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

function ColumnCard({ col, index, count, isExpanded, onToggle, onUpdate, onRemove, onMove, formatterTypes, onUpdateFmts }) {
  const fmts = col.formatters ?? [];
  const [addFmt, setAddFmt] = useState('date');

  return (
    <div className={`colcard${isExpanded ? ' colcard--expanded' : ''}`}>
      <div className="colcard__main">
        <div className="colcard__rank">{index + 1}</div>

        <div className="colcard__mapping">
          <div className="colcard__field">
            <label className="colcard__field-label">Source column</label>
            <input
              className="colcard__input"
              placeholder="src_col_name"
              value={col.src_col_name ?? ''}
              onChange={(e) => onUpdate({ ...col, src_col_name: e.target.value })}
            />
          </div>

          <div className="colcard__arrow">
            <ArrowRight size={16} />
          </div>

          <div className="colcard__field">
            <label className="colcard__field-label">Output column</label>
            <input
              className="colcard__input"
              placeholder={col.src_col_name || 'dest_col_name'}
              value={col.dest_col_name ?? ''}
              onChange={(e) => onUpdate({ ...col, dest_col_name: e.target.value || undefined })}
            />
          </div>
        </div>

        <div className="colcard__actions">
          {/* Formatter badge / toggle */}
          <button
            className={`colcard__fmt-badge${isExpanded ? ' colcard__fmt-badge--open' : ''}${fmts.length > 0 ? ' colcard__fmt-badge--has' : ''}`}
            onClick={onToggle}
            title={fmts.length > 0 ? `${fmts.length} formatter(s) — click to edit` : 'Add a formatter'}
          >
            {fmts.length > 0
              ? <>{fmts.length} fmt{fmts.length !== 1 ? 's' : ''} {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</>
              : <><Plus size={12} /> fmt</>
            }
          </button>

          <ListControls
            index={index}
            count={count}
            onMove={onMove}
            onRemove={onRemove}
          />
        </div>
      </div>

      {/* Expanded formatter editor */}
      {isExpanded && (
        <div className="colcard__fmt-body">
          {fmts.map((f, fi) => (
            <FormatterRow
              key={fi}
              formatter={f}
              index={fi}
              count={fmts.length}
              onChange={(nf) => {
                const next = [...fmts];
                next[fi] = nf;
                onUpdateFmts(next);
              }}
              onMove={(d) => {
                const t = fi + d;
                if (t < 0 || t >= fmts.length) return;
                const arr = [...fmts];
                [arr[fi], arr[t]] = [arr[t], arr[fi]];
                onUpdateFmts(arr);
              }}
              onRemove={() => onUpdateFmts(fmts.filter((_, idx) => idx !== fi))}
            />
          ))}
          <div className="colcard__fmt-add">
            <select
              className="field__input"
              value={addFmt}
              onChange={(e) => setAddFmt(e.target.value)}
            >
              {formatterTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              className="btn btn--ghost-dark btn--xs"
              onClick={() => onUpdateFmts([...fmts, { type: addFmt }])}
            >
              <Plus size={12} /> Add formatter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ColumnsTab({ interfaceName, iface }) {
  const { updateInterface } = useConfig();
  const { catalog } = useCatalog();
  const columns = iface.columns ?? [];
  const formatterTypes = catalog?.formatters ?? [];
  const [expandedIdx, setExpandedIdx] = useState(null);

  const apply = (fn) => updateInterface(interfaceName, fn);

  const toggleExpand = (i) => setExpandedIdx((prev) => (prev === i ? null : i));

  const removeCol = (i) => {
    apply((it) => listRemove(it, 'columns', i));
    setExpandedIdx((prev) => {
      if (prev === i) return null;
      if (prev > i) return prev - 1;
      return prev;
    });
  };

  // Reorder while keeping the expanded card following its column (so the open formatter editor
  // stays on the row the user is editing, not whichever column lands at that index).
  const moveCol = (i, d) => {
    apply((it) => listMove(it, 'columns', i, d));
    setExpandedIdx((prev) => (prev === i ? i + d : prev === i + d ? i : prev));
  };

  const updateFmts = (colIdx, col, fmts) =>
    apply((it) => listUpdate(it, 'columns', colIdx, { ...col, formatters: fmts.length ? fmts : undefined }));

  const addColumn = () => apply((it) => listAdd(it, 'columns', { src_col_name: '' }));

  return (
    <div className="tabcontent">
      <div className="colcard-header">
        <p className="tabcontent__hint">
          Map source columns to output columns. Add formatters to transform values.
        </p>
        {columns.length > 0 && (
          <button className="btn btn--solid btn--xs" onClick={addColumn}>
            <Plus size={13} /> Add column
          </button>
        )}
      </div>

      {columns.length > 0 ? (
        <div className="colcard-list">
          {columns.map((col, i) => (
            <ColumnCard
              key={`${col.src_col_name ?? ''}:${col.dest_col_name ?? ''}:${i}`}
              col={col}
              index={i}
              count={columns.length}
              isExpanded={expandedIdx === i}
              onToggle={() => toggleExpand(i)}
              onUpdate={(next) => apply((it) => listUpdate(it, 'columns', i, next))}
              onRemove={() => removeCol(i)}
              onMove={(d) => moveCol(i, d)}
              formatterTypes={formatterTypes}
              onUpdateFmts={(fmts) => updateFmts(i, col, fmts)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state__icon">
            <Columns size={28} />
          </div>
          <div className="empty-state__text">
            <strong>No columns mapped yet</strong>
            <span>Add your first column mapping to define how source data maps to the output.</span>
          </div>
        </div>
      )}

      <button className="btn btn--solid colcard-add-btn" onClick={addColumn}>
        <Plus size={14} /> Add column
      </button>
    </div>
  );
}

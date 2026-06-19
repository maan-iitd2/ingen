//  Pre-processing editor — ordered pipeline with add / edit / remove / reorder. Each step renders a
//  schema-driven form for its type. Order is meaningful (output of step N feeds N+1), so reordering
//  uses the shared list ops. Not a graph (DESIGN §5).

import { useState } from 'react';
import { useConfig } from '../../../state/ConfigContext.jsx';
import SchemaForm from '../../../forms/SchemaForm.jsx';
import ListControls from '../../common/ListControls.jsx';
import { listAdd, listUpdate, listRemove, listMove } from '../../../models/interfaceOps.js';
import { PRE_PROCESSOR_SCHEMAS, PRE_PROCESSOR_ORDER, preProcessorSchema } from '../../../forms/schemas/preProcessorSchemas.js';

export default function PreProcessingTab({ interfaceName, iface }) {
  const { model, updateInterface } = useConfig();
  const [addType, setAddType] = useState('merge');
  const steps = iface.pre_processing ?? [];
  const ctx = { sources: model.sourceOrder };

  const apply = (fn) => updateInterface(interfaceName, fn);

  return (
    <div className="tabcontent">
      <p className="tabcontent__hint">Ordered transforms applied before column formatting.</p>

      <div className="addbar">
        <select className="field__input" value={addType} onChange={(e) => setAddType(e.target.value)}>
          {PRE_PROCESSOR_ORDER.map((t) => (
            <option key={t} value={t}>{PRE_PROCESSOR_SCHEMAS[t].label}</option>
          ))}
        </select>
        <button className="btn btn--solid" onClick={() => apply((i) => listAdd(i, 'pre_processing', { type: addType }))}>
          + Add step
        </button>
      </div>

      <ol className="stepper">
        {steps.map((step, i) => (
          <li key={i} className="stepper__item stepper__item--editable">
            <span className="stepper__num">{i + 1}</span>
            <div className="stepper__body">
              <div className="stepper__row">
                <span className="chip chip--accent">{PRE_PROCESSOR_SCHEMAS[step.type]?.label ?? step.type}</span>
                <ListControls
                  index={i}
                  count={steps.length}
                  onMove={(d) => apply((it) => listMove(it, 'pre_processing', i, d))}
                  onRemove={() => apply((it) => listRemove(it, 'pre_processing', i))}
                />
              </div>
              <SchemaForm
                schema={preProcessorSchema(step.type)}
                value={step}
                ctx={ctx}
                onChange={(next) => apply((it) => listUpdate(it, 'pre_processing', i, { ...next, type: step.type }))}
              />
            </div>
          </li>
        ))}
        {steps.length === 0 && <li className="stepper__empty">No pre-processing steps.</li>}
      </ol>
    </div>
  );
}

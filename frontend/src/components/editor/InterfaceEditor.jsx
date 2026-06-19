//  InGen Studio — InterfaceEditor (PRIMARY screen)
//
//  Edits one interface at a time. Six tabs map 1:1 to the InGen pipeline stages
//  (sources → pre_processing → columns → post_processing → validations → output). Each tab reads its
//  slice of the interface from the model and renders a form/table/list — never a canvas (DESIGN §5).
//  Phase 1 establishes this layout and wires one live edit (column rename) to prove model→YAML flow;
//  the full per-stage forms are Phase 2.

import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { useConfig } from '../../state/ConfigContext.jsx';
import SourcesTab from './tabs/SourcesTab.jsx';
import PreProcessingTab from './tabs/PreProcessingTab.jsx';
import ColumnsTab from './tabs/ColumnsTab.jsx';
import PostProcessingTab from './tabs/PostProcessingTab.jsx';
import ValidationsTab from './tabs/ValidationsTab.jsx';
import OutputTab from './tabs/OutputTab.jsx';

const TABS = [
  { key: 'sources', label: 'Sources', Component: SourcesTab, count: (i) => i.sources?.length },
  { key: 'pre', label: 'Pre-processing', Component: PreProcessingTab, count: (i) => i.pre_processing?.length },
  { key: 'columns', label: 'Columns', Component: ColumnsTab, count: (i) => i.columns?.length },
  { key: 'post', label: 'Post-processing', Component: PostProcessingTab, count: (i) => i.post_processing?.length },
  { key: 'validations', label: 'Validations', Component: ValidationsTab, count: () => undefined },
  { key: 'output', label: 'Output', Component: OutputTab, count: () => undefined },
];

export default function InterfaceEditor() {
  const { interfaceName } = useParams();
  const { model } = useConfig();
  const [active, setActive] = useState('sources');

  const iface = model?.interfacesByName?.[interfaceName];

  if (!iface) {
    return <div className="placeholder">Interface “{interfaceName}” not found in this config.</div>;
  }

  const ActiveTab = TABS.find((t) => t.key === active)?.Component ?? SourcesTab;

  return (
    <section className="editor">
      <header className="editor__head">
        <h1 className="editor__title">{interfaceName}</h1>
        <p className="editor__subtitle">Interface definition — one generated output file</p>
      </header>

      <div className="tabbar" role="tablist">
        {TABS.map((t) => {
          const n = t.count(iface);
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active === t.key}
              className={`tabbar__tab${active === t.key ? ' tabbar__tab--active' : ''}`}
              onClick={() => setActive(t.key)}
            >
              {t.label}
              {typeof n === 'number' && <span className="tabbar__count">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="editor__panel" role="tabpanel">
        <ActiveTab interfaceName={interfaceName} iface={iface} />
      </div>
    </section>
  );
}

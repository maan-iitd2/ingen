//  InGen Studio — WorkspaceTopbar
//
//  Config-level chrome: the document name, a real save-state pill driven by ConfigContext.status,
//  an issue count, and a disabled Run affordance (Run Console is a later phase). The YAML
//  collapse toggle is hoisted here so it sits with the other workspace controls.

import { useConfig } from '../../state/ConfigContext.jsx';

const PILL = {
  loading: { label: 'Loading…', cls: 'pill--muted' },
  saving: { label: 'Saving…', cls: 'pill--muted' },
  dirty: { label: 'Unsaved', cls: 'pill--warn' },
  saved: { label: 'Saved', cls: 'pill--ok' },
  error: { label: 'Save failed', cls: 'pill--err' },
};

export default function WorkspaceTopbar({ yamlCollapsed, onToggleYaml }) {
  const { model, status, issues } = useConfig();
  const pill = PILL[status] ?? PILL.loading;
  const errorCount = issues.filter((i) => i.level === 'error').length;

  return (
    <div className="wtopbar">
      <div className="wtopbar__left">
        <span className="wtopbar__name">{model?.meta.name ?? '—'}</span>
        <span className={`pill ${pill.cls}`}>{pill.label}</span>
        {errorCount > 0 && (
          <span className="pill pill--err" title="Validation errors">
            {errorCount} issue{errorCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="wtopbar__right">
        <button className="btn btn--ghost" onClick={onToggleYaml}>
          {yamlCollapsed ? 'Show YAML' : 'Hide YAML'}
        </button>
        <button className="btn btn--accent" disabled title="Run Console — Phase 3">
          Run ▸
        </button>
      </div>
    </div>
  );
}

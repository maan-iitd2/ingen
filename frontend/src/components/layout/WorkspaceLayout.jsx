//  InGen Studio — WorkspaceLayout
//
//  The persistent 3-pane workspace shell: NavRail · editor (router Outlet) · YAML preview.
//  No more WorkspaceTopbar — config info is in the brand bar. Left sidebar is collapsible.
//  Injects config name + save status into the brand bar's right portal via a useEffect.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';

import NavRail from './NavRail.jsx';
import YamlPreviewPanel from '../yaml/YamlPreviewPanel.jsx';
import ErrorBoundary from '../common/ErrorBoundary.jsx';
import { useConfig } from '../../state/ConfigContext.jsx';

const PILL = {
  loading: { label: 'Loading…', cls: 'pill--muted' },
  saving:  { label: 'Saving…',  cls: 'pill--muted' },
  dirty:   { label: 'Unsaved',  cls: 'pill--warn' },
  saved:   { label: 'Saved',    cls: 'pill--ok' },
  error:   { label: 'Error',    cls: 'pill--err' },
};

function BrandBarPortal({ children }) {
  // Guard for server rendering — the portal target only exists in the live DOM.
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('brandbar-right-portal');
  if (!el) return null;
  return createPortal(children, el);
}

export default function WorkspaceLayout({ configId, children }) {
  const [yamlCollapsed, setYamlCollapsed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const { model, status, issues } = useConfig();
  const pathname = usePathname();
  const { interfaceName } = useParams() || {};

  const pill = PILL[status] ?? PILL.loading;
  const errorCount = issues.filter((i) => i.level === 'error').length;

  let panesCls = 'workspace__panes';
  if (yamlCollapsed) panesCls += ' workspace__panes--noyaml';
  
  if (!interfaceName) {
    panesCls += ' workspace__panes--hiddenrail';
  } else if (railCollapsed) {
    panesCls += ' workspace__panes--norail';
  }

  return (
    <div className="workspace">
      {/* Inject config info into brand bar right side */}
      <BrandBarPortal>
        <span className="brandbar__config-name">{model?.meta.name ?? '—'}</span>
        <span className={`pill ${pill.cls}`}>{pill.label}</span>
        {errorCount > 0 && (
          <span className="pill pill--err" title="Validation errors">
            {errorCount} issue{errorCount > 1 ? 's' : ''}
          </span>
        )}
        <button className="btn btn--ghost" onClick={() => setYamlCollapsed((v) => !v)}>
          {yamlCollapsed ? 'Show YAML' : 'Hide YAML'}
        </button>
        <Link className="btn btn--accent" href={`/configs/${configId}/run`} title="Open the run console">
          Run ▸
        </Link>
      </BrandBarPortal>

      <div className={panesCls}>
        {interfaceName && (
          <NavRail
            configId={configId}
            collapsed={railCollapsed}
            onToggleCollapse={() => setRailCollapsed((v) => !v)}
          />
        )}
        <main className="workspace__editor">
          {status === 'loading' ? (
            <div className="placeholder">Loading config…</div>
          ) : status === 'error' ? (
            <div className="placeholder" role="alert">
              <h2>Config not found</h2>
              <p className="muted">This config could not be loaded. It may have been deleted.</p>
              <Link className="btn btn--accent" href="/">Back to configs</Link>
            </div>
          ) : (
            // Keyed per-route so a crash on one page clears when you navigate — placed BELOW
            // ConfigProvider so the reset never remounts the document store.
            <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
          )}
        </main>
        {!yamlCollapsed && <YamlPreviewPanel />}
      </div>
    </div>
  );
}

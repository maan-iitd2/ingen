//  InGen Studio — WorkspaceLayout
//
//  The persistent 3-pane workspace shell: NavRail · editor (router Outlet) · YAML preview, beneath a
//  config-level topbar. Lives inside ConfigProvider so every pane reads the same model. The YAML
//  pane is collapsible (and the layout reflows under it via CSS at narrow widths).

import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import NavRail from './NavRail.jsx';
import WorkspaceTopbar from './WorkspaceTopbar.jsx';
import YamlPreviewPanel from '../yaml/YamlPreviewPanel.jsx';
import { useConfig } from '../../state/ConfigContext.jsx';

export default function WorkspaceLayout({ configId }) {
  const [yamlCollapsed, setYamlCollapsed] = useState(false);
  const { status } = useConfig();

  return (
    <div className="workspace">
      <WorkspaceTopbar
        yamlCollapsed={yamlCollapsed}
        onToggleYaml={() => setYamlCollapsed((v) => !v)}
      />
      <div className={`workspace__panes${yamlCollapsed ? ' workspace__panes--noyaml' : ''}`}>
        <NavRail configId={configId} />
        <main className="workspace__editor">
          {status === 'loading' ? (
            <div className="placeholder">Loading config…</div>
          ) : (
            <Outlet />
          )}
        </main>
        {!yamlCollapsed && <YamlPreviewPanel />}
      </div>
    </div>
  );
}

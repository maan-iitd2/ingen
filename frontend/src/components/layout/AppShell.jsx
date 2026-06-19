//  InGen Studio — AppShell
//
//  Outermost frame: a thin global brand bar + the routed content below it. Used as a layout route
//  so every page sits inside the same chrome. Workspace-specific chrome (config name, save state)
//  lives lower, in WorkspaceTopbar, where the config context is available.

import { Link, Outlet } from 'react-router-dom';

export default function AppShell() {
  return (
    <div className="app-shell">
      <header className="brandbar">
        <Link to="/" className="brandbar__mark">
          <span className="brandbar__glyph" aria-hidden="true">⌗</span>
          InGen<span className="brandbar__sub">Studio</span>
        </Link>
        <span className="brandbar__tag">YAML interface authoring</span>
      </header>
      <div className="app-shell__body">
        <Outlet />
      </div>
    </div>
  );
}

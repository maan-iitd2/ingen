//  InGen Studio — route tree
//
//  Declarative React Router (v7). AppShell is a layout route wrapping every page; the config
//  workspace nests the interface editor under a shared config context. No Run Console / Overview
//  routes yet (later phases).

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

import AppShell from './components/layout/AppShell.jsx';
import ConfigsLanding from './pages/ConfigsLanding.jsx';
import ConfigWorkspace, { InterfaceRedirect } from './pages/ConfigWorkspace.jsx';
import InterfaceEditor from './components/editor/InterfaceEditor.jsx';
import SourcesRegistry from './components/sources/SourcesRegistry.jsx';
import RunConsole from './components/run/RunConsole.jsx';
import HistoryView from './components/run/HistoryView.jsx';

function NoMatch() {
  return (
    <div className="placeholder">
      <p>Page not found.</p>
      <Link to="/">Back to configs</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<ConfigsLanding />} />
          <Route path="configs/:configId" element={<ConfigWorkspace />}>
            <Route index element={<InterfaceRedirect />} />
            <Route path="interfaces/:interfaceName" element={<InterfaceEditor />} />
            <Route path="sources" element={<SourcesRegistry />} />
            <Route path="run" element={<RunConsole />} />
            <Route path="history" element={<HistoryView />} />
          </Route>
          <Route path="*" element={<NoMatch />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

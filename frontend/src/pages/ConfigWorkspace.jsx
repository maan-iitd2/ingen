//  InGen Studio — ConfigWorkspace (route element for /configs/:configId)
//
//  Composes the providers (catalog + the config document) around the WorkspaceLayout. All child
//  routes (the interface editor) render into the layout's Outlet and share this config context.

import { useParams, Navigate } from 'react-router-dom';

import { CatalogProvider } from '../state/CatalogContext.jsx';
import { ConfigProvider, useConfig } from '../state/ConfigContext.jsx';
import WorkspaceLayout from '../components/layout/WorkspaceLayout.jsx';

export default function ConfigWorkspace() {
  const { configId } = useParams();
  return (
    <CatalogProvider>
      {/* key={configId} remounts the document store on config switch — clean load state per id. */}
      <ConfigProvider key={configId} configId={configId}>
        <WorkspaceLayout configId={configId} />
      </ConfigProvider>
    </CatalogProvider>
  );
}

/**
 * Index route: once the model is loaded, redirect to the first interface's editor so the workspace
 * never lands on an empty pane.
 */
export function InterfaceRedirect() {
  const { configId } = useParams();
  const { model, status } = useConfig();

  if (status === 'loading' || !model) return <div className="placeholder">Loading config…</div>;
  const first = model.interfaceOrder[0];
  if (!first) return <div className="placeholder">This config has no interfaces yet.</div>;
  return <Navigate to={`/configs/${configId}/interfaces/${first}`} replace />;
}

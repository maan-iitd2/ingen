//  InGen Studio — YamlPreviewPanel
//
//  First-class, always-live YAML view. It renders `yaml` straight from ConfigContext, which derives
//  it from the REAL serializer (modelToYaml) on every model change — so editing any field updates
//  this panel immediately. Copy/download act on the same serialized text. No editing here in Phase 1
//  (import/round-trip editing is the full-screen /yaml route, a later phase).

import { useConfig } from '../../state/ConfigContext.jsx';

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function YamlPreviewPanel() {
  const { yaml, model } = useConfig();
  const filename = `${model?.meta.id ?? 'config'}.yml`;

  return (
    <aside className="yamlpanel" aria-label="YAML preview">
      <div className="yamlpanel__head">
        <span className="yamlpanel__title">YAML</span>
        <span className="yamlpanel__live" title="Regenerated from the model on every edit">live</span>
        <div className="yamlpanel__actions">
          <button className="btn btn--ghost btn--xs" onClick={() => navigator.clipboard?.writeText(yaml)}>
            Copy
          </button>
          <button className="btn btn--ghost btn--xs" onClick={() => download(filename, yaml)}>
            Download
          </button>
        </div>
      </div>
      <pre className="yamlpanel__code"><code>{yaml}</code></pre>
    </aside>
  );
}

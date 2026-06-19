//  InGen Studio — ConfigsLanding (route element for "/")
//
//  Lists saved configs from ConfigService and links into each workspace. Seeds the realistic demo
//  config on first run so the app is never empty. This is the entry point and the config switcher's
//  backing list.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getServices } from '../services/index.js';
import { ensureSeed } from '../mocks/seedConfig.js';

export default function ConfigsLanding() {
  const [configs, setConfigs] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureSeed();
      const list = await getServices().config.list();
      if (alive) setConfigs(list);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="landing">
      <header className="landing__head">
        <h1>Configs</h1>
        <p className="muted">YAML interface definitions. Open one to author sources, interfaces, and output.</p>
      </header>

      {configs === null ? (
        <div className="placeholder">Loading…</div>
      ) : (
        <ul className="configgrid">
          {configs.map((c) => (
            <li key={c.id}>
              <Link to={`/configs/${c.id}`} className="configcard">
                <span className="configcard__name">{c.name}</span>
                <span className="configcard__meta mono">{c.id}</span>
                <span className="configcard__count">
                  {c.interfaceCount} interface{c.interfaceCount === 1 ? '' : 's'}
                </span>
              </Link>
            </li>
          ))}
          {configs.length === 0 && <li className="placeholder">No configs.</li>}
        </ul>
      )}
    </div>
  );
}

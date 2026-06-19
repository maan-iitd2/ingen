//  Execution History (route element for /configs/:configId/history)
//
//  Lists past RunRecords for this config from HistoryService (localStorage-backed). Expand a run to
//  see its validation results and per-stage outcome. Read-only audit surface.

import { useEffect, useState, useCallback } from 'react';
import { useConfig } from '../../state/ConfigContext.jsx';
import { getServices } from '../../services/index.js';
import ValidationResults from './ValidationResults.jsx';

const STATUS_PILL = { success: 'pill--ok', partial: 'pill--warn', failed: 'pill--err' };
const fmt = (iso) => (iso ? iso.replace('T', ' ').slice(0, 19) : '');

export default function HistoryView() {
  const { model } = useConfig();
  const configId = model?.meta.id;
  const [runs, setRuns] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!configId) return;
    setRuns(await getServices().history.list(configId));
  }, [configId]);

  // Initial load: fetch in a callback (not a synchronous effect setState).
  useEffect(() => {
    let alive = true;
    if (configId) getServices().history.list(configId).then((r) => { if (alive) setRuns(r); });
    return () => { alive = false; };
  }, [configId]);

  const clear = async () => {
    await getServices().history.clear(configId);
    setOpenId(null);
    load();
  };

  return (
    <section className="editor">
      <header className="editor__head editor__head--row">
        <div>
          <h1 className="editor__title">Execution history</h1>
          <p className="editor__subtitle">Past simulated runs for this config (stored locally).</p>
        </div>
        <div className="wtopbar__right">
          <button className="btn btn--ghost-dark" onClick={load}>Refresh</button>
          <button className="btn btn--danger" onClick={clear} disabled={!runs?.length}>Clear</button>
        </div>
      </header>

      {runs === null ? (
        <div className="placeholder">Loading…</div>
      ) : runs.length === 0 ? (
        <div className="emptyblock">No runs yet. Start one from the Run console.</div>
      ) : (
        <div className="histlist">
          {runs.map((r) => {
            const open = openId === r.runId;
            const ifaces = r.overrides?.interfaces?.length ?? 0;
            return (
              <div key={r.runId} className="histcard">
                <button className="histcard__head" onClick={() => setOpenId(open ? null : r.runId)}>
                  <span className={`pill ${STATUS_PILL[r.status]}`}>{r.status}</span>
                  <span className="histcard__time mono">{fmt(r.startedAt)}</span>
                  <span className="histcard__dur">{(r.durationMs / 1000).toFixed(2)}s</span>
                  <span className="muted">{ifaces} interface{ifaces === 1 ? '' : 's'}</span>
                  <span className="histcard__caret">{open ? '▾' : '▸'}</span>
                </button>
                {open && (
                  <div className="histcard__body">
                    <div className="histcard__stages">
                      {r.stages.map((s, i) => (
                        <span key={i} className={`stagetile stagetile--${s.status === 'ok' ? 'ok' : s.status}`}>
                          {s.interface}/{s.stage}
                        </span>
                      ))}
                    </div>
                    <ValidationResults report={r.validation} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

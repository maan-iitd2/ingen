//  Run Console (route element for /configs/:configId/run)
//
//  Composes the RunProvider and lays out the controls + live panels: stage timeline, log stream,
//  validation results. No backend execution — RunService.simulate drives everything (DESIGN §3).

import { RunProvider, useRun } from '../../state/RunContext.jsx';
import OverridesForm from './OverridesForm.jsx';
import StageTimeline from './StageTimeline.jsx';
import LogStream from './LogStream.jsx';
import ValidationResults from './ValidationResults.jsx';

const STATUS_PILL = {
  success: 'pill--ok', partial: 'pill--warn', failed: 'pill--err',
};

function Console() {
  const { status, events, record, start, cancel } = useRun();

  return (
    <section className="editor">
      <header className="editor__head editor__head--row">
        <div>
          <h1 className="editor__title">Run console</h1>
          <p className="editor__subtitle">Simulated execution — no backend. Logs and results are mocked.</p>
        </div>
        {record && (
          <span className={`pill ${STATUS_PILL[record.status]}`}>
            {record.status} · {(record.durationMs / 1000).toFixed(2)}s
          </span>
        )}
      </header>

      <OverridesForm running={status === 'running'} onRun={start} onCancel={cancel} />

      <div className="runpanel">
        <h2 className="runpanel__title">Stages</h2>
        <StageTimeline events={events} />
      </div>

      <div className="runpanel">
        <h2 className="runpanel__title">Logs</h2>
        <LogStream events={events} />
      </div>

      <div className="runpanel">
        <h2 className="runpanel__title">Validation results</h2>
        <ValidationResults report={record?.validation} />
      </div>
    </section>
  );
}

export default function RunConsole() {
  return (
    <RunProvider>
      <Console />
    </RunProvider>
  );
}

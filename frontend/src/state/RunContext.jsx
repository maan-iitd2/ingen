//  InGen Studio — RunContext
//
//  Scoped to the Run Console route. Owns the lifecycle of a (mock) execution so the console's child
//  panels — stage timeline, log stream, validation results — share one source of truth without prop
//  drilling. Calls RunService.simulate (streaming events) and, on completion, persists the record via
//  HistoryService. Reads the model from ConfigContext, so it stays in sync with the edited config.

/* eslint-disable react-refresh/only-export-components -- context module exports provider + hook together */
import { createContext, useContext, useState, useRef, useCallback } from 'react';

import { getServices } from '../services/index.js';
import { useConfig } from './ConfigContext.jsx';

const RunContext = createContext(null);

export function RunProvider({ children }) {
  const { model } = useConfig();
  const [status, setStatus] = useState('idle'); // idle | running | done
  const [events, setEvents] = useState([]);
  const [record, setRecord] = useState(null);
  const cancelRef = useRef(false);

  const start = useCallback(async (overrides = {}) => {
    if (!model || status === 'running') return;
    cancelRef.current = false;
    setStatus('running');
    setEvents([]);
    setRecord(null);

    const { run, history } = getServices();
    const result = await run.simulate(model, overrides, {
      onEvent: (e) => setEvents((prev) => [...prev, e]),
      isCancelled: () => cancelRef.current,
    });

    setRecord(result);
    setStatus('done');
    await history.add(result);
  }, [model, status]);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  return (
    <RunContext.Provider value={{ status, events, record, start, cancel }}>
      {children}
    </RunContext.Provider>
  );
}

export function useRun() {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error('useRun must be used within a RunProvider');
  return ctx;
}

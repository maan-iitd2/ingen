//  InGen Studio — ConfigContext (the document store)
//
//  Holds the single ConfigModel under edit and is the bridge between the UI and the data layer
//  built in Phase 0. Responsibilities:
//    - load the model by id from ConfigService (mock adapter → localStorage)
//    - expose pure updaters that replace the model immutably
//    - derive the live YAML (real serializer) and validation issues with useMemo
//    - autosave (debounced) back through ConfigService → real persistence + Saved/Unsaved/Saving pill
//
//  This is the ONLY place that calls the service for config I/O, so swapping the mock adapter for
//  the future HTTP adapter changes nothing here or in any consumer.

/* eslint-disable react-refresh/only-export-components -- context module intentionally exports its provider + hook together */
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';

import { getServices } from '../services/index.js';
import { modelToYaml } from '../serializers/index.js';
import { validateConfigModel, upsertInterface } from '../models/configModel.js';

/**
 * @typedef {Object} ConfigContextValue
 * @property {import('../models/types.js').ConfigModel | null} model
 * @property {string} status            'loading' | 'saved' | 'dirty' | 'saving' | 'error'
 * @property {string} yaml              live-serialized YAML of the current model
 * @property {import('../models/types.js').ConfigIssue[]} issues
 * @property {(updater: (m: any) => any) => void} updateModel
 * @property {(name: string, updater: (iface: any) => any) => void} updateInterface
 */

const ConfigContext = createContext(/** @type {ConfigContextValue} */ (null));

const SAVE_DEBOUNCE_MS = 600;

export function ConfigProvider({ configId, children }) {
  const [model, setModel] = useState(null);
  const [status, setStatus] = useState('loading');
  const saveTimer = useRef(null);

  // Load the config. The provider is mounted with key={configId} (see ConfigWorkspace), so a
  // different config remounts this with fresh 'loading'/null state — no synchronous reset needed.
  useEffect(() => {
    let alive = true;
    getServices()
      .config.get(configId)
      .then((m) => { if (alive) { setModel(m); setStatus('saved'); } })
      .catch(() => { if (alive) setStatus('error'); });
    return () => { alive = false; };
  }, [configId]);

  // Apply an immutable update and mark dirty.
  const updateModel = useCallback((updater) => {
    setModel((prev) => (prev ? updater(prev) : prev));
    setStatus('dirty');
  }, []);

  // Convenience for the common case of editing one interface.
  const updateInterface = useCallback((name, updater) => {
    updateModel((m) => {
      const current = m.interfacesByName[name];
      if (!current) return m;
      return upsertInterface(m, name, updater(current));
    });
  }, [updateModel]);

  // Debounced autosave (real persistence) on every dirty change.
  useEffect(() => {
    if (status !== 'dirty' || !model) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await getServices().config.update(model);
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [status, model]);

  // Derived, recomputed only when the model changes.
  const yaml = useMemo(() => (model ? modelToYaml(model) : ''), [model]);
  const issues = useMemo(() => (model ? validateConfigModel(model) : []), [model]);

  const value = useMemo(
    () => ({ model, status, yaml, issues, updateModel, updateInterface }),
    [model, status, yaml, issues, updateModel, updateInterface],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within a ConfigProvider');
  return ctx;
}

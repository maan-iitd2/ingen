//  InGen Studio — services barrel + locator
//
//  Components import `getServices()` and never touch adapters directly. The active backend mode is
//  read once from the Vite env (VITE_ADAPTER_MODE), defaulting to mock. This is the seam that makes
//  the mock→FastAPI swap a one-line config change.

import { ADAPTER_MODE } from '../models/constants.js';
import { buildServices } from '../adapters/index.js';

export { ConfigService } from './configService.js';
export { CatalogService } from './catalogService.js';
export { ValidationService } from './validationService.js';
export { RunService } from './runService.js';
export { HistoryService } from './historyService.js';

/** Resolve the configured adapter mode from the build env, defaulting to mock. */
function resolveMode() {
  // import.meta.env is provided by Vite; guard so the module is also usable in plain Node tests.
  const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
  return env?.VITE_ADAPTER_MODE ?? ADAPTER_MODE.MOCK;
}

/** @type {import('../adapters/index.js').ServiceSet | null} */
let _services = null;

/**
 * Lazily construct and memoize the service set for the current mode.
 * @returns {import('../adapters/index.js').ServiceSet}
 */
export function getServices() {
  if (!_services) _services = buildServices(resolveMode());
  return _services;
}

/** Test/util hook: force a specific service set (e.g. inject fakes) or reset memoization. */
export function setServices(services) {
  _services = services;
}

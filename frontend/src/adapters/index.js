//  InGen Studio — adapter selection (the one swap point)
//
//  `buildServices(mode)` returns the concrete service set for a given backend mode. Today only the
//  mock set exists. When the FastAPI wrapper lands, add an `http` branch that constructs Http*
//  adapters implementing the same service interfaces — every caller keeps working unchanged.

import { ADAPTER_MODE } from '../models/constants.js';
import { MockConfigAdapter } from './mockConfigAdapter.js';
import { MockCatalogAdapter } from './mockCatalogAdapter.js';
import { MockValidationAdapter } from './mockValidationAdapter.js';
import { MockRunAdapter } from './mockRunAdapter.js';
import { MockHistoryAdapter } from './mockHistoryAdapter.js';

/**
 * @typedef {Object} ServiceSet
 * @property {import('../services/configService.js').ConfigService} config
 * @property {import('../services/catalogService.js').CatalogService} catalog
 * @property {import('../services/validationService.js').ValidationService} validation
 * @property {import('../services/runService.js').RunService} run
 * @property {import('../services/historyService.js').HistoryService} history
 */

/**
 * @param {string} [mode] one of ADAPTER_MODE.*; defaults to MOCK.
 * @returns {ServiceSet}
 */
export function buildServices(mode = ADAPTER_MODE.MOCK) {
  switch (mode) {
    case ADAPTER_MODE.MOCK: {
      const validation = new MockValidationAdapter();
      return {
        config: new MockConfigAdapter(),
        catalog: new MockCatalogAdapter(),
        validation,
        run: new MockRunAdapter(validation), // run reuses the same validation service
        history: new MockHistoryAdapter(),
      };
    }
    case ADAPTER_MODE.HTTP:
      // Future: construct Http* adapters (same interfaces) pointing at the FastAPI wrapper.
      throw new Error('HTTP adapter not implemented yet (FastAPI wrapper is a future phase).');
    default:
      throw new Error(`Unknown adapter mode "${mode}"`);
  }
}

//  InGen Studio — ConfigModel
//
//  Pure, framework-free helpers that create, mutate, normalize, and validate the normalized
//  ConfigModel. No React, no I/O. Every function is a pure transform (returns a new model) so it
//  can be driven by a reducer later and unit-tested in isolation.

import {
  CONFIG_MODEL_VERSION,
  RUN_CONFIG_DEFAULTS,
  SOURCE_TYPES,
  OUTPUT_TYPES,
} from './constants.js';
import { makeId } from '../utils/id.js';

/** @typedef {import('./types.js').ConfigModel} ConfigModel */
/** @typedef {import('./types.js').Source} Source */
/** @typedef {import('./types.js').Interface} Interface */
/** @typedef {import('./types.js').ConfigIssue} ConfigIssue */

/**
 * Create an empty, valid ConfigModel.
 * @param {{id?: string, name?: string}} [opts]
 * @returns {ConfigModel}
 */
export function createEmptyConfig(opts = {}) {
  const now = new Date().toISOString();
  return {
    meta: {
      id: opts.id ?? makeId('cfg'),
      name: opts.name ?? 'Untitled config',
      version: CONFIG_MODEL_VERSION,
      createdAt: now,
      updatedAt: now,
    },
    run_config: { ...RUN_CONFIG_DEFAULTS },
    sourcesById: {},
    sourceOrder: [],
    interfacesByName: {},
    interfaceOrder: [],
  };
}

/** Shallow-clone a model and stamp updatedAt. Internal helper for all mutators. */
function touch(model) {
  return {
    ...model,
    meta: { ...model.meta, updatedAt: new Date().toISOString() },
  };
}

// ───────────────────────── Sources ─────────────────────────

/**
 * Add or replace a source. The source's `id` is the map key and the order key.
 * @param {ConfigModel} model
 * @param {Source} source
 * @returns {ConfigModel}
 */
export function upsertSource(model, source) {
  if (!source?.id) throw new Error('Source requires an id');
  const next = touch(model);
  next.sourcesById = { ...model.sourcesById, [source.id]: source };
  next.sourceOrder = model.sourceOrder.includes(source.id)
    ? [...model.sourceOrder]
    : [...model.sourceOrder, source.id];
  return next;
}

/**
 * Remove a source by id (does not rewrite interfaces that still reference it — validation surfaces that).
 * @param {ConfigModel} model
 * @param {string} sourceId
 * @returns {ConfigModel}
 */
export function removeSource(model, sourceId) {
  const next = touch(model);
  next.sourcesById = { ...model.sourcesById };
  delete next.sourcesById[sourceId];
  next.sourceOrder = model.sourceOrder.filter((id) => id !== sourceId);
  return next;
}

// ───────────────────────── Interfaces ─────────────────────────

/** @returns {Interface} an empty interface skeleton. */
export function createEmptyInterface() {
  return { sources: [], pre_processing: [], columns: [], post_processing: [], output: {} };
}

/**
 * Add or replace an interface under `name`. Order is preserved/appended — it is YAML-significant
 * for rawdatastore producer/consumer chains (DESIGN.md §0).
 * @param {ConfigModel} model
 * @param {string} name
 * @param {Interface} iface
 * @returns {ConfigModel}
 */
export function upsertInterface(model, name, iface) {
  if (!name) throw new Error('Interface requires a name');
  const next = touch(model);
  next.interfacesByName = { ...model.interfacesByName, [name]: iface };
  next.interfaceOrder = model.interfaceOrder.includes(name)
    ? [...model.interfaceOrder]
    : [...model.interfaceOrder, name];
  return next;
}

/**
 * Remove an interface by name.
 * @param {ConfigModel} model
 * @param {string} name
 * @returns {ConfigModel}
 */
export function removeInterface(model, name) {
  const next = touch(model);
  next.interfacesByName = { ...model.interfacesByName };
  delete next.interfacesByName[name];
  next.interfaceOrder = model.interfaceOrder.filter((n) => n !== name);
  return next;
}

/**
 * Reorder interfaces. Pass the full new order (must be a permutation of existing names).
 * @param {ConfigModel} model
 * @param {string[]} newOrder
 * @returns {ConfigModel}
 */
export function reorderInterfaces(model, newOrder) {
  const known = new Set(model.interfaceOrder);
  const valid = newOrder.length === known.size && newOrder.every((n) => known.has(n));
  if (!valid) throw new Error('reorderInterfaces requires a permutation of existing interface names');
  const next = touch(model);
  next.interfaceOrder = [...newOrder];
  return next;
}

// ───────────────────────── Validation (no execution) ─────────────────────────

/**
 * Cross-reference + structural checks that need no pipeline run. Mirrors the integrity rules the
 * backend relies on (resolved by MetaDataParser / SourceFactory) plus the declaration-order hazard
 * for rawdatastore documented in DESIGN.md §0.
 *
 * @param {ConfigModel} model
 * @returns {ConfigIssue[]}
 */
export function validateConfigModel(model) {
  /** @type {ConfigIssue[]} */
  const issues = [];

  if (model.interfaceOrder.length === 0) {
    issues.push({ level: 'warning', code: 'NO_INTERFACES', message: 'Config has no interfaces.' });
  }

  // Track which rawdatastore ids have been produced so far, in declaration order.
  const producedSoFar = new Set();

  model.interfaceOrder.forEach((name, idx) => {
    const iface = model.interfacesByName[name];
    const path = `interfacesByName.${name}`;

    // Every referenced source id must exist (as a defined source OR as a rawdatastore produced earlier).
    (iface.sources ?? []).forEach((sid, i) => {
      const defined = Boolean(model.sourcesById[sid]);
      const producedEarlier = producedSoFar.has(sid);
      if (!defined && !producedEarlier) {
        issues.push({
          level: 'error',
          code: 'UNKNOWN_SOURCE_REF',
          message: `Interface "${name}" references source "${sid}" which is not defined.`,
          path: `${path}.sources[${i}]`,
        });
      }
      // rawdatastore consumed before any interface produced it → runtime failure (order matters).
      const src = model.sourcesById[sid];
      if (src?.type === SOURCE_TYPES.RAWDATASTORE && !producedEarlier) {
        issues.push({
          level: 'warning',
          code: 'RAWDATASTORE_ORDER',
          message:
            `Interface "${name}" reads rawdatastore "${sid}" before any earlier interface writes it. ` +
            `InGen runs interfaces in declaration order; move the producer above "${name}".`,
          path: `${path}.sources[${i}]`,
        });
      }
    });

    // Record any rawdatastore this interface PRODUCES (output.type === rawdatastore).
    const out = iface.output;
    if (out && out.type === OUTPUT_TYPES.RAWDATASTORE && !Array.isArray(out.props)) {
      const producedId = out.props?.id;
      if (producedId) producedSoFar.add(producedId);
    }

    void idx;
  });

  return issues;
}

/** Convenience: true when there are no error-level issues. */
export function isConfigValid(model) {
  return validateConfigModel(model).every((i) => i.level !== 'error');
}

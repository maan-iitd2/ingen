//  InGen Studio — seed config
//
//  A realistic ConfigModel built entirely with the existing model helpers, so the Interface Editor
//  has meaningful data to render on first load. It exercises: two source types (file + mysql), a
//  pre-processing step, columns with formatters, and a rawdatastore producer→consumer chain across
//  two interfaces declared in the correct order. `ensureSeed` writes it via the mock adapter the
//  first time the app runs.

import {
  createEmptyConfig,
  upsertSource,
  upsertInterface,
} from '../models/configModel.js';
import { getServices } from '../services/index.js';

const SEED_ID = 'cfg_positions_eod';

/** Build the seed ConfigModel (pure; no persistence). */
export function buildSeedConfig() {
  let m = createEmptyConfig({ id: SEED_ID, name: 'Positions EOD' });

  m = upsertSource(m, {
    id: 'restrictions',
    type: 'file',
    file_type: 'excel',
    file_path: 'data/restrictions_$date(%Y%m%d).xlsx',
    sheet_name: 'restrictions',
    columns: ['cusip', 'account', 'restricted'],
  });

  m = upsertSource(m, {
    id: 'trades_db',
    type: 'mysql',
    db_token: 'trades_eod',
    query: 'SELECT account, cusip, face, status, trade_date FROM positions WHERE trade_date = {date}',
  });

  // rawdatastore frame produced by `positions`, consumed by `positions_report`.
  m = upsertSource(m, { id: 'DF_POSITIONS', type: 'rawdatastore' });

  // Interface 1 — joins the two raw sources, formats, writes to the in-memory store.
  m = upsertInterface(m, 'positions', {
    sources: ['trades_db', 'restrictions'],
    pre_processing: [
      { type: 'merge', source: 'restrictions', left_key: 'cusip', right_key: 'cusip', merge_type: 'left' },
      { type: 'not_equals_filter', cols: [{ col: 'status', val: ['CLOSED'] }] },
    ],
    columns: [
      { src_col_name: 'account', dest_col_name: 'ACCOUNT' },
      { src_col_name: 'cusip', dest_col_name: 'CUSIP' },
      {
        src_col_name: 'face',
        dest_col_name: 'FACE VALUE',
        formatters: [{ type: 'float', format: '${:,.2f}' }],
      },
      {
        src_col_name: 'trade_date',
        dest_col_name: 'TRADE DATE',
        formatters: [{ type: 'date', format: { src: '%Y-%m-%d', des: '%m/%d/%Y' } }],
      },
    ],
    output: { type: 'rawdatastore', props: { id: 'DF_POSITIONS' } },
  });

  // Interface 2 — reads the produced frame and writes the delivered CSV.
  m = upsertInterface(m, 'positions_report', {
    sources: ['DF_POSITIONS'],
    columns: [
      { src_col_name: 'ACCOUNT' },
      { src_col_name: 'CUSIP' },
      { src_col_name: 'FACE VALUE' },
    ],
    output: {
      type: 'delimited_file',
      props: {
        delimiter: ',',
        path: 'out/positions_report_$date(%Y%m%d).csv',
        header: { type: 'delimited_result_header' },
      },
    },
  });

  return m;
}

/**
 * Ensure at least the seed config exists in storage. Idempotent — safe to call on every boot.
 * @returns {Promise<string>} the seed config id (handy for redirecting on first load).
 */
export async function ensureSeed() {
  const { config } = getServices();
  const existing = await config.list();
  if (!existing.some((c) => c.id === SEED_ID)) {
    await config.create(buildSeedConfig());
  }
  return SEED_ID;
}

export { SEED_ID };

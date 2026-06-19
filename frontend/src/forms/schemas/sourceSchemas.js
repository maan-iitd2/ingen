//  Field descriptors for each source type. Derived from ingen/data_source + docs/config_reference.
//  `id` and `type` are handled by the SourcesEditor outside SchemaForm (id is the key; type the
//  discriminator). These schemas cover the type-specific body.

import { FILE_TYPES } from '../../models/constants.js';

const FILE = [
  { key: 'file_type', label: 'File type', kind: 'select', options: Object.values(FILE_TYPES) },
  { key: 'file_path', label: 'File path', kind: 'text', placeholder: 'data/file_$date(%Y%m%d).csv' },
  { key: 'delimiter', label: 'Delimiter', kind: 'text', placeholder: ',' },
  { key: 'columns', label: 'Columns', kind: 'tags' },
  { key: 'sheet_name', label: 'Sheet name (excel)', kind: 'text' },
  { key: 'root_tag', label: 'Root tag (xml)', kind: 'text' },
  { key: 'record_path', label: 'Record path (json)', kind: 'text' },
  { key: 'skip_header_size', label: 'Skip header rows', kind: 'number' },
  { key: 'skip_trailer_size', label: 'Skip trailer rows', kind: 'number' },
  { key: 'use_infile', label: 'Use --infile override', kind: 'toggle' },
  { key: 'return_empty_if_not_exist', label: 'Empty frame if missing', kind: 'toggle' },
];

const MYSQL = [
  { key: 'db_token', label: 'DB token', kind: 'text' },
  { key: 'query', label: 'SQL query', kind: 'textarea', rows: 4, placeholder: 'SELECT ... WHERE date = {date}' },
];

const API = [
  { key: 'url', label: 'Base URL', kind: 'text' },
  { key: 'method', label: 'Method', kind: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
  { key: 'headers', label: 'Headers', kind: 'json', rows: 3 },
  { key: 'request_body', label: 'Request body', kind: 'textarea', rows: 3 },
  { key: 'auth', label: 'Auth', kind: 'group', fields: [
    { key: 'type', label: 'Type', kind: 'text', placeholder: 'BasicAuth' },
    { key: 'username', label: 'Username/token', kind: 'text' },
    { key: 'pwd', label: 'Password/token', kind: 'text' },
  ] },
  { key: 'data_node', label: 'data_node', kind: 'tags' },
  { key: 'data_key', label: 'data_key', kind: 'tags' },
  { key: 'batch', label: 'Batch', kind: 'group', fields: [
    { key: 'size', label: 'Size', kind: 'number' },
    { key: 'id', label: 'Batch id', kind: 'text' },
  ] },
  { key: 'url_params', label: 'URL params', kind: 'json', rows: 3 },
  { key: 'retries', label: 'Retries', kind: 'number' },
  { key: 'interval', label: 'Interval (s)', kind: 'number' },
  { key: 'success_criteria', label: 'Success criteria', kind: 'text' },
  { key: 'criteria_option', label: 'Criteria option', kind: 'json', rows: 2 },
  { key: 'queue_size', label: 'Queue size', kind: 'number' },
  { key: 'tasks_len', label: 'Concurrent tasks', kind: 'number' },
];

// json + rawdatastore have no body fields (payload/frame supplied at runtime / in-memory).
const NONE = [];

const SCHEMAS = { file: FILE, mysql: MYSQL, api: API, json: NONE, rawdatastore: NONE };

export function sourceSchema(type) {
  return SCHEMAS[type] ?? [];
}

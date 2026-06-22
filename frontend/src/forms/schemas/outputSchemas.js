//  Output `props` descriptors for all writer types supported by the InGen backend.
//  Derived from ingen/writer/ — InterfaceWriter (delimited_file, excel, json),
//  JsonWriter (json_writer), and SplitFileWriter (splitted_file).
//  output.type is the discriminator; these schemas cover the output.props body.

const HEADER_FIELD = {
  key: 'header', label: 'Header', kind: 'group', fields: [
    { key: 'type', label: 'Type', kind: 'select', options: ['delimited_result_header', 'custom'] },
  ],
};

export const OUTPUT_SCHEMAS = {
  delimited_file: {
    label: 'Delimited file',
    schema: [
      { key: 'path', label: 'Path', kind: 'text', placeholder: 'out/file_$date(%Y%m%d).csv' },
      { key: 'delimiter', label: 'Delimiter', kind: 'text', placeholder: ',' },
      { key: 'encoding', label: 'Encoding', kind: 'text', placeholder: 'utf-8' },
      HEADER_FIELD,
      { key: 'footer', label: 'Footer', kind: 'group', fields: [
        { key: 'type', label: 'Type', kind: 'text', placeholder: 'custom' },
        { key: 'function', label: 'Function path', kind: 'text', placeholder: 'my.module.footer_fn' },
      ] },
    ],
  },

  excel: {
    label: 'Excel',
    schema: [
      { key: 'path', label: 'Path', kind: 'text', placeholder: 'out/report_$date(%Y%m%d).xlsx' },
      { key: 'sheet_name', label: 'Sheet name', kind: 'text', placeholder: 'Sheet1' },
      HEADER_FIELD,
    ],
  },

  json: {
    label: 'JSON (legacy writer)',
    schema: [
      { key: 'path', label: 'Path', kind: 'text', placeholder: 'out/file.json' },
      { key: 'config', label: 'Write config', kind: 'json', rows: 3, help: '{ "orient": "records", "indent": 2 }' },
    ],
  },

  json_writer: {
    label: 'JSON writer',
    schema: [
      { key: 'destination', label: 'Destination', kind: 'select', options: ['file', 'api'], help: 'Where to write the JSON output' },
      { key: 'destination_props', label: 'Destination props', kind: 'group', fields: [
        { key: 'path', label: 'File path', kind: 'text', placeholder: 'out/file.json', help: 'Required when destination = file' },
        { key: 'url', label: 'API URL', kind: 'text', help: 'Required when destination = api' },
        { key: 'method', label: 'HTTP method', kind: 'select', options: ['POST', 'PUT', 'PATCH'] },
        { key: 'headers', label: 'Headers', kind: 'json', rows: 2 },
      ] },
    ],
  },

  rawdatastore: {
    label: 'Rawdatastore (in-memory)',
    schema: [
      { key: 'id', label: 'Frame id', kind: 'text', help: 'Consumed by another interface declared after this one as a rawdatastore source. Interfaces run in YAML declaration order.' },
    ],
  },

  splitted_file: {
    label: 'Splitted file',
    schema: [
      { key: 'path', label: 'Output directory', kind: 'text', placeholder: 'out/splits/', help: 'Files are written as <directory>/<split_col_value>.<ext>' },
      { key: 'split_col', label: 'Split column', kind: 'text', help: 'Each unique value in this column produces a separate file' },
      { key: 'delimiter', label: 'Delimiter', kind: 'text', placeholder: ',' },
      { key: 'encoding', label: 'Encoding', kind: 'text', placeholder: 'utf-8' },
      HEADER_FIELD,
    ],
  },
};

export const OUTPUT_TYPE_OPTIONS = Object.keys(OUTPUT_SCHEMAS);

export function outputSchema(type) {
  return OUTPUT_SCHEMAS[type]?.schema ?? [];
}

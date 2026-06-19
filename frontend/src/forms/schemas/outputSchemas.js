//  Output `props` descriptors for the four MVP writer types (delimited_file, excel, json,
//  rawdatastore). These edit output.props; output.type is the discriminator chosen separately.
//  json_writer/splitted_file are intentionally out of MVP scope.

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
    ],
  },
  excel: {
    label: 'Excel',
    schema: [
      { key: 'path', label: 'Path', kind: 'text', placeholder: 'out/file.xlsx' },
      HEADER_FIELD,
    ],
  },
  json: {
    label: 'JSON (legacy writer)',
    schema: [
      { key: 'path', label: 'Path', kind: 'text', placeholder: 'out/file.json' },
      { key: 'config', label: 'Config', kind: 'json', rows: 4, help: '{ "orient": "records", "indent": 2 }' },
    ],
  },
  rawdatastore: {
    label: 'Rawdatastore (in-memory)',
    schema: [
      { key: 'id', label: 'Frame id', kind: 'text', help: 'consumed by another interface as a rawdatastore source' },
    ],
  },
};

export const OUTPUT_TYPE_OPTIONS = Object.keys(OUTPUT_SCHEMAS);

export function outputSchema(type) {
  return OUTPUT_SCHEMAS[type]?.schema ?? [];
}

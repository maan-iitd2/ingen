//  Formatter `format` descriptors. Each entry is a SchemaForm field array operating on the formatter
//  object { type, format }. Curated for the common formatters; everything else falls back to a raw
//  JSON/text `format` editor so all ~40 registry types remain selectable AND configurable.

const txt = (placeholder) => [{ key: 'format', label: 'format', kind: 'text', placeholder }];
const none = [];
const jsonFmt = (rows = 2, help) => [{ key: 'format', label: 'format', kind: 'json', rows, help }];
const group = (fields) => [{ key: 'format', label: 'format', kind: 'group', fields }];

const FORMATTER_FORMS = {
  date: group([
    { key: 'src', label: 'Source format', kind: 'text', placeholder: '%Y-%m-%d' },
    { key: 'des', label: 'Output format', kind: 'text', placeholder: '%m/%d/%Y' },
  ]),
  float: txt('${:,.2f}'),
  float_precision: group([{ key: 'precision', label: 'Precision', kind: 'number' }]),
  constant: txt('value'),
  'constant-date': jsonFmt(2, '[offset, "%Y-%m-%d", "EMPTY"]'),
  duplicate: txt('existing column'),
  override: txt('override param key'),
  concat: group([
    { key: 'columns', label: 'Columns', kind: 'tags' },
    { key: 'separator', label: 'Separator', kind: 'text' },
  ]),
  replace_value: group([
    { key: 'from_value', label: 'From values', kind: 'tags' },
    { key: 'to_value', label: 'To values', kind: 'tags' },
  ]),
  sub_string: group([
    { key: 'start', label: 'Start', kind: 'number' },
    { key: 'end', label: 'End', kind: 'number' },
  ]),
  arithmetic_calc: group([
    { key: 'cols', label: 'Columns', kind: 'tags' },
    { key: 'value', label: 'Constant value', kind: 'number' },
    { key: 'operation', label: 'Operation', kind: 'select', options: ['add', 'sub', 'mul', 'div', 'abs'] },
  ]),
  bucket: group([
    { key: 'buckets', label: 'Buckets', kind: 'json', rows: 1, help: '[0, 365, "inf"]' },
    { key: 'labels', label: 'Labels', kind: 'tags' },
    { key: 'include_right', label: 'Include right edge', kind: 'toggle' },
  ]),
  prefix_string: group([
    { key: 'columns', label: 'Columns', kind: 'tags' },
    { key: 'prefix', label: 'Prefix', kind: 'text' },
  ]),
  suffix_string: group([
    { key: 'columns', label: 'Columns', kind: 'tags' },
    { key: 'suffix', label: 'Suffix', kind: 'text' },
  ]),
  sum: [{ key: 'format', label: 'Columns to sum', kind: 'tags' }],
  uuid: none,
  encryption: none,
  decryption: none,
};

/** @returns {Array} SchemaForm fields for the given formatter type (raw JSON fallback otherwise). */
export function formatterSchema(type) {
  return FORMATTER_FORMS[type] ?? jsonFmt(2, 'format value for this formatter');
}

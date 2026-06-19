//  Field descriptors for each pre-processor type (corrected against ingen/pre_processor source).
//  `source`/`masking_source` selects resolve their options from ctx.sources (sibling source ids).

const MERGE_TYPES = ['inner', 'left', 'right'];

export const PRE_PROCESSOR_SCHEMAS = {
  merge: {
    label: 'Merge',
    schema: [
      { key: 'source', label: 'Right source', kind: 'select', optionsFrom: 'sources' },
      { key: 'left_key', label: 'Left key', kind: 'text' },
      { key: 'right_key', label: 'Right key', kind: 'text' },
      { key: 'merge_type', label: 'Merge type', kind: 'select', options: MERGE_TYPES },
    ],
  },
  outer_join: {
    label: 'Outer join',
    schema: [
      { key: 'source', label: 'Right source', kind: 'select', optionsFrom: 'sources' },
      { key: 'left_key', label: 'Left key', kind: 'text' },
      { key: 'right_key', label: 'Right key', kind: 'text' },
    ],
  },
  union: {
    label: 'Union',
    schema: [{ key: 'source', label: 'Sources', kind: 'tags', help: 'source ids to concatenate' }],
  },
  aggregate: {
    label: 'Aggregate',
    schema: [
      { key: 'groupby', label: 'Group by', kind: 'group', fields: [
        { key: 'cols', label: 'Columns', kind: 'tags' },
      ] },
      { key: 'agg', label: 'Aggregation', kind: 'group', fields: [
        { key: 'operation', label: 'Operation', kind: 'select', options: ['sum', 'count', 'min', 'max', 'mean'] },
        { key: 'col', label: 'Column', kind: 'text' },
      ] },
    ],
  },
  mask: {
    label: 'Mask',
    schema: [
      { key: 'on_col', label: 'On column', kind: 'text' },
      { key: 'masking_source', label: 'Masking source', kind: 'select', optionsFrom: 'sources' },
      { key: 'masking_col', label: 'Masking column', kind: 'text' },
    ],
  },
  melt: {
    label: 'Melt',
    schema: [
      { key: 'key_column', label: 'Key column', kind: 'text' },
      { key: 'value_column', label: 'Value column', kind: 'text' },
      { key: 'include_keys', label: 'Include keys', kind: 'tags' },
      { key: 'source', label: 'Source', kind: 'tags' },
    ],
  },
  filter: {
    label: 'Filter',
    schema: [
      { key: 'operator', label: 'Operator', kind: 'select', options: ['and', 'or'] },
      { key: 'cols', label: 'Conditions', kind: 'json', rows: 4, help: '[{ "col": "name", "val": ["x"] }]' },
    ],
  },
  not_equals_filter: {
    label: 'Not-equals filter',
    schema: [
      { key: 'source', label: 'Source (optional)', kind: 'select', optionsFrom: 'sources' },
      { key: 'cols', label: 'Exclusions', kind: 'json', rows: 4, help: '[{ "col": "status", "val": ["CLOSED"] }]' },
    ],
  },
  drop_duplicates: {
    label: 'Drop duplicates',
    schema: [
      { key: 'columns', label: 'Columns', kind: 'tags', help: 'subset; empty = all columns' },
      { key: 'keep', label: 'Keep', kind: 'select', options: [
        { value: 'first', label: 'first' }, { value: 'last', label: 'last' }, { value: 'false', label: 'none (false)' },
      ] },
    ],
  },
  json_array_expander: {
    label: 'JSON array expander',
    schema: [
      { key: 'config', label: 'Config', kind: 'group', fields: [
        { key: 'column', label: 'JSON column', kind: 'text' },
        { key: 'include_columns', label: 'Include columns', kind: 'json', rows: 2 },
        { key: 'exclude_columns', label: 'Exclude columns', kind: 'tags' },
      ] },
    ],
  },
};

export const PRE_PROCESSOR_ORDER = Object.keys(PRE_PROCESSOR_SCHEMAS);

export function preProcessorSchema(type) {
  return PRE_PROCESSOR_SCHEMAS[type]?.schema ?? [];
}

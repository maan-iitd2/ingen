// inFlow method demo: build the ConfigModel the node-creator produces, then emit YAML
// through the exact serializer InGen Studio uses. Run: node scripts/inflow_trial.mjs
import { rawConfigToModel } from '../src/serializers/yamlDeserializer.js';
import { modelToYaml } from '../src/serializers/yamlSerializer.js';

// What the inFlow sidebar nodes amount to: 2 file sources, a merge, a filter,
// column maps with a currency formatter, and a CSV output node.
const nodes = {
  sources: [
    { id: 'employees', type: 'file', file_type: 'delimited_file', delimiter: ',',
      file_path: 'sample-data/trial_employees.csv',
      columns: ['emp_id', 'name', 'dept', 'region'], skip_header_size: 1 },
    { id: 'salaries', type: 'file', file_type: 'delimited_file', delimiter: ',',
      file_path: 'sample-data/trial_salaries.csv',
      columns: ['emp_id', 'base_salary', 'bonus'], skip_header_size: 1 },
  ],
  interfaces: {
    eng_pay: {
      sources: ['employees', 'salaries'],
      pre_processing: [
        { type: 'merge', source: 'salaries', left_key: 'emp_id', right_key: 'emp_id', merge_type: 'left' },
        { type: 'filter', operator: 'and', cols: [{ col: 'dept', val: ['Engineering'] }] },
      ],
      columns: [
        { src_col_name: 'emp_id', dest_col_name: 'EMP_ID' },
        { src_col_name: 'name', dest_col_name: 'NAME' },
        { src_col_name: 'region', dest_col_name: 'REGION' },
        { src_col_name: 'base_salary', dest_col_name: 'BASE_SALARY',
          formatters: [{ type: 'float', format: '${:,.2f}' }] },
      ],
      output: {
        type: 'delimited_file',
        props: { delimiter: ',', path: 'sample-output/trial_out.csv',
          header: { type: 'delimited_result_header' } },
      },
    },
  },
};

// node-creator -> normalized model -> deterministic YAML (the inFlow method)
const model = rawConfigToModel(nodes);
process.stdout.write(modelToYaml(model));

import {
  buildDefaultReportParameterPayload,
  resolvePrintParameterDefaultValue,
} from './printParameterDefaults';

test('uses the SAP Crystal configured default value without prompting', () => {
  expect(resolvePrintParameterDefaultValue({
    defaultValue: 'Original for Buyers',
    options: [{ value: 'Duplicate', label: 'Duplicate' }],
  })).toBe('Original for Buyers');
});

test('falls back to the first valid SAP option when no explicit default exists', () => {
  expect(resolvePrintParameterDefaultValue({
    defaultValue: '',
    options: [
      { value: 'Original for Buyers', label: 'Original for Buyers' },
      { value: 'Duplicate', label: 'Duplicate' },
    ],
  })).toBe('Original for Buyers');
});

test('builds parameter values for every document type without user input', () => {
  expect(buildDefaultReportParameterPayload([
    {
      paramName: 'Enter Original For Buyers:',
      paramType: 'string',
      defaultValue: '',
      options: [{ value: 'Original for Buyers', label: 'Original for Buyers' }],
    },
    {
      paramName: 'Copies',
      paramType: 'number',
      value: 0,
    },
  ])).toEqual([
    {
      name: 'Enter Original For Buyers:',
      type: 'string',
      value: 'Original for Buyers',
    },
    {
      name: 'Copies',
      type: 'number',
      value: 0,
    },
  ]);
});

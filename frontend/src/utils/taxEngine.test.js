import { determineTaxCode, normalizeTaxCodeSelection } from './taxEngine';

describe('taxEngine', () => {
  const taxCodes = [
    { Code: 'CGST9', Name: 'CGST 9%', Rate: 9, GSTType: 'INTRASTATE' },
    { Code: 'SGST9', Name: 'SGST 9%', Rate: 9, GSTType: 'INTRASTATE' },
    { Code: 'IGST18', Name: 'IGST 18%', Rate: 18, GSTType: 'INTERSTATE' },
    { Code: 'EXEMPT', Name: 'Exempt', Rate: 0, GSTType: 'OTHER' },
  ];

  test('does not assign a tax code to non-GST items', () => {
    expect(determineTaxCode(
      { ItemCode: 'NONGST', TaxCodeAR: '', GSTRelevnt: 'tNO' },
      'GJ',
      'GJ',
      false,
      'GJ',
      taxCodes,
    )).toBe('');
  });

  test('keeps GST mapping for GST-relevant items', () => {
    expect(determineTaxCode(
      { ItemCode: 'GSTITEM', TaxCodeAR: '18-GST', GSTRelevnt: 'tYES' },
      'GJ',
      'GJ',
      false,
      'GJ',
      taxCodes,
    )).toBe('CGST9');
  });

  test('does not preserve a zero-rated GST code for non-GST items', () => {
    expect(determineTaxCode(
      { ItemCode: 'NONGST0', TaxCodeAR: '0-GST', GSTRelevnt: 'tNO' },
      'GJ',
      'GJ',
      false,
      'GJ',
      taxCodes,
    )).toBe('');
  });

  test('clears manual GST selections for non-GST items', () => {
    expect(normalizeTaxCodeSelection('0-GST', { GSTRelevnt: 'tNO' })).toBe('');
  });

  test('preserves zero-rated GST codes for GST-relevant items', () => {
    expect(normalizeTaxCodeSelection('0-GST', { GSTRelevnt: 'tYES' })).toBe('0-GST');
  });
});

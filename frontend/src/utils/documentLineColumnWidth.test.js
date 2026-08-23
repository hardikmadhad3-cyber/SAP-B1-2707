import { getReadableDocumentLineColumnWidth } from './documentLineColumnWidth';

test('uses semantic and input-type minimums instead of narrow SAP widths', () => {
  expect(getReadableDocumentLineColumnWidth(
    { key: 'itemDescription', label: 'Item Description', width: 40 },
    { minWidth: 240 },
  )).toBe(240);

  expect(getReadableDocumentLineColumnWidth(
    { key: 'hsnCode', label: 'HSN', width: 30 },
  )).toBe(115);

  expect(getReadableDocumentLineColumnWidth(
    { key: 'quantity', label: 'Quantity', width: 35, type: 'number' },
  )).toBe(95);
});

test('keeps the line-number column compact', () => {
  expect(getReadableDocumentLineColumnWidth(
    { key: '__lineNumber', label: '#', width: 20 },
  )).toBe(42);
});

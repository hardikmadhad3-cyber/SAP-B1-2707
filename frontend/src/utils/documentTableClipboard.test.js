import {
  applyDocumentTablePaste,
  buildDocumentTablePaste,
  clipboardHasMatchingHeaders,
  parseClipboardTable,
  serializeDocumentTable,
} from './documentTableClipboard';

const columns = [
  { key: 'itemNo', label: 'Item No.' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'total', label: 'Total', readOnly: true },
  { key: 'U_Quality', label: 'Quality', isUdf: true },
];

test('serializes headers, visible row values, UDFs, and quoted tabular text', () => {
  expect(serializeDocumentTable({
    columns,
    rows: [{ itemNo: 'A-1', quantity: '2', total: '20', udf: { U_Quality: 'Fine\tGrade' } }],
  })).toBe('Item No.\tQuantity\tTotal\tQuality\r\nA-1\t2\t20\t"Fine\tGrade"');
});

test('parses Excel-compatible quoted tabs, quotes, and newlines', () => {
  expect(parseClipboardTable('Item\tText\r\nA1\t"hello\t""world""\nagain"\r\n')).toEqual([
    ['Item', 'Text'],
    ['A1', 'hello\t"world"\nagain'],
  ]);
});

test('detects and maps header paste while skipping blank and read-only cells', () => {
  const table = parseClipboardTable('quantity\tItem No.\tTotal\tUnknown\r\n3\tA-2\t99\tignored');
  expect(clipboardHasMatchingHeaders(table, columns)).toBe(true);
  expect(buildDocumentTablePaste({ table, columns, headerMode: true })).toEqual([{
    rowOffset: 0,
    cells: [
      { key: 'quantity', value: '3', isUdf: false },
      { key: 'itemNo', value: 'A-2', isUdf: false },
    ],
  }]);
});

test('always skips calculated document columns even when layout metadata omitted readOnly', () => {
  const table = parseClipboardTable('Item No.\tTotal (LC)\r\nA-5\t500');
  expect(buildDocumentTablePaste({
    table,
    columns: [
      { key: 'itemNo', label: 'Item No.' },
      { key: 'totalLC', label: 'Total (LC)' },
    ],
    headerMode: true,
  })[0].cells).toEqual([{ key: 'itemNo', value: 'A-5', isUdf: false }]);
});

test('maps Price to the standard Unit Price before an identically named UDF', () => {
  const priceColumns = [
    { key: 'unitPrice', label: 'Unit Price' },
    { key: 'U_Price', label: 'Price', isUdf: true },
  ];
  const table = parseClipboardTable('Price\r\n3221.30');

  expect(clipboardHasMatchingHeaders(table, priceColumns)).toBe(true);
  expect(buildDocumentTablePaste({
    table,
    columns: priceColumns,
    headerMode: true,
  })[0].cells).toEqual([
    { key: 'unitPrice', value: '3221.30', isUdf: false },
  ]);
});

test('keeps a separate Price UDF when Unit Price and Price are both copied', () => {
  const table = parseClipboardTable('Unit Price\tPrice\r\n100\tUDF value');
  expect(buildDocumentTablePaste({
    table,
    columns: [
      { key: 'unitPrice', label: 'Unit Price' },
      { key: 'U_Price', label: 'Price', isUdf: true },
    ],
    headerMode: true,
  })[0].cells).toEqual([
    { key: 'unitPrice', value: '100', isUdf: false },
    { key: 'U_Price', value: 'UDF value', isUdf: true },
  ]);
});

test('pastes positionally from the selected column and appends initialized rows', () => {
  const table = parseClipboardTable('A-2\t4\r\nA-3\t');
  const patches = buildDocumentTablePaste({ table, columns, startColumnIndex: 0 });
  const result = applyDocumentTablePaste({
    lines: [{ itemNo: 'old', quantity: '1', udf: {} }],
    patches,
    startRowIndex: 0,
    createLine: () => ({ itemNo: '', quantity: '', branch: 'B1', udf: {} }),
  });

  expect(result).toEqual([
    { itemNo: 'A-2', quantity: '4', udf: {} },
    { itemNo: 'A-3', quantity: '', branch: 'B1', udf: {} },
  ]);
});

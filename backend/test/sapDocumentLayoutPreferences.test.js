const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findCprfStandardDefinition,
  findCprfUdfDefinition,
  getSalesDocumentCprfDefinitions,
  mergeDuplicateCprfLayoutColumns,
  selectEffectiveCprfRows,
} = require('../services/sapFormPreferenceUtils');

test('live CPRF selection does not mix personal settings with UI templates', () => {
  const rows = selectEffectiveCprfRows([
    { ColID: '1', TPLId: 0, VisInForm: 'Y', VisualIndx: 1 },
    { ColID: '1', TPLId: 7, VisInForm: 'N', VisualIndx: 20 },
    { ColID: '3', TPLId: 0, VisInForm: 'Y', VisualIndx: 2 },
  ]);

  assert.deepEqual(rows.map((row) => row.TPLId), [0, 0]);
  assert.deepEqual(rows.map((row) => row.VisualIndx), [1, 2]);
});

test('assigned SAP UI template is selected ahead of personal CPRF rows', () => {
  const rows = selectEffectiveCprfRows([
    { ColID: '160', TPLId: 0, VisInForm: 'N', VisualIndx: 20 },
    { ColID: '160', TPLId: 7, VisInForm: 'Y', VisualIndx: 6 },
    { ColID: '23', TPLId: 7, VisInForm: 'Y', VisualIndx: 7 },
    { ColID: '160', TPLId: 8, VisInForm: 'N', VisualIndx: 40 },
  ], { assignedTemplateIds: [7] });

  assert.deepEqual(rows.map((row) => row.TPLId), [7, 7]);
  assert.deepEqual(rows.map((row) => row.VisualIndx), [6, 7]);
});

test('document-specific CPRF IDs win over conflicting generic marketing IDs', () => {
  const preferredDefinitions = [
    { title: 'Tax Code', fieldName: 'TaxCode', sapColumnIds: ['160'] },
    { title: 'Total (Doc)', fieldName: 'LineTotal', sapColumnIds: ['23'] },
    { title: 'Whse', fieldName: 'WhsCode', sapColumnIds: ['24'] },
    { title: 'UoM Name', fieldName: 'unitMsr', sapColumnIds: ['1470002145'] },
  ];
  const fallbackDefinitions = [
    { title: 'Total (LC)', fieldName: 'LineTotal', sapColumnIds: ['160'] },
    { title: 'Weight', fieldName: 'Weight1', sapColumnIds: ['23'] },
    { title: 'Tax Amount (LC)', fieldName: 'VatSum', sapColumnIds: ['24'] },
    { title: 'UoM Code', fieldName: 'UomCode', sapColumnIds: ['1470002145'] },
  ];

  assert.equal(findCprfStandardDefinition({
    row: { ColID: '160' }, preferredDefinitions, fallbackDefinitions,
  }).fieldName, 'TaxCode');
  assert.equal(findCprfStandardDefinition({
    row: { ColID: '23' }, preferredDefinitions, fallbackDefinitions,
  }).title, 'Total (Doc)');
  assert.equal(findCprfStandardDefinition({
    row: { ColID: '24' }, preferredDefinitions, fallbackDefinitions,
  }).fieldName, 'WhsCode');
  assert.equal(findCprfStandardDefinition({
    row: { ColID: '1470002145' }, preferredDefinitions, fallbackDefinitions,
  }).fieldName, 'unitMsr');
});

test('Delivery and Sales Order standard CPRF IDs stay document-specific and preserve VisualIndx', () => {
  const deliveryDefinitions = getSalesDocumentCprfDefinitions('DELIVERY');
  const salesOrderDefinitions = getSalesDocumentCprfDefinitions('SALES_ORDER');
  const mapRows = (rows, definitions) => rows
    .map((row) => ({
      ...findCprfStandardDefinition({ row, preferredDefinitions: definitions }),
      columnOrder: row.VisualIndx,
    }))
    .sort((left, right) => left.columnOrder - right.columnOrder);

  assert.deepEqual(mapRows([
    { ColID: '160', VisualIndx: 6 },
    { ColID: '17', VisualIndx: 7 },
    { ColID: '174', VisualIndx: 8 },
    { ColID: '1470002149', VisualIndx: 9 },
    { ColID: '1470002145', VisualIndx: 10 },
  ], deliveryDefinitions).map(({ title, fieldName, columnOrder }) => ({ title, fieldName, columnOrder })), [
    { title: 'Tax Code', fieldName: 'TaxCode', columnOrder: 6 },
    { title: 'Total (LC)', fieldName: 'LineTotal', columnOrder: 7 },
    { title: 'Whse', fieldName: 'WhsCode', columnOrder: 8 },
    { title: 'UoM Code', fieldName: 'UomCode', columnOrder: 9 },
    { title: 'UoM Name', fieldName: 'unitMsr', columnOrder: 10 },
  ]);
  assert.equal(findCprfStandardDefinition({
    row: { ColID: '23' }, preferredDefinitions: deliveryDefinitions,
  }), null);
  assert.equal(findCprfStandardDefinition({
    row: { ColID: '24' }, preferredDefinitions: deliveryDefinitions,
  }), null);

  assert.deepEqual(mapRows([
    { ColID: '160', VisualIndx: 6 },
    { ColID: '23', VisualIndx: 7 },
    { ColID: '24', VisualIndx: 8 },
    { ColID: '1470002149', VisualIndx: 9 },
    { ColID: '1470002145', VisualIndx: 10 },
  ], salesOrderDefinitions).map(({ title, fieldName, columnOrder }) => ({ title, fieldName, columnOrder })), [
    { title: 'Tax Code', fieldName: 'TaxCode', columnOrder: 6 },
    { title: 'Total (Doc)', fieldName: 'TotalFrgn', columnOrder: 7 },
    { title: 'Whse', fieldName: 'WhsCode', columnOrder: 8 },
    { title: 'UoM Code', fieldName: 'UomCode', columnOrder: 9 },
    { title: 'UoM Name', fieldName: 'unitMsr', columnOrder: 10 },
  ]);
});

test('numeric CPRF ColID never matches an unrelated CUFD FieldID ordinal', () => {
  const udfDefinitions = [
    { key: 'U_MillName', aliasId: 'MillName', fieldId: 10, label: 'Mill-Name' },
  ];

  assert.equal(findCprfUdfDefinition({ ColID: '10' }, udfDefinitions), null);
  assert.equal(
    findCprfUdfDefinition({ ColID: 'U_MillName' }, udfDefinitions)?.key,
    'U_MillName'
  );
});

test('live CPRF merge keeps SAP-visible physical UDF over hidden generated UID', () => {
  const columns = mergeDuplicateCprfLayoutColumns([
    {
      columnUid: '10',
      fieldName: 'U_MillName',
      columnTitle: 'Mill-Name',
      visible: false,
      editable: true,
      columnOrder: 48,
      width: 120,
      isUdf: true,
    },
    {
      columnUid: 'U_MillName',
      fieldName: 'U_MillName',
      columnTitle: 'Mill-Name',
      visible: true,
      editable: true,
      columnOrder: 535,
      width: 73,
      isUdf: true,
    },
  ]);

  assert.equal(columns.length, 1);
  assert.equal(columns[0].columnUid, 'U_MillName');
  assert.equal(columns[0].visible, true);
  assert.equal(columns[0].editable, true);
});

test('live CPRF merge keeps the physical UDF preference over a numeric companion', () => {
  const columns = mergeDuplicateCprfLayoutColumns([
    {
      columnUid: 'U_LDS',
      fieldName: 'U_LDS',
      columnTitle: 'LDS',
      visible: true,
      editable: false,
      columnOrder: 20,
      width: 80,
      isUdf: true,
    },
    {
      columnUid: '19',
      fieldName: 'U_LDS',
      columnTitle: 'LDS',
      visible: true,
      editable: true,
      columnOrder: 27,
      width: 120,
      isUdf: true,
    },
  ]);

  assert.equal(columns.length, 1);
  assert.equal(columns[0].columnUid, 'U_LDS');
  assert.equal(columns[0].editable, false);
});

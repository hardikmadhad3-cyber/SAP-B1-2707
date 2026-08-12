'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDocumentSchema,
  buildSalesOrderSchema,
  createNewSalesOrderSchemaService,
} = require('../modules/newSalesOrder/newSalesOrderSchemaService');
const { DELIVERY_DOCUMENT } = require('../modules/newSalesOrder/newSalesOrderConstants');
const companyA = require('./fixtures/newSalesOrderCompanyA');
const companyB = require('./fixtures/newSalesOrderCompanyB');

const getField = (schema, id) => [...schema.headerFields, ...schema.lineFields]
  .find((field) => field.id === id);

test('builds an isolated Delivery schema from ODLN and DLN1 metadata', () => {
  const context = { ...companyA.context, companyDb: 'DELIVERY_COMPANY', companyId: 303 };
  const metadata = {
    dialect: 'sqlserver',
    physical: {
      ODLN: [
        { columnName: 'CardCode', databaseType: 'nvarchar', maxLength: 15, ordinal: 1 },
        { columnName: 'U_DeliveryRoute', databaseType: 'nvarchar', maxLength: 30, ordinal: 2 },
      ],
      DLN1: [
        { columnName: 'ItemCode', databaseType: 'nvarchar', maxLength: 50, ordinal: 1 },
        { columnName: 'U_LoadSequence', databaseType: 'int', ordinal: 2 },
      ],
    },
    udfs: {
      ODLN: [{ sapField: 'U_DeliveryRoute', aliasId: 'DeliveryRoute', label: 'Delivery Route', options: [] }],
      DLN1: [{ sapField: 'U_LoadSequence', aliasId: 'LoadSequence', label: 'Load Sequence', typeId: 'N', subType: '', options: [] }],
    },
    layout: [],
  };

  const schema = buildDocumentSchema({ context, metadata, rawDocument: DELIVERY_DOCUMENT });
  assert.equal(schema.documentType, 'DELIVERY');
  assert.equal(schema.objectType, '15');
  assert.equal(schema.headerTable, 'ODLN');
  assert.equal(schema.lineTable, 'DLN1');
  assert.equal(schema.companyDb, 'DELIVERY_COMPANY');
  assert.ok(getField(schema, 'ODLN.U_DeliveryRoute'));
  assert.equal(getField(schema, 'DLN1.U_LoadSequence').type, 'integer');
  assert.equal(schema.lineFields.some((field) => field.id.startsWith('RDR1.')), false);
});

test('normalizes Company A physical fields, CUFD, UFD1, and layout into one schema', () => {
  const schema = buildSalesOrderSchema({ context: companyA.context, metadata: companyA.metadata });

  assert.equal(schema.documentType, 'SALES_ORDER');
  assert.equal(schema.objectType, '17');
  assert.equal(schema.companyId, 101);
  assert.equal(schema.companyDb, 'NSO_COMPANY_A');
  assert.equal(schema.userCode, 'manager_a');
  assert.match(schema.schemaVersion, /^nso-schema-v1-[a-f0-9]{24}$/);

  const packing = getField(schema, 'RDR1.U_PackingType');
  assert.equal(packing.storage, 'udf');
  assert.equal(packing.type, 'select');
  assert.equal(packing.renderer, 'select');
  assert.deepEqual(packing.options[0], { value: 'BOX', label: 'Box' });
  assert.equal(packing.lookup.source, 'udf-valid-values');

  const grossWeight = getField(schema, 'RDR1.U_GrossWt');
  assert.equal(grossWeight.type, 'number');
  assert.equal(grossWeight.precision, 19);
  assert.equal(grossWeight.scale, 6);
  assert.equal(grossWeight.step, '0.000001');

  const totalPackages = getField(schema, 'RDR1.U_TotalPackage');
  assert.equal(totalPackages.type, 'integer');
  assert.equal(totalPackages.required, true);

  const linked = getField(schema, 'RDR1.U_ContainerType');
  assert.equal(linked.type, 'lookup');
  assert.equal(linked.lookup.source, 'udf-linked-table');
  assert.equal(linked.lookup.fieldId, linked.id);
  assert.equal(linked.linkedTable, '@NSO_CONTAINER_TYPES');
});

test('Company schemas stay isolated and switching removes incompatible UDFs', () => {
  const schemaA = buildSalesOrderSchema({ context: companyA.context, metadata: companyA.metadata });
  const schemaB = buildSalesOrderSchema({ context: companyB.context, metadata: companyB.metadata });
  const idsA = new Set(schemaA.lineFields.map((field) => field.id));
  const idsB = new Set(schemaB.lineFields.map((field) => field.id));

  assert.equal(idsA.has('RDR1.U_GrossWt'), true);
  assert.equal(idsA.has('RDR1.U_Quality'), false);
  assert.equal(idsB.has('RDR1.U_GrossWt'), false);
  assert.equal(idsB.has('RDR1.U_TotalPackage'), false);
  assert.equal(idsB.has('RDR1.U_Quality'), true);
  assert.notEqual(schemaA.schemaVersion, schemaB.schemaVersion);

  assert.equal(getField(schemaB, 'RDR1.U_ExpectedDate').type, 'date');
  assert.equal(getField(schemaB, 'RDR1.U_Approved').type, 'checkbox');
  assert.equal(getField(schemaB, 'RDR1.U_Quality').lookup.source, 'udf-linked-table');
});

test('a newly added physical CUFD field appears without a registry or JSX change', () => {
  const metadata = structuredClone(companyA.metadata);
  metadata.physical.RDR1.push({
    columnName: 'U_NewCompanyField',
    databaseType: 'nvarchar',
    maxLength: 40,
    precision: null,
    scale: null,
    nullable: true,
    ordinal: 12,
  });
  metadata.udfs.RDR1.push({
    tableName: 'RDR1',
    fieldId: 5,
    aliasId: 'NewCompanyField',
    sapField: 'U_NewCompanyField',
    label: 'New Company Field',
    typeId: 'A',
    subType: '',
    maxLength: 40,
    required: false,
    readOnly: false,
    linkedTable: null,
    relUDO: null,
    defaultValue: null,
    options: [],
  });

  const schema = buildSalesOrderSchema({ context: companyA.context, metadata });
  const field = getField(schema, 'RDR1.U_NewCompanyField');
  assert.ok(field);
  assert.equal(field.sapField, 'U_NewCompanyField');
  assert.equal(field.stateKey, 'U_NewCompanyField');
  assert.equal(field.storage, 'udf');
  assert.equal(field.type, 'text');
});

test('standard semantic mappings use Service Layer properties but retain physical DB columns', () => {
  const schema = buildSalesOrderSchema({ context: companyA.context, metadata: companyA.metadata });
  const itemDescription = getField(schema, 'RDR1.Dscription');
  const warehouse = getField(schema, 'RDR1.WhsCode');

  assert.equal(itemDescription.stateKey, 'itemDescription');
  assert.equal(itemDescription.sapField, 'ItemDescription');
  assert.equal(itemDescription.databaseField, 'Dscription');
  assert.equal(warehouse.sapField, 'WarehouseCode');
  assert.equal(warehouse.lookup.source, 'warehouses');
});

test('RDR1 schema preserves SAP matrix layout order for standard layout-only fields', () => {
  const metadata = structuredClone(companyA.metadata);
  metadata.physical.RDR1.push(
    { columnName: 'GTotal', databaseType: 'decimal', maxLength: null, precision: 19, scale: 6, nullable: true, ordinal: 12 },
    { columnName: 'CountryOrg', databaseType: 'nvarchar', maxLength: 3, precision: null, scale: null, nullable: true, ordinal: 13 },
    { columnName: 'LocCode', databaseType: 'int', maxLength: null, precision: 10, scale: 0, nullable: true, ordinal: 14 },
    { columnName: 'ShipDate', databaseType: 'date', maxLength: null, precision: null, scale: null, nullable: true, ordinal: 15 },
    { columnName: 'TrnsCode', databaseType: 'int', maxLength: null, precision: 10, scale: 0, nullable: true, ordinal: 16 },
    { columnName: 'TaxOnly', databaseType: 'nvarchar', maxLength: 1, precision: null, scale: null, nullable: true, ordinal: 17 },
    { columnName: 'VatSum', databaseType: 'decimal', maxLength: null, precision: 19, scale: 6, nullable: true, ordinal: 18 },
    { columnName: 'OpenQty', databaseType: 'decimal', maxLength: null, precision: 19, scale: 6, nullable: true, ordinal: 19 },
  );
  metadata.layout = [
    { tableName: 'RDR1', columnUid: 'ItemCode', fieldName: 'ItemCode', columnTitle: 'Item No.', visible: 1, editable: 1, columnOrder: 1, width: 160 },
    { tableName: 'RDR1', columnUid: 'Dscription', fieldName: 'Dscription', columnTitle: 'Item Description', visible: 1, editable: 1, columnOrder: 2, width: 240 },
    { tableName: 'RDR1', columnUid: 'Quantity', fieldName: 'Quantity', columnTitle: 'Quantity', visible: 1, editable: 1, columnOrder: 3, width: 100 },
    { tableName: 'RDR1', columnUid: 'Price', fieldName: 'Price', columnTitle: 'Unit Price', visible: 1, editable: 1, columnOrder: 4, width: 110 },
    { tableName: 'RDR1', columnUid: 'VatGroup', fieldName: 'VatGroup', columnTitle: 'Tax Code', visible: 1, editable: 1, columnOrder: 5, width: 110 },
    { tableName: 'RDR1', columnUid: 'GTotal', fieldName: 'GTotal', columnTitle: 'Total (Doc)', visible: 1, editable: 0, columnOrder: 6, width: 120 },
    { tableName: 'RDR1', columnUid: 'CountryOrg', fieldName: 'CountryOrg', columnTitle: 'Country/Region of Origin', visible: 1, editable: 1, columnOrder: 7, width: 180 },
    { tableName: 'RDR1', columnUid: 'LocCode', fieldName: 'LocCode', columnTitle: 'Loc.', visible: 1, editable: 0, columnOrder: 8, width: 100 },
    { tableName: 'RDR1', columnUid: 'ShipDate', fieldName: 'ShipDate', columnTitle: 'Del. Date', visible: 1, editable: 1, columnOrder: 9, width: 120 },
    { tableName: 'RDR1', columnUid: 'TrnsCode', fieldName: 'TrnsCode', columnTitle: 'Shipping Type', visible: 1, editable: 1, columnOrder: 10, width: 120 },
    { tableName: 'RDR1', columnUid: 'OpenQty', fieldName: 'OpenQty', columnTitle: 'Open Qty', visible: 1, editable: 0, columnOrder: 11, width: 100 },
    { tableName: 'RDR1', columnUid: 'TaxOnly', fieldName: 'TaxOnly', columnTitle: 'Tax Liable', visible: 1, editable: 1, columnOrder: 12, width: 95 },
    { tableName: 'RDR1', columnUid: 'VatSum', fieldName: 'VatSum', columnTitle: 'Tax Amount (Doc)', visible: 1, editable: 0, columnOrder: 13, width: 125 },
    { tableName: 'RDR1', columnUid: 'unitMsr', fieldName: 'unitMsr', columnTitle: 'UoM Name', visible: 1, editable: 0, columnOrder: 14, width: 120 },
  ];

  const schema = buildSalesOrderSchema({ context: companyA.context, metadata });
  const labels = schema.lineFields.filter((field) => field.visible !== false).map((field) => field.label);

  assert.deepEqual(labels, [
    'Item No.',
    'Item Description',
    'Quantity',
    'Unit Price',
    'Tax Code',
    'Total (Doc)',
    'Country/Region of Origin',
    'Loc.',
    'Del. Date',
    'Shipping Type',
    'Open Qty',
    'Tax Liable',
    'Tax Amount (Doc)',
    'UoM Name',
  ]);
  assert.equal(getField(schema, 'RDR1.TrnsCode').lookup.source, 'shipping-types');
  assert.equal(getField(schema, 'RDR1.TaxOnly').renderer, 'checkbox');
  assert.equal(getField(schema, 'RDR1.GTotal').readOnly, true);
});

test('schema service exposes getCurrentSchema alias for dummy validation integration', async () => {
  const service = createNewSalesOrderSchemaService({
    repository: { getSalesOrderMetadata: async () => companyB.metadata },
  });
  const schema = await service.getCurrentSchema(companyB.context);
  assert.equal(schema.companyDb, 'NSO_COMPANY_B');
  assert.ok(Array.isArray(schema.headerFields));
  assert.ok(Array.isArray(schema.lineFields));
});

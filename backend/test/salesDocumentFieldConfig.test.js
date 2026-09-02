'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSqliteAuthDbTestAdapter } = require('./helpers/sqliteAuthDbTestAdapter');
const {
  createSalesDocumentFieldConfigRepository,
} = require('../modules/salesDocumentSchema/salesDocumentFieldConfigRepository');
const {
  createSalesDocumentFieldConfigService,
  getAllowedLookupSources,
} = require('../modules/salesDocumentSchema/salesDocumentFieldConfigService');
const {
  applyLookupConfigurations,
} = require('../modules/newSalesOrder/newSalesOrderSchemaService');

const schemaSql = fs.readFileSync(path.resolve(__dirname, '../db/auth-schema.sqlite.sql'), 'utf8');

const makeSchema = (dialect = 'sqlserver') => ({
  success: true,
  companyId: 1,
  companyDb: 'COMPANY_A',
  companyName: 'Company A',
  dialect,
  documentType: 'SALES_ORDER',
  objectType: '17',
  headerTable: 'ORDR',
  lineTable: 'RDR1',
  schemaVersion: 'base-v1',
  headerFields: [{ id: 'ORDR.CardCode', editable: true }],
  lineFields: [
    {
      id: 'RDR1.Quantity', order: 1, label: 'Quantity', stateKey: 'quantity',
      sapField: 'Quantity', databaseField: 'Quantity', tableName: 'RDR1',
      type: 'number', renderer: 'number', storage: 'standard', editable: true, readOnly: false,
      lookup: null, lookupSource: null, options: [],
    },
    {
      id: 'RDR1.U_Agent', order: 2, label: 'Agent', stateKey: 'U_Agent',
      sapField: 'U_Agent', databaseField: 'U_Agent', tableName: 'RDR1',
      type: 'select', renderer: 'select', storage: 'udf', editable: true, readOnly: false,
      lookup: { source: 'udf-valid-values', fieldId: 'RDR1.U_Agent' },
      lookupSource: 'udf-valid-values', options: [{ value: 'A', label: 'Agent A' }],
      linkedTable: '@AGENTS', relUDO: 'AGENT_UDO',
    },
    {
      id: 'RDR1.LineTotal', order: 3, label: 'Total', stateKey: 'lineTotal',
      sapField: 'LineTotal', databaseField: 'LineTotal', tableName: 'RDR1',
      type: 'number', renderer: 'number', storage: 'calculated', editable: false, readOnly: true,
      lookup: null, lookupSource: null, options: [],
    },
  ],
  lookupSources: [],
});

test('configuration repository replaces one company/document scope without crossing others', async () => {
  const adapter = createSqliteAuthDbTestAdapter(schemaSql);
  try {
    await adapter.authDb.query(`INSERT INTO Companies (CompanyName, DbName) VALUES ('A', 'A_DB')`);
    await adapter.authDb.query(`INSERT INTO Companies (CompanyName, DbName) VALUES ('B', 'B_DB')`);
    const repository = createSalesDocumentFieldConfigRepository({ authDb: adapter.authDb });
    await repository.replace({ companyId: 1, documentType: 'SALES_ORDER', userId: 7, assignments: [
      { fieldId: 'RDR1.Quantity', lookupSource: 'warehouses' },
      { fieldId: 'RDR1.U_Agent', lookupSource: 'owners' },
    ] });
    await repository.replace({ companyId: 1, documentType: 'DELIVERY', userId: 7, assignments: [
      { fieldId: 'DLN1.Quantity', lookupSource: 'items' },
    ] });
    await repository.replace({ companyId: 2, documentType: 'SALES_ORDER', userId: 8, assignments: [
      { fieldId: 'RDR1.Quantity', lookupSource: 'tax-codes' },
    ] });
    await repository.replace({ companyId: 1, documentType: 'SALES_ORDER', userId: 7, assignments: [
      { fieldId: 'RDR1.Quantity', lookupSource: 'countries' },
    ] });

    assert.deepEqual((await repository.list(1, 'SALES_ORDER')).map((row) => row.LookupSource), ['countries']);
    assert.equal((await repository.list(1, 'DELIVERY'))[0].LookupSource, 'items');
    assert.equal((await repository.list(2, 'SALES_ORDER'))[0].LookupSource, 'tax-codes');
  } finally {
    adapter.close();
  }
});

test('configuration service exposes only line fields and validates compatible editable overrides', async () => {
  let stored = [];
  const configurations = {
    list: async () => stored.map((row) => ({ FieldId: row.fieldId, LookupSource: row.lookupSource })),
    replace: async ({ assignments }) => { stored = assignments; },
  };
  const schemas = { getBaseSchema: async (context) => makeSchema(context.dbDialect) };
  const service = createSalesDocumentFieldConfigService({ configurations, schemas });
  const context = { companyId: 1, companyDb: 'COMPANY_A', companyName: 'Company A', userId: 7, dbDialect: 'hana' };
  const initial = await service.getConfiguration(context, 'SALES_ORDER');

  assert.equal(initial.dialect, 'hana');
  assert.equal(initial.lineFields.length, 3);
  assert.ok(initial.lineFields.every((field) => field.id.startsWith('RDR1.')));
  assert.deepEqual(
    ['udf-valid-values', 'udf-linked-table', 'udo'].filter((source) =>
      initial.lineFields[1].allowedLookupSources.includes(source)),
    ['udf-valid-values', 'udf-linked-table', 'udo'],
  );

  const saved = await service.saveConfiguration(context, {
    documentType: 'SALES_ORDER',
    schemaVersion: 'base-v1',
    assignments: [
      { fieldId: 'RDR1.Quantity', lookupSource: 'warehouses' },
      { fieldId: 'RDR1.U_Agent', lookupSource: 'udf-valid-values' },
    ],
  });
  assert.deepEqual(stored, [{ fieldId: 'RDR1.Quantity', lookupSource: 'warehouses' }]);
  assert.equal(saved.lineFields[0].configuredLookupSource, 'warehouses');

  await assert.rejects(
    service.saveConfiguration(context, {
      documentType: 'SALES_ORDER', schemaVersion: 'base-v1',
      assignments: [{ fieldId: 'RDR1.LineTotal', lookupSource: 'items' }],
    }),
    (error) => error.code === 'FIELD_NOT_EDITABLE',
  );
  await assert.rejects(
    service.saveConfiguration(context, {
      documentType: 'SALES_ORDER', schemaVersion: 'stale',
      assignments: [],
    }),
    (error) => error.code === 'STALE_SCHEMA_VERSION',
  );
});

test('schema overlay marks configured lookups and changes the effective schema version', () => {
  const base = makeSchema('sqlserver');
  const configured = applyLookupConfigurations(base, [
    { FieldId: 'RDR1.Quantity', LookupSource: 'warehouses' },
    { FieldId: 'ORDR.CardCode', LookupSource: 'owners' },
    { FieldId: 'RDR1.LineTotal', LookupSource: 'items' },
  ]);
  assert.notEqual(configured.schemaVersion, base.schemaVersion);
  assert.equal(configured.lineFields[0].lookupConfigured, true);
  assert.equal(configured.lineFields[0].lookup.source, 'warehouses');
  assert.equal(configured.lineFields[0].renderer, 'lookup');
  assert.equal(configured.lineFields[2].lookupConfigured, undefined);
  assert.equal(configured.headerFields[0].lookupConfigured, undefined);
});

test('dynamic lookup sources are offered only when matching UDF metadata exists', () => {
  assert.equal(getAllowedLookupSources({ storage: 'standard', databaseField: 'Quantity' }).includes('udo'), false);
  assert.equal(getAllowedLookupSources({
    storage: 'udf', databaseField: 'U_Code', options: [], linkedTable: '@TABLE', relUDO: '',
  }).includes('udf-linked-table'), true);
});

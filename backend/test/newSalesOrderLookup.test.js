'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createNewSalesOrderLookupService,
} = require('../modules/newSalesOrder/newSalesOrderLookupService');
const {
  assertStaticReadOnlySql,
} = require('../modules/newSalesOrder/newSalesOrderReadOnlyDbService');
const { buildSalesOrderSchema } = require('../modules/newSalesOrder/newSalesOrderSchemaService');
const companyA = require('./fixtures/newSalesOrderCompanyA');

const schemaA = buildSalesOrderSchema({ context: companyA.context, metadata: companyA.metadata });

const createHarness = ({ selectRows } = {}) => {
  const calls = [];
  const readOnlyDb = {
    select: async (request) => {
      calls.push(request);
      if (selectRows) return selectRows(request);
      return [
        { value: 'I001', label: 'Item One', description: 'First item' },
        { value: 'I002', label: 'Item Two', description: 'Second item' },
        { value: 'I003', label: 'Item Three', description: 'Third item' },
      ];
    },
  };
  const metadata = {
    getTableColumns: async (_context, tableName) => {
      if (tableName === '@NSO_CONTAINER_TYPES') {
        return [
          { columnName: 'Code', databaseType: 'nvarchar' },
          { columnName: 'Name', databaseType: 'nvarchar' },
        ];
      }
      if (tableName === 'OSAC') {
        return [
          { columnName: 'AbsEntry', databaseType: 'int' },
          { columnName: 'ServCode', databaseType: 'nvarchar' },
          { columnName: 'ServName', databaseType: 'nvarchar' },
        ];
      }
      return [];
    },
    tableExists: async (_context, tableName) => tableName === '@NSO_CONTAINER_TYPES',
    resolveUdoTable: async () => '@NSO_UDO_TABLE',
  };
  const service = createNewSalesOrderLookupService({
    readOnlyDb,
    metadata,
    schemas: { getSchema: async () => schemaA },
  });
  return { calls, metadata, service };
};

test('standard lookup is parameterized, paginated, capped, and returns stored values', async () => {
  const { calls, service } = createHarness();
  const result = await service.getLookup(companyA.context, 'items', {
    q: 'needle',
    page: '2',
    limit: '2',
  });

  assert.equal(result.companyId, 101);
  assert.equal(result.companyDb, 'NSO_COMPANY_A');
  assert.equal(result.page, 2);
  assert.equal(result.limit, 2);
  assert.equal(result.hasMore, true);
  assert.deepEqual(result.items.map((item) => item.value), ['I001', 'I002']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.search, 'needle');
  assert.equal(calls[0].params.like, '%needle%');
  assert.equal(calls[0].params.offset, 2);
  assert.equal(calls[0].params.fetchLimit, 3);
  assert.doesNotMatch(calls[0].sql, /needle/);

  const capped = await service.getLookup(companyA.context, 'items', { limit: '999' });
  assert.equal(capped.limit, 100);
  assert.equal(calls[1].params.fetchLimit, 101);
});

test('lookup source, arbitrary table, arbitrary SQL, and unknown parameters are rejected', async () => {
  const { service } = createHarness();
  await assert.rejects(
    service.getLookup(companyA.context, 'OITM', {}),
    (error) => error.statusCode === 404 && error.code === 'LOOKUP_SOURCE_NOT_ALLOWED',
  );
  await assert.rejects(
    service.getLookup(companyA.context, 'items', { tableName: 'OITM' }),
    (error) => error.statusCode === 400 && error.code === 'ARBITRARY_LOOKUP_TARGET_REJECTED',
  );
  await assert.rejects(
    service.getLookup(companyA.context, 'items', { sql: 'SELECT * FROM OITM' }),
    (error) => error.statusCode === 400 && error.code === 'ARBITRARY_LOOKUP_TARGET_REJECTED',
  );
  await assert.rejects(
    service.getLookup(companyA.context, 'items', { companyDb: 'OTHER_COMPANY' }),
    (error) => error.statusCode === 400 && error.code === 'UNKNOWN_LOOKUP_PARAMETER',
  );
});

test('UFD1 lookup returns the stored valid value, not its display label', async () => {
  const { service } = createHarness();
  const result = await service.getLookup(companyA.context, 'udf-valid-values', {
    fieldId: 'RDR1.U_PackingType',
    schemaVersion: schemaA.schemaVersion,
    q: 'box',
  });

  assert.equal(result.schemaVersion, schemaA.schemaVersion);
  assert.deepEqual(result.items, [
    { value: 'BOX', label: 'Box', description: 'Box' },
  ]);
});

test('dynamic lookup rejects a stale schema version', async () => {
  const { service } = createHarness();
  await assert.rejects(
    service.getLookup(companyA.context, 'udf-valid-values', {
      fieldId: 'RDR1.U_PackingType',
      schemaVersion: 'old-schema',
    }),
    (error) => error.statusCode === 409 && error.code === 'STALE_SCHEMA_VERSION',
  );
});

test('linked-table target is derived only from the current field schema', async () => {
  const { calls, service } = createHarness({
    selectRows: async () => [
      { value: 'CONT20', label: '20 foot', description: '20 foot' },
      { value: 'CONT40', label: '40 foot', description: '40 foot' },
    ],
  });
  const result = await service.getLookup(companyA.context, 'udf-linked-table', {
    fieldId: 'RDR1.U_ContainerType',
    schemaVersion: schemaA.schemaVersion,
  });

  assert.deepEqual(result.items.map((option) => option.value), ['CONT20', 'CONT40']);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM \[@NSO_CONTAINER_TYPES\]/);
  assert.doesNotMatch(calls[0].sql, /ORDR|RDR1/);
  assert.equal(calls[0].params.tableName, undefined);
});

test('lookup validator accepts exact option values and rejects labels', async () => {
  const { service } = createHarness();
  const field = schemaA.lineFields.find((candidate) => candidate.id === 'RDR1.U_PackingType');
  const stored = await service.validateLookupValue({
    trustedContext: companyA.context,
    schema: schemaA,
    field,
    value: 'BOX',
  });
  const label = await service.validateLookupValue({
    trustedContext: companyA.context,
    schema: schemaA,
    field,
    value: 'Box',
  });
  assert.deepEqual(stored, { valid: true });
  assert.deepEqual(label, { valid: false });
});

test('lookup validator scopes UoM membership to the current line item', async () => {
  const { calls, service } = createHarness({
    selectRows: async () => [{ value: 'EA', label: 'Each', description: 'Each' }],
  });
  const field = {
    id: 'RDR1.UomCode',
    lookup: { source: 'uom-codes', dependsOn: ['itemNo'] },
    options: [],
  };

  const valid = await service.validateLookupValue({
    trustedContext: companyA.context,
    schema: schemaA,
    field,
    value: 'EA',
    record: { values: { itemNo: 'I001' }, udf: {} },
  });
  const missingItem = await service.validateLookupValue({
    trustedContext: companyA.context,
    schema: schemaA,
    field,
    value: 'EA',
    record: { values: {}, udf: {} },
  });

  assert.deepEqual(valid, { valid: true });
  assert.deepEqual(missingItem, { valid: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.itemCode, 'I001');
  assert.equal(calls[0].params.search, 'EA');
  assert.match(calls[0].sql, /INNER JOIN UGP1/);
});

test('read-only SQL guard blocks write tokens, multiple statements, and SELECT INTO', () => {
  assert.equal(assertStaticReadOnlySql('SELECT ItemCode FROM OITM'), 'SELECT ItemCode FROM OITM');
  assert.match(assertStaticReadOnlySql('WITH items AS (SELECT ItemCode FROM OITM) SELECT * FROM items'), /^WITH/);
  assert.throws(() => assertStaticReadOnlySql('UPDATE OITM SET ItemName = @name'), /Only SELECT or WITH/);
  assert.throws(() => assertStaticReadOnlySql('SELECT * INTO #items FROM OITM'), /write-capable SQL token/);
  assert.throws(() => assertStaticReadOnlySql('SELECT * FROM OITM; DELETE FROM OITM'), /Multiple SQL statements/);
});

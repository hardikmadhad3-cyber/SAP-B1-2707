'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCufdSql,
  buildPhysicalColumnsSql,
  buildResolveUdoSql,
  buildTableExistsSql,
  buildUfd1ValuesSql,
  createNewSalesOrderMetadataRepository,
} = require('../modules/newSalesOrder/newSalesOrderMetadataRepository');
const {
  buildItemUomLookupSql,
  buildLinkedTableSql,
  buildStandardLookupSql,
  createNewSalesOrderLookupService,
} = require('../modules/newSalesOrder/newSalesOrderLookupService');

const context = Object.freeze({
  userId: 7,
  companyId: 101,
  companyDb: 'TEST_COMPANY',
  userCode: 'manager',
  dbDialect: 'hana',
});

test('metadata SQL is generated explicitly for SQL Server and SAP HANA', () => {
  const sqlServerColumns = buildPhysicalColumnsSql('sqlserver');
  const hanaColumns = buildPhysicalColumnsSql('hana');
  assert.match(sqlServerColumns, /\[INFORMATION_SCHEMA\]\.\[COLUMNS\]/);
  assert.match(sqlServerColumns, /T0\.\[COLUMN_NAME\] AS \[columnName\]/);
  assert.doesNotMatch(sqlServerColumns, /SYS.*TABLE_COLUMNS/s);
  assert.match(hanaColumns, /"SYS"\."TABLE_COLUMNS"/);
  assert.match(hanaColumns, /T0\."COLUMN_NAME" AS "columnName"/);
  assert.match(hanaColumns, /"SCHEMA_NAME" = CURRENT_SCHEMA/);
  assert.doesNotMatch(hanaColumns, /INFORMATION_SCHEMA|\[[^\]]+\]/);

  assert.match(buildTableExistsSql('sqlserver'), /\[INFORMATION_SCHEMA\]\.\[TABLES\]/);
  assert.match(buildTableExistsSql('hana'), /"SYS"\."TABLES"/);
  assert.match(buildUfd1ValuesSql('sqlserver'), /FROM \[UFD1\] T0/);
  assert.match(buildUfd1ValuesSql('hana'), /FROM "UFD1" T0/);

  const columns = new Set(['TableID', 'FieldID', 'AliasID', 'Descr']);
  assert.match(buildCufdSql(columns, 'sqlserver'), /T0\.\[AliasID\] AS \[aliasId\]/);
  assert.match(buildCufdSql(columns, 'hana'), /T0\."AliasID" AS "aliasId"/);
  assert.match(buildResolveUdoSql('sqlserver'), /SELECT TOP 1/);
  assert.match(buildResolveUdoSql('hana'), /LIMIT 1/);
  assert.doesNotMatch(buildResolveUdoSql('hana'), /\bTOP\b/);
});

test('metadata repository selects HANA catalog SQL through an injected adapter', async () => {
  const calls = [];
  const repository = createNewSalesOrderMetadataRepository({
    authDb: null,
    readOnlyDb: {
      getDialect: async () => 'hana',
      select: async (request) => {
        calls.push(request);
        if (request.queryId === 'metadata.columns.INV1') {
          return [{
            columnName: 'ItemCode',
            dataType: 'NVARCHAR',
            maxLength: 50,
            numericPrecision: null,
            numericScale: null,
            isNullable: 'TRUE',
            ordinalPosition: 1,
          }];
        }
        if (request.queryId === 'metadata.oudo.resolve-table') {
          return [{ tableName: 'MY_UDO' }];
        }
        return [];
      },
    },
  });

  const columns = await repository.getTableColumns(context, 'INV1', { documentTableOnly: true });
  const udoTable = await repository.resolveUdoTable(context, 'MY_UDO');
  assert.equal(columns[0].nullable, true);
  assert.equal(udoTable, '@MY_UDO');
  assert.match(calls[0].sql, /"SYS"\."TABLE_COLUMNS"/);
  assert.match(calls[1].sql, /FROM "OUDO" T0/);
  assert.match(calls[1].sql, /LIMIT 1/);
});

test('lookup SQL uses dialect-specific identifiers and pagination', () => {
  const sqlServer = buildStandardLookupSql('items', 'sqlserver');
  const hana = buildStandardLookupSql('items', 'hana');
  assert.match(sqlServer, /FROM \[OITM\] T0/);
  assert.match(sqlServer, /OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY/);
  assert.match(hana, /FROM "OITM" T0/);
  assert.match(hana, /LIMIT @fetchLimit OFFSET @offset/);
  assert.doesNotMatch(hana, /FETCH NEXT|\[[^\]]+\]/);

  assert.match(buildItemUomLookupSql('hana'), /INNER JOIN "UGP1" G/);
  assert.match(buildLinkedTableSql({
    tableName: '@MY_VALUES',
    codeColumn: 'Code',
    labelColumn: 'Name',
    dialect: 'hana',
  }), /FROM "@MY_VALUES"/);
});

test('lookup service chooses HANA SQL without opening a database connection', async () => {
  const calls = [];
  const service = createNewSalesOrderLookupService({
    readOnlyDb: {
      getDialect: async () => 'hana',
      select: async (request) => {
        calls.push(request);
        return [{ value: 'I001', label: 'Item One', description: 'Item One' }];
      },
    },
    metadata: {},
    schemas: {},
  });

  const result = await service.getLookup(context, 'items', { limit: 10 });
  assert.equal(result.items[0].value, 'I001');
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM "OITM" T0/);
  assert.match(calls[0].sql, /LIMIT @fetchLimit OFFSET @offset/);
});

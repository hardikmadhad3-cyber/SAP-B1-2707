'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HANA_TABLE_COLUMNS_SQL,
  SQLSERVER_TABLE_COLUMNS_SQL,
  createTableColumnDetailsReader,
  createTableFieldMetadataReader,
  escapeLikeValue,
  resolveDatabaseScope,
} = require('../services/salesDocumentDbCompatibility');
const { buildMarketingDocumentListFilterQuery } = require('../services/documentListUtils');
const { bindParams, normalizeSql } = require('../db/hanaDb');

test('uses SQL Server catalog metadata and normalizes result casing', async () => {
  const calls = [];
  const database = {
    resolveDatabaseName: async () => 'SBODEMO_US',
    getDialect: async () => 'sqlserver',
    query: async (sql, params) => {
      calls.push({ sql, params });
      return {
        recordset: [
          { columnName: 'DocEntry', dataType: 'int', maxLength: null, ordinalPosition: 1 },
          { COLUMNNAME: 'U_Export', DATATYPE: 'nvarchar', MAXLENGTH: 20, ORDINALPOSITION: 2 },
        ],
      };
    },
  };
  const readMetadata = createTableFieldMetadataReader({ database });

  assert.deepEqual(await readMetadata('ORDR'), {
    DocEntry: 'int',
    U_Export: 'nvarchar',
  });
  assert.deepEqual(await readMetadata('ordr'), {
    DocEntry: 'int',
    U_Export: 'nvarchar',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sql, SQLSERVER_TABLE_COLUMNS_SQL);
  assert.deepEqual(calls[0].params, { tableName: 'ORDR' });
});

test('uses HANA catalog metadata and scopes cache by company and dialect', async () => {
  let databaseName = 'COMPANY_A';
  let dialect = 'hana';
  let server = 'hana-a';
  const calls = [];
  const database = {
    resolveDatabaseName: async () => databaseName,
    getDialect: async () => dialect,
    resolveSqlConnectionConfig: async () => ({ server, port: 30015 }),
    query: async (sql) => {
      calls.push(sql);
      return [{ COLUMNNAME: 'DocEntry', DATATYPE: dialect === 'hana' ? 'INTEGER' : 'int' }];
    },
  };
  const readMetadata = createTableFieldMetadataReader({ database });

  assert.equal((await readMetadata('OINV')).DocEntry, 'integer');
  databaseName = 'COMPANY_B';
  assert.equal((await readMetadata('OINV')).DocEntry, 'integer');
  dialect = 'sqlserver';
  assert.equal((await readMetadata('OINV')).DocEntry, 'int');
  server = 'sql-b';
  assert.equal((await readMetadata('OINV')).DocEntry, 'int');

  assert.equal(calls.length, 4);
  assert.equal(calls[0], HANA_TABLE_COLUMNS_SQL);
  assert.equal(calls[1], HANA_TABLE_COLUMNS_SQL);
  assert.equal(calls[2], SQLSERVER_TABLE_COLUMNS_SQL);
  assert.equal(calls[3], SQLSERVER_TABLE_COLUMNS_SQL);
});

test('normalizes detailed SQL Server and HANA metadata aliases', async () => {
  const database = {
    resolveDatabaseName: async () => 'COMPANY_A',
    getDialect: async () => 'hana',
    query: async () => ({
      rows: [{
        COLUMNNAME: 'U_Notes',
        DATATYPE: 'NVARCHAR',
        MAXLENGTH: 254,
        NUMERICPRECISION: 254,
        NUMERICSCALE: 0,
        ISNULLABLE: 'YES',
        ORDINALPOSITION: 15,
      }],
    }),
  };
  const readDetails = createTableColumnDetailsReader({ database });

  assert.deepEqual(await readDetails('INV1'), [{
    columnName: 'U_Notes',
    dataType: 'nvarchar',
    maxLength: 254,
    numericPrecision: 254,
    numericScale: 0,
    nullable: true,
    ordinal: 15,
  }]);
});

test('evicts a rejected metadata promise so a later request can retry', async () => {
  let attempts = 0;
  const database = {
    resolveDatabaseName: async () => 'COMPANY_A',
    getDialect: async () => 'sqlserver',
    query: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary metadata failure');
      return { recordset: [{ columnName: 'DocEntry', dataType: 'int' }] };
    },
  };
  const readMetadata = createTableFieldMetadataReader({ database });

  await assert.rejects(readMetadata('RIN1'), /temporary metadata failure/);
  assert.deepEqual(await readMetadata('RIN1'), { DocEntry: 'int' });
  assert.equal(attempts, 2);
});

test('requires a resolved company database instead of sharing a default cache', async () => {
  const database = {
    resolveDatabaseName: async () => '',
    getDialect: async () => 'hana',
    query: async () => ({ recordset: [] }),
  };

  await assert.rejects(resolveDatabaseScope(database), /active company database/i);
});

test('metadata cache scope distinguishes case-normalized SQL Server named instances', async () => {
  let instanceName = 'SapPrimary';
  const database = {
    resolveDatabaseName: async () => 'SBODEMO_US',
    getDialect: async () => 'sqlserver',
    resolveSqlConnectionConfig: async () => ({
      server: 'sql-host',
      instanceName,
      port: 1433,
    }),
    query: async () => ({ recordset: [] }),
  };

  const primary = await resolveDatabaseScope(database);
  instanceName = 'sapprimary';
  const sameInstanceDifferentCase = await resolveDatabaseScope(database);
  instanceName = 'SapReporting';
  const reporting = await resolveDatabaseScope(database);

  assert.equal(primary.cacheKey, sameInstanceDifferentCase.cacheKey);
  assert.notEqual(primary.cacheKey, reporting.cacheKey);
  assert.match(primary.cacheKey, /SQL-HOST:SAPPRIMARY:1433:SBODEMO_US$/);
});

test('builds one portable LIKE escape convention for SQL Server and HANA', () => {
  assert.equal(escapeLikeValue('A%_B[C]!'), 'A!%!_B![C!]!!');

  const { whereClauses, params } = buildMarketingDocumentListFilterQuery({
    query: 'A%_B[C]!',
  });
  const sql = whereClauses.join('\n');

  assert.match(sql, /LIKE @queryLike ESCAPE '!'/);
  assert.match(sql, /LIKE @queryCompactLike ESCAPE '!'/);
  assert.equal(params.queryLike, '%A B C%');
  assert.equal(params.query, '%A!%!_B![C!]!!%');
});

test('converts DISTINCT TOP lookups and portable LIKE escaping for HANA', () => {
  const hanaSql = normalizeSql(`
    SELECT DISTINCT TOP (@top) T0.CardCode
    FROM OCRD T0
    WHERE T0.CardName LIKE @query ESCAPE '!'
    ORDER BY T0.CardCode
  `);
  const bound = bindParams(hanaSql, { top: 25, query: '%A!%%' });

  assert.match(bound.sql, /^SELECT DISTINCT\s+T0\."CardCode"/);
  assert.match(bound.sql, /LIKE \? ESCAPE '!'/);
  assert.match(bound.sql, /LIMIT \?$/);
  assert.doesNotMatch(bound.sql, /\bTOP\b/);
  assert.deepEqual(bound.values, ['%A!%%', 25]);
});

test('keeps explicit HANA catalog SQL valid through the shared HANA adapter', () => {
  const normalized = normalizeSql(HANA_TABLE_COLUMNS_SQL);
  const bound = bindParams(normalized, { tableName: 'QUT1' });

  assert.match(bound.sql, /FROM "SYS"\."TABLE_COLUMNS"/);
  assert.match(bound.sql, /"SCHEMA_NAME" = CURRENT_SCHEMA/);
  assert.match(bound.sql, /"TABLE_NAME" = \?/);
  assert.doesNotMatch(bound.sql, /INFORMATION_SCHEMA|\[[^\]]+\]/);
  assert.deepEqual(bound.values, ['QUT1']);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPhysicalColumnSetReader,
  selectPhysicalOptionalColumn,
} = require('../services/salesDocumentDbCompatibility');
const { normalizeSql } = require('../db/hanaDb');

test('optional SAP fields retain exact physical casing for SQL Server and HANA', () => {
  const columns = new Set(['SacEntry', 'U_PACKINGTYPE', 'BPLId']);
  const sql = [
    selectPhysicalOptionalColumn(columns, 'T0', 'SACEntry', 'SACCode'),
    selectPhysicalOptionalColumn(columns, 'T0', 'U_PackingType', 'PackingType'),
    selectPhysicalOptionalColumn(columns, 'T0', 'BPLId', 'Branch'),
    selectPhysicalOptionalColumn(columns, 'T0', 'U_Missing', 'Missing', "''"),
  ].join(', ');
  assert.match(sql, /T0\.\[SacEntry\] AS \[SACCode\]/);
  assert.match(sql, /T0\.\[U_PACKINGTYPE\]/);
  const hana = normalizeSql('SELECT ' + sql + ' FROM POR1 T0');
  assert.match(hana, /T0\."SacEntry" AS "SACCode"/);
  assert.match(hana, /T0\."U_PACKINGTYPE"/);
  assert.doesNotMatch(hana, /T0\."SACEntry"|T0\."U_PackingType"|T0\."U_Missing"/);
  assert.match(hana, /'' AS "Missing"/);
});

test('physical-column cache isolates company, server, dialect and table', async () => {
  let company = 'COMPANY_A';
  let server = 'server-a';
  let dialect = 'hana';
  const calls = [];
  const database = {
    resolveDatabaseName: async () => company,
    getDialect: async () => dialect,
    resolveSqlConnectionConfig: async () => ({ server, port: 30015 }),
    query: async (sql, params) => {
      calls.push({ sql, table: params.tableName });
      const names = company === 'COMPANY_A' && server === 'server-a'
        ? ['SacEntry', 'U_PACKINGTYPE', 'BPLId']
        : ['ItemCode'];
      return { recordset: names.map((columnName) => ({ columnName })) };
    },
  };
  const read = createPhysicalColumnSetReader(database);
  for (const table of ['POR1', 'PQT1', 'PDN1', 'PCH1', 'RPC1', 'PRQ1']) {
    const columns = await read(table);
    assert.match(selectPhysicalOptionalColumn(columns, 'T0', 'SACEntry', 'SACCode'), /SacEntry/);
  }
  await read('POR1');
  assert.equal(calls.length, 6);
  assert.ok(calls.every(({ sql }) => sql.includes('"SYS"."TABLE_COLUMNS"')));
  company = 'COMPANY_B';
  assert.equal(selectPhysicalOptionalColumn(await read('POR1'), 'T0', 'SACEntry', 'SACCode'), 'NULL AS [SACCode]');
  assert.equal(selectPhysicalOptionalColumn(await read('POR1'), 'T0', 'BPLId', 'Branch'), 'NULL AS [Branch]');
  company = 'COMPANY_A';
  server = 'server-b';
  assert.equal(selectPhysicalOptionalColumn(await read('POR1'), 'T0', 'SACEntry', 'SACCode'), 'NULL AS [SACCode]');
  server = 'server-a';
  dialect = 'sqlserver';
  assert.match(selectPhysicalOptionalColumn(await read('POR1'), 'T0', 'SACEntry', 'SACCode'), /SacEntry/);
  assert.equal(calls.length, 9);
  assert.match(calls.at(-1).sql, /TABLE_SCHEMA = 'dbo'/);
  assert.match(calls.at(-1).sql, /INFORMATION_SCHEMA.COLUMNS/);
});

test('failed physical metadata reads propagate and can retry without a poisoned cache', async () => {
  let fail = true;
  const database = {
    resolveDatabaseName: async () => 'COMPANY_A',
    query: async () => {
      if (fail) throw new Error('Metadata unavailable');
      return { recordset: [{ COLUMN_NAME: 'SacEntry' }] };
    },
  };
  const read = createPhysicalColumnSetReader(database);
  await assert.rejects(read('POR1'), /Metadata unavailable/);
  fail = false;
  assert.deepEqual(Array.from(await read('POR1')), ['SacEntry']);
});

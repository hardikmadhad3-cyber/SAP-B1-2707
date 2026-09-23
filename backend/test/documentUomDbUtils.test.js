const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const {
  getDocumentUomSql,
  loadCompanyUomGroups,
  normalizeUomGroups,
} = require('../services/documentUomDbUtils');

const metadataRows = (columns) => columns.map((columnName) => ({
  columnName,
  dataType: 'nvarchar',
}));

test('uses OUOM name instead of company-dependent unitMsr code', async () => {
  const database = {
    resolveDatabaseName: async () => 'LIVE_COMPANY',
    getDialect: async () => 'sqlserver',
    query: async (_sql, params) => ({
      recordset: params.tableName === 'POR1'
        ? metadataRows(['DocEntry', 'UomEntry', 'unitMsr'])
        : metadataRows(['UomEntry', 'UomCode', 'UomName']),
    }),
  };
  const uom = await getDocumentUomSql(database, 'POR1');
  assert.match(uom.valueSql, /DOC_UOM\.\[UomName\]/);
  assert.match(uom.joinSql, /OUOM DOC_UOM/);

  const sql = new DatabaseSync(':memory:');
  try {
    sql.exec("CREATE TABLE POR1 (DocEntry INTEGER, UomEntry INTEGER, unitMsr TEXT); CREATE TABLE OUOM (UomEntry INTEGER, UomCode TEXT, UomName TEXT); INSERT INTO POR1 VALUES (1, 7, 'BX'); INSERT INTO OUOM VALUES (7, 'BX', 'Box');");
    const row = sql.prepare(`SELECT ${uom.valueSql} AS UoMName FROM POR1 T0 ${uom.joinSql}`).get();
    assert.equal(row.UoMName, 'Box');
  } finally {
    sql.close();
  }
});

test('keeps Manual as the code while retaining the entered MeasureUnit name', async () => {
  const database = {
    resolveDatabaseName: async () => 'MANUAL_COMPANY',
    getDialect: async () => 'sqlserver',
    query: async (_sql, params) => ({
      recordset: params.tableName === 'POR1'
        ? metadataRows(['DocEntry', 'UomEntry', 'unitMsr'])
        : metadataRows(['UomEntry', 'UomCode', 'UomName']),
    }),
  };
  const uom = await getDocumentUomSql(database, 'POR1');
  const sql = new DatabaseSync(':memory:');
  try {
    sql.exec("CREATE TABLE POR1 (DocEntry INTEGER, UomEntry INTEGER, unitMsr TEXT); CREATE TABLE OUOM (UomEntry INTEGER, UomCode TEXT, UomName TEXT); INSERT INTO POR1 VALUES (1, -1, 'MTR');");
    const row = sql.prepare(`SELECT ${uom.codeSql} AS UoMCode, ${uom.nameSql} AS UoMName FROM POR1 T0 ${uom.joinSql}`).get();
    assert.equal(row.UoMCode, 'Manual');
    assert.equal(row.UoMName, 'MTR');
  } finally {
    sql.close();
  }
});

test('normalizes grouped and Manual UoMs without losing SAP identity', () => {
  const groups = normalizeUomGroups([
    { AbsEntry: 4, Name: 'Length', UomEntry: 7, UomCode: 'MTR', UomName: 'Meter', BaseQty: 1, AltQty: 1 },
    { AbsEntry: 4, Name: 'Length', UomEntry: 8, UomCode: 'CM', UomName: 'Centimeter', BaseQty: 1, AltQty: 100 },
    { AbsEntry: -1, Name: 'Manual', UomEntry: null, UomCode: null, UomName: null },
  ]);

  assert.deepEqual(groups[0].uoms[1], {
    uomEntry: 8,
    uomCode: 'CM',
    uomName: 'Centimeter',
    baseQty: 1,
    altQty: 100,
    factor: 100,
  });
  assert.equal(groups[0].uomCodes.includes('MTR'), true);
  assert.deepEqual(groups[1].uoms[0], {
    uomEntry: -1,
    uomCode: 'Manual',
    uomName: 'Manual',
    baseQty: 1,
    altQty: 1,
    factor: 1,
  });
});

test('loads structured UoMs through mixed-case HANA metadata', async () => {
  const database = {
    resolveDatabaseName: async () => 'HANA_COMPANY',
    getDialect: async () => 'hana',
    query: async (sql, params) => {
      if (params?.tableName === 'OUGP') return { recordset: metadataRows(['UGPENTRY', 'UgpCode', 'LOCKED']) };
      if (params?.tableName === 'UGP1') return { recordset: metadataRows(['UgpEntry', 'UOMENTRY', 'BaseQty', 'ALTQTY', 'LineNum']) };
      if (params?.tableName === 'OUOM') return { recordset: metadataRows(['UomEntry', 'UOMCODE', 'UomName']) };
      assert.match(sql, /G\.\[UGPENTRY\]/);
      assert.match(sql, /U\.\[UOMCODE\]/);
      return {
        recordset: [{
          AbsEntry: 4,
          Name: 'Length',
          UomEntry: 7,
          UomCode: 'MTR',
          UomName: 'Meter',
          BaseQty: 1,
          AltQty: 1,
        }],
      };
    },
  };

  const groups = await loadCompanyUomGroups(database);
  assert.equal(groups[0].uoms[0].uomEntry, 7);
  assert.equal(groups[0].uoms[0].uomName, 'Meter');
});

test('falls back to the physical line UoM on older company schemas', async () => {
  const database = {
    resolveDatabaseName: async () => 'LEGACY_COMPANY',
    getDialect: async () => 'sqlserver',
    query: async (_sql, params) => ({
      recordset: params.tableName === 'POR1'
        ? metadataRows(['DocEntry', 'unitMsr'])
        : [],
    }),
  };
  const uom = await getDocumentUomSql(database, 'POR1');
  assert.equal(uom.valueSql, 'T0.[unitMsr]');
  assert.equal(uom.joinSql, '');
});

test('keeps metadata cached separately for each active company', async () => {
  let company = 'TEST_COMPANY';
  let calls = 0;
  const database = {
    resolveDatabaseName: async () => company,
    getDialect: async () => 'sqlserver',
    query: async (_sql, params) => {
      calls += 1;
      if (company === 'TEST_COMPANY') {
        return { recordset: params.tableName === 'POR1'
          ? metadataRows(['UomEntry', 'unitMsr'])
          : metadataRows(['UomEntry', 'UomName']) };
      }
      return { recordset: params.tableName === 'POR1'
        ? metadataRows(['unitMsr'])
        : [] };
    },
  };
  assert.match((await getDocumentUomSql(database, 'POR1')).joinSql, /OUOM/);
  await getDocumentUomSql(database, 'POR1');
  assert.equal(calls, 2);
  company = 'LIVE_COMPANY';
  assert.equal((await getDocumentUomSql(database, 'POR1')).joinSql, '');
  assert.equal(calls, 4);
});

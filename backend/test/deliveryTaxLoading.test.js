const test = require('node:test');
const assert = require('node:assert/strict');

const loadDelivery = (query, dialect) => {
  const mocks = {
    dbService: { query, getDialect: async () => dialect,
      resolveDatabaseName: async () => 'TAX_TEST',
      resolveSqlConnectionConfig: async () => ({ server: 'test-server' }) },
    udfMetadataService: { getHeaderUdfValues: async () => ({}), getLineUdfValues: async () => ({}) },
    salesOrderDbService: {}, masterDataDbService: {}, authDbService: {},
  };
  const saved = [];
  const target = require.resolve('../services/deliveryDbService');
  const original = require.cache[target];
  try {
    for (const [name, exports] of Object.entries(mocks)) {
      const id = require.resolve('../services/' + name);
      saved.push([id, require.cache[id]]);
      require.cache[id] = { id, filename: id, loaded: true, exports };
    }
    delete require.cache[target];
    return require(target);
  } finally {
    if (original) require.cache[target] = original;
    else delete require.cache[target];
    for (const [id, previous] of saved) {
      if (previous) require.cache[id] = previous;
      else delete require.cache[id];
    }
  }
};

for (const dialect of ['hana', 'sqlserver']) {
  for (const fallback of [false, true]) {
    test(`${dialect}: delivery Find ${fallback ? 'fallback' : 'rich query'} retains selected tax and saved tax amounts`, async () => {
      let lineCalls = 0;
      const service = loadDelivery(async (sql, params = {}) => {
        if (params.tableName) return { recordset: params.tableName === 'DLN1'
          ? ['SacEntry', 'TaxCode', 'VatSum', 'BaseEntry', 'BaseType', 'BaseLine'].map(columnName => ({ columnName, dataType: 'int' })) : [] };
        if (/FROM ODLN T0/.test(sql) || /FROM ODLN\b/.test(sql)) return { recordset: [{ DocEntry: 19153, DocNum: 30 }] };
        if (/FROM DLN1 T0/.test(sql)) {
          lineCalls += 1;
          if (fallback && lineCalls === 1) throw new Error('Optional company join unavailable');
          assert.ok(sql.includes('T0.[VatSum] AS [LineTaxAmount]'));
          assert.ok(!sql.includes('T0.SACEntry'));
          if (!fallback) assert.ok(sql.includes('T0.[SacEntry] AS [SACEntry]'));
          return { recordset: [{ LineNum: 0, ItemCode: 'YG010KWC00', Quantity: 1587.6,
            UnitPrice: 246, LineTotal: 390549.6, TaxCode: '5-RGST', LineTaxAmount: 19527.48,
            BaseEntry: 11233, BaseType: 17, BaseLine: 0 }] };
        }
        return { recordset: [] };
      }, dialect);
      const result = await service.getDelivery(19153);
      assert.equal(result.delivery.lines[0].taxCode, '5-RGST');
      assert.equal(result.delivery.lines[0].taxAmount, '19527.48');
      assert.equal(result.delivery.lines[0].baseEntry, 11233);
      assert.equal(result.delivery.lines[0].baseType, 17);
      assert.equal(lineCalls, fallback ? 2 : 1);
    });
  }
}

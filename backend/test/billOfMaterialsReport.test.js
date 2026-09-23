const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeSql, bindParams } = require('../db/hanaDb');

const source = fs.readFileSync(path.join(__dirname, '../services/reports/billOfMaterials.service.js'), 'utf8');
function loadReport(query) {
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: () => ({ query }) });
  return module.exports.getBillOfMaterialsReport;
}
function fixture(roots, edges, resources = false) {
  const calls = [];
  const report = loadReport(async (sql, params, options) => {
    calls.push({ sql, params, options });
    if (sql.includes('FROM OITT H')) return { recordset: roots.map(ItemCode => ({ ItemCode })) };
    if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return { recordset: resources ? [{ COLUMN_NAME: 'ResCode' }, { COLUMN_NAME: 'ResName' }] : [] };
    assert.ok(Object.keys(params).length <= 500);
    assert.doesNotMatch(sql, /MAXRECURSION|WITH BOMTree|CHARINDEX/);
    assert.equal(sql.includes('JOIN ORSC'), resources);
    const translated = normalizeSql(sql);
    assert.doesNotMatch(translated, /\bISNULL\s*\(/i);
    assert.ok(bindParams(translated, params));
    return { recordset: edges.filter(row => Object.values(params).includes(row.ParentCode)) };
  });
  return { report, calls };
}
const edge = (ParentCode, ItemCode) => ({ ParentCode, ItemCode, Quantity: '2', Price: '3' });

test('BOM children retain depth-first line order, shared branches and stop cycles', async () => {
  const { report, calls } = fixture(['A', 'B'], [edge('A', 'B'), edge('A', 'C'), edge('B', 'A'), edge('B', 'D')]);
  const options = { databaseName: 'CompanyA' };
  const result = await report({}, options);
  assert.deepEqual(JSON.parse(JSON.stringify(result.rows[0].children.map(x => [x.itemCode, x.depth]))), [['B', 2], ['A', 3], ['D', 3], ['C', 2]]);
  assert.ok(calls.every(call => call.options === options));
  assert.equal(result.rows[0].children[0].quantity, 2);
});

test('BOM metadata and child rows remain isolated between company requests', async () => {
  const report = loadReport(async (sql, params, options) => {
    if (sql.includes('FROM OITT H')) return [{ ItemCode: 'A' }];
    if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return options.databaseName === 'B' ? [{ COLUMN_NAME: 'ResCode' }, { COLUMN_NAME: 'ResName' }] : [];
    assert.equal(sql.includes('JOIN ORSC'), options.databaseName === 'B');
    return Object.values(params).includes('A') ? [edge('A', options.databaseName)] : [];
  });
  const a = await report({}, { databaseName: 'A' });
  const b = await report({}, { databaseName: 'B' });
  assert.equal(a.rows[0].children[0].itemCode, 'A');
  assert.equal(b.rows[0].children[0].itemCode, 'B');
});

test('BOM batches large selections below the database parameter limit', async () => {
  const { report, calls } = fixture(Array.from({ length: 2101 }, (_, i) => 'R' + i), []);
  const result = await report();
  assert.equal(result.rows.length, 2101);
  assert.equal(calls.filter(call => call.sql.includes('FROM ITT1')).length, 5);
});

test('BOM limits nested traversal to twenty component levels', async () => {
  const { report } = fixture(['N0'], Array.from({ length: 25 }, (_, i) => edge('N' + i, 'N' + (i + 1))), true);
  const result = await report();
  assert.equal(result.rows[0].children.length, 20);
  assert.equal(result.rows[0].children.at(-1).depth, 21);
});

test('empty BOM results avoid metadata and child queries', async () => {
  const { report, calls } = fixture([], []);
  assert.equal((await report()).rows.length, 0);
  assert.equal(calls.length, 1);
});

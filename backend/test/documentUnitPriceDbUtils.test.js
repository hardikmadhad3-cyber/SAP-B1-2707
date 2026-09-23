const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { getDocumentUnitPriceSql } = require('../services/documentUnitPriceDbUtils');
const fs = require('node:fs');
const vm = require('node:vm');
const hanaModule = { exports: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../db/hanaDb'), 'utf8'), {
 module: hanaModule, exports: hanaModule.exports,
 require() { throw new Error('Native HANA client is not needed for SQL normalization'); }, console,
});
const { normalizeSql } = hanaModule.exports;

test('reloads the original price and applies row and final discounts once', async () => {
  const database = {
    resolveDatabaseName: async () => 'COMPANY_A',
    query: async () => ({ recordset: [{ columnName: 'PriceBefDi', dataType: 'decimal' }] }),
  };
  const expression = await getDocumentUnitPriceSql(database, 'QUT1');
  const sql = new DatabaseSync(':memory:');
  try {
    sql.exec('CREATE TABLE QUT1 (PriceBefDi REAL, Price REAL); INSERT INTO QUT1 VALUES (1000,980),(0,250),(NULL,125),(0,0);');
    for (const query of [`SELECT ${expression} AS UnitPrice FROM QUT1 T0`, normalizeSql(`SELECT ${expression} AS UnitPrice FROM QUT1 T0`)]) {
      const prices = sql.prepare(query).all().map(row => row.UnitPrice);
      assert.deepEqual(prices, [1000, 250, 125, 0]);
      const beforeDiscount = prices[0] * 120 * 0.98;
      assert.equal(beforeDiscount, 117600);
      const discounted = beforeDiscount * 0.98;
      const tax = Math.round(discounted * 0.12 * 100) / 100;
      assert.equal(tax, 13829.76);
      assert.equal(discounted + 100 + tax, 129177.76);
      assert.equal(beforeDiscount + 100 + beforeDiscount * 0.12, 131812);
    }
  } finally { sql.close(); }
});

test('isolates optional price columns by company and SQL dialect', async () => {
  let company = 'COMPANY_A';
  let dialect = 'sqlserver';
  let calls = 0;
  const database = {
    resolveDatabaseName: async () => company,
    getDialect: async () => dialect,
    query: async () => {
      calls += 1;
      return { recordset: company === 'COMPANY_A' ? [{ COLUMN_NAME: 'PriceBefDi', DATA_TYPE: 'decimal' }] : [{ COLUMN_NAME: 'Price', DATA_TYPE: 'decimal' }] };
    },
  };
  assert.match(await getDocumentUnitPriceSql(database, 'QUT1'), /PriceBefDi/);
  await getDocumentUnitPriceSql(database, 'QUT1');
  assert.equal(calls, 1);
  company = 'COMPANY_B';
  assert.equal(await getDocumentUnitPriceSql(database, 'QUT1', 'T1'), 'T1.Price');
  company = 'COMPANY_A';
  dialect = 'hana';
  assert.match(normalizeSql(`SELECT ${await getDocumentUnitPriceSql(database, 'QUT1')} AS UnitPrice FROM QUT1 T0`), /T0\."PriceBefDi"/);
  assert.equal(calls, 3);
});


test('Sales Quotation totals recalculate final discount without changing unit price', () => {
 const source = fs.readFileSync(require('node:path').join(__dirname, '../../frontend/src/modules/sales-quotation/SalesQuotation.jsx'), 'utf8');
 const start = source.indexOf('  const calcLineTotal = (line) =>');
 const end = source.indexOf('  const totals = calcTotals();', start);
 assert.ok(start >= 0 && end > start);
 const line = { quantity: '120', unitPrice: '1000', stdDiscount: '2', taxCode: '12-GST' };
 const header = { discount: '', freight: '100' };
 const context = {
  lines: [line], header, effectiveTaxCodes: [{ Code: '12-GST', Rate: 12 }],
  freightTotals: { totalTax: 0 },
  numDec: { total: 2, tax: 2, totalPaymentDue: 2 },
  parseNum: value => Number(value) || 0,
  roundTo: (value, decimals) => Math.round(value * 10 ** decimals) / 10 ** decimals,
 };
 const calculate = () => vm.runInNewContext(source.slice(start, end) + '\ncalcTotals();', { ...context });
 assert.equal(calculate().total, 131812);
 header.discount = '2';
 let totals = calculate();
 assert.equal(totals.subtotal, 117600);
 assert.equal(totals.discAmt, 2352);
 assert.equal(totals.taxAmt, 13829.76);
 assert.equal(totals.taxBreakdown[0].taxAmount, 13829.76);
 assert.equal(totals.total, 129177.76);
 assert.equal(line.unitPrice, '1000');
 header.discount = '0';
 assert.equal(calculate().total, 131812);
});

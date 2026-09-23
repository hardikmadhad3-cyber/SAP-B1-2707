const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDocumentAdditionalExpenses: build } = require('../services/freightPayloadUtils');

test('unused freight lookup rows do not become invoice expenses', () => {
 assert.deepEqual(build([
  { ExpnsCode: 1, LineTotal: 0, TaxCode: '' },
  { expnsCode: 2, netAmount: '0', taxCode: '' },
  { ExpnsCode: 3, DefaultAmount: 100 },
  { ExpnsCode: 4, LineTotal: 0, TaxCode: 'GST' },
 ]), []);
});
test('actual freight retains company tax code and unused sibling rows are omitted', () => {
 assert.deepEqual(build([
  { expnsCode: 1, netAmount: '100', taxCode: ' 12-GST ' },
  { expnsCode: 2, netAmount: 0, taxCode: '' },
 ]), [{ ExpenseCode: 1, LineTotal: 100, TaxCode: '12-GST' }]);
});
test('an explicitly cleared amount never falls back to freight master defaults', () => {
 assert.deepEqual(build([{ ExpnsCode: 1, netAmount: 0, LineTotal: 100, DefaultAmount: 100, TaxCode: 'GST' }]), []);
});
test('positive and negative charges without tax codes fail with actionable validation', () => {
 for (const amount of [100, -100]) {
  assert.throws(() => build([{ ExpnsCode: 1, ExpnsName: 'Transport', LineTotal: amount, TaxCode: ' ' }]), error => {
   assert.equal(error.status, 400);
   assert.equal(error.code, 'FREIGHT_TAX_CODE_REQUIRED');
   assert.match(error.message, /Transport/);
   return true;
  });
 }
});
test('Service Layer expense rows and negative charges preserve explicit tax codes', () => {
 assert.deepEqual(build([{ ExpenseCode: 7, LineTotal: -20, TaxCode: 'EXEMPT' }]), [{ ExpenseCode: 7, LineTotal: -20, TaxCode: 'EXEMPT' }]);
});
test('absent freight is safe', () => {
 for (const rows of [undefined, null, {}]) assert.deepEqual(build(rows), []);
});

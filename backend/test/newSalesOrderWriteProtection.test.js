const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertDummySaveEnabled,
  assertSapWriteUnavailable,
  isLiteralTrue,
} = require('../modules/newSalesOrder/newSalesOrderWriteProtection');

test('dummy save requires the exact literal string true', () => {
  assert.equal(isLiteralTrue('true'), true);
  for (const value of [true, 'TRUE', ' true ', '1', undefined]) {
    assert.equal(isLiteralTrue(value), false);
  }
  assert.equal(assertDummySaveEnabled({ NEW_SALES_ORDER_USE_DUMMY_SAVE: 'true' }), true);
  assert.throws(
    () => assertDummySaveEnabled({ NEW_SALES_ORDER_USE_DUMMY_SAVE: 'TRUE' }),
    (error) => error.statusCode === 503 && error.code === 'NEW_SALES_ORDER_DUMMY_SAVE_DISABLED',
  );
});

test('SAP writes are blocked by default and remain unavailable when future opt-in is true', () => {
  assert.throws(
    () => assertSapWriteUnavailable({ NEW_SALES_ORDER_ALLOW_SAP_WRITES: 'false' }),
    (error) => error.statusCode === 403 && error.code === 'NEW_SALES_ORDER_SAP_WRITES_DISABLED',
  );
  assert.throws(
    () => assertSapWriteUnavailable({ NEW_SALES_ORDER_ALLOW_SAP_WRITES: 'true' }),
    (error) => error.statusCode === 501 && error.code === 'NEW_SALES_ORDER_SAP_WRITES_NOT_IMPLEMENTED',
  );
});

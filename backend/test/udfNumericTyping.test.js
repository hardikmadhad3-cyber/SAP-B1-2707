'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeUdfValue, normalizeUdfValues } = require('../services/udfPayloadUtils');

// SAP stores EditSize 6 for a "Numeric 19.6" user-defined field. That is a
// decimal specification, never a character limit, so it must not be applied to
// the value as one.
const NUMERIC_EDIT_SIZE = 6;

test('a numeric UDF is not truncated by its CUFD EditSize', () => {
  const field = { key: 'U_GrossWt', type: 'number', maxLength: NUMERIC_EDIT_SIZE };
  for (const value of ['125.5', '1250.750000', '15480.000000', '0.000001']) {
    assert.equal(
      normalizeUdfValue(value, field, 'U_GrossWt'),
      Number(value),
      `${value} must survive EditSize ${NUMERIC_EDIT_SIZE}`,
    );
  }
});

test('a numeric UDF reaches the Service Layer as a number, never a string', () => {
  // The Service Layer types a Numeric UDF as a number. Handed a quoted number
  // it does not complain, it stores 0 — which is exactly what SAP showed for
  // U_GrossWt and U_TotalPackage on every document this app wrote.
  const field = { key: 'U_GrossWt', type: 'number', maxLength: 16 };
  const value = normalizeUdfValue('120', field, 'U_GrossWt');
  assert.equal(typeof value, 'number');
  assert.equal(value, 120);

  assert.equal(normalizeUdfValue(33, field, 'U_GrossWt'), 33);
  assert.equal(normalizeUdfValue(' 1250.750000 ', field, 'U_GrossWt'), 1250.75);
  assert.equal(normalizeUdfValue('-4.25', field, 'U_GrossWt'), -4.25);
});

test('a text UDF is still sent as text, even when it looks numeric', () => {
  // A quantity code or an HSN number must keep its leading zeros.
  assert.equal(
    normalizeUdfValue('00120', { key: 'U_Code', type: 'text', maxLength: 16 }, 'U_Code'),
    '00120',
  );
});

test('a numeric UDF that cannot be a number is skipped rather than sent as 0', () => {
  const field = { key: 'U_GrossWt', type: 'number', maxLength: 16 };
  for (const value of ['heavy', '12kg', '1,250.75', '--3']) {
    assert.equal(normalizeUdfValue(value, field, 'U_GrossWt'), undefined, String(value));
  }
});

test('date and checkbox UDFs are likewise exempt from the length check', () => {
  assert.equal(
    normalizeUdfValue('2026-09-20', { key: 'U_LRDate', type: 'date', maxLength: 4 }, 'U_LRDate'),
    '2026-09-20',
  );
  assert.equal(
    normalizeUdfValue('Y', { key: 'U_Flag', type: 'checkbox', maxLength: 0 }, 'U_Flag'),
    'Y',
  );
});

test('a genuine text UDF is still length checked', () => {
  // This is the case the check exists for: SAP rejects an over-long string.
  assert.equal(
    normalizeUdfValue('MUCH TOO LONG', { key: 'U_Code', type: 'text', maxLength: 4 }, 'U_Code'),
    undefined,
  );
  assert.equal(
    normalizeUdfValue('OK', { key: 'U_Code', type: 'text', maxLength: 4 }, 'U_Code'),
    'OK',
  );
});

test('a line payload keeps every numeric UDF the user filled in', () => {
  const definitions = {
    U_GrossWt: { key: 'U_GrossWt', type: 'number', maxLength: NUMERIC_EDIT_SIZE },
    U_TotalPackage: { key: 'U_TotalPackage', type: 'number', maxLength: NUMERIC_EDIT_SIZE },
  };
  assert.deepEqual(
    normalizeUdfValues(
      { U_GrossWt: '1250.750000', U_TotalPackage: '15480.000000' },
      null,
      definitions,
    ),
    { U_GrossWt: 1250.75, U_TotalPackage: 15480 },
  );
});

test('typing a numeric UDF as text is what dropped the value', () => {
  // Guards the regression directly: with the old hardcoded 'text' type and the
  // same EditSize, the value disappeared from the payload entirely.
  const asTextField = { key: 'U_GrossWt', type: 'text', maxLength: NUMERIC_EDIT_SIZE };
  assert.equal(normalizeUdfValue('1250.750000', asTextField, 'U_GrossWt'), undefined);

  const asNumberField = { key: 'U_GrossWt', type: 'number', maxLength: NUMERIC_EDIT_SIZE };
  assert.equal(normalizeUdfValue('1250.750000', asNumberField, 'U_GrossWt'), 1250.75);
});

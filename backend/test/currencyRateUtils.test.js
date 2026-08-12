const test = require('node:test');
const assert = require('node:assert/strict');
const {
  fromSapStoredRate,
  normalizeRateSettings,
  toSapStoredRate,
} = require('../services/currencyRateUtils');

test('keeps direct exchange rates unchanged', () => {
  const settings = normalizeRateSettings({ DirectRate: 'Y', RateDec: 4 });
  assert.equal(settings.postingMethod, 'direct');
  assert.equal(settings.decimalPlaces, 4);
  assert.equal(toSapStoredRate(86.11, settings), 86.11);
  assert.equal(fromSapStoredRate(86.11, settings), 86.11);
});

test('converts indirect display rates to and from SAP direct storage', () => {
  const settings = normalizeRateSettings({ DirectRate: 'N', RateDec: 6 });
  const stored = toSapStoredRate(2, settings);
  assert.equal(stored, 0.5);
  assert.equal(fromSapStoredRate(stored, settings), 2);
});

test('rejects invalid exchange rates', () => {
  assert.equal(toSapStoredRate(0, { DirectRate: 'Y' }), '');
  assert.equal(fromSapStoredRate('bad', { DirectRate: 'N' }), '');
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyDocumentCurrency,
  normalizeDocumentCurrency,
} = require('../services/documentCurrencyUtils');

test('normalizes blank document currency to empty string', () => {
  assert.equal(normalizeDocumentCurrency(''), '');
  assert.equal(normalizeDocumentCurrency(null), '');
  assert.equal(normalizeDocumentCurrency(' USD '), 'USD');
});

test('applies header currency as SAP DocCurrency', () => {
  const payload = applyDocumentCurrency({}, { currency: 'USD' });
  assert.equal(payload.DocCurrency, 'USD');
});

test('applies positive exchange rate as SAP DocRate', () => {
  const payload = applyDocumentCurrency({}, { currency: 'USD', exchangeRate: '86.4' });
  assert.equal(payload.DocCurrency, 'USD');
  assert.equal(payload.DocRate, 86.4);
});

test('does not add DocCurrency when header currency is blank', () => {
  const payload = applyDocumentCurrency({ CardCode: 'C001' }, { currency: '' });
  assert.deepEqual(payload, { CardCode: 'C001' });
});

test('supports SAP field aliases for loaded payloads', () => {
  assert.equal(applyDocumentCurrency({}, { DocCur: 'EUR' }).DocCurrency, 'EUR');
  assert.equal(applyDocumentCurrency({}, { DocCurrency: 'GBP' }).DocCurrency, 'GBP');
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDocumentConfirmationPayload, resolveDocumentConfirmationStatus } = require('../services/documentConfirmationUtils');

test('missing confirmation preserves company defaults and saved PATCH values', () => {
  for (const header of [{}, { confirmed: undefined }, { confirmed: null }, { confirmed: '' }]) {
    assert.deepEqual(buildDocumentConfirmationPayload(header), {});
  }
});
test('explicit confirmation choices work independently of approval workflow', () => {
  for (const value of [true, 'Y', 'tYES', 1]) {
    assert.deepEqual(buildDocumentConfirmationPayload({ confirmed: value }), { Confirmed: 'tYES' });
  }
  for (const value of [false, 'N', 'tNO', 0]) {
    assert.deepEqual(buildDocumentConfirmationPayload({ confirmed: value }), { Confirmed: 'tNO' });
  }
  assert.throws(() => buildDocumentConfirmationPayload({ confirmed: 'unknown' }), /Invalid/);
});
test('shows unapproved only for an open unconfirmed document, without masking closure', () => {
  assert.equal(resolveDocumentConfirmationStatus('Open', 'N'), 'Unapproved');
  assert.equal(resolveDocumentConfirmationStatus('Open', 'Y'), 'Open');
  assert.equal(resolveDocumentConfirmationStatus('Closed', 'N'), 'Closed');
  assert.equal(resolveDocumentConfirmationStatus('Open', null), 'Open');
});

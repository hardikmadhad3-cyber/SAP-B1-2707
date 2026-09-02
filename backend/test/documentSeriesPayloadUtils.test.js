const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isManualDocumentSeries,
  buildDocumentSeriesPayload,
} = require('../services/documentSeriesPayloadUtils');

test('builds SAP payload fields for a manual document series', () => {
  assert.equal(isManualDocumentSeries('-1'), true);
  assert.deepEqual(
    buildDocumentSeriesPayload({ series: '-1', nextNumber: '1001' }),
    { Series: -1, HandWritten: 'tYES', DocNum: 1001 },
  );
});


test('prefers the visible next number over stale manual aliases', () => {
  assert.deepEqual(
    buildDocumentSeriesPayload({ series: '-1', nextNumber: '1002', manualDocumentNumber: '1001' }),
    { Series: -1, HandWritten: 'tYES', DocNum: 1002 },
  );
});

test('builds SAP payload fields for an automatic document series', () => {
  assert.deepEqual(
    buildDocumentSeriesPayload({ series: '42', nextNumber: '1001' }),
    { Series: 42 },
  );
});

test('rejects an invalid manual document number', () => {
  assert.throws(
    () => buildDocumentSeriesPayload({ series: '-1', nextNumber: '' }),
    /positive integer/,
  );
});

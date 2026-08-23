'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildLineDeliveryDateFields,
  formatSapDate,
} = require('../services/salesDocumentHydrationUtils');

test('formats SQL Server Date and HANA date text without dialect-specific assumptions', () => {
  assert.equal(formatSapDate(new Date('2026-08-21T00:00:00.000Z')), '2026-08-21');
  assert.equal(formatSapDate('2026-08-22T00:00:00'), '2026-08-22');
  assert.equal(formatSapDate(null), '');
});

test('hydrates the canonical and SAP ShipDate aliases together', () => {
  assert.deepEqual(
    buildLineDeliveryDateFields({ ShipDate: '2026-09-03T12:30:00' }),
    { lineDeliveryDate: '2026-09-03', ShipDate: '2026-09-03' },
  );
});

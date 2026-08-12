const assert = require('node:assert/strict');
const test = require('node:test');

const {
  _private: {
    dedupeSeriesRows,
    keepSapVisibleSeries,
  },
} = require('../services/documentSeriesDbUtils');

test('dedupeSeriesRows keeps one row per SAP series number', () => {
  const rows = dedupeSeriesRows([
    { Series: 101, SeriesName: 'SO 25-26' },
    { Series: 101, SeriesName: 'Duplicate' },
    { Series: 102, SeriesName: 'SO 26-27' },
  ]);

  assert.deepEqual(rows.map((row) => row.SeriesName), ['SO 25-26', 'SO 26-27']);
});

test('keepSapVisibleSeries prefers SAP default series when many rows are returned', () => {
  const rows = keepSapVisibleSeries([
    { Series: 101, SeriesName: 'SO 23-24', IsDefault: false },
    { Series: 102, SeriesName: 'SO 24-25', IsDefault: false },
    { Series: 103, SeriesName: 'SO 25-26', IsDefault: true },
  ], '2026-02-15');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].Series, 103);
});

test('keepSapVisibleSeries keeps every unlocked series in the SAP default indicator', () => {
  const rows = keepSapVisibleSeries([
    { Series: 256, SeriesName: 'EXSO2425', Indicator: 'FY2024-25' },
    { Series: 257, SeriesName: 'DCSO2425', Indicator: 'FY2024-25' },
    { Series: 328, SeriesName: 'EXSO2526', Indicator: 'FY2025-26', IsDefault: true },
    { Series: 329, SeriesName: 'DCSO2526', Indicator: 'FY2025-26' },
  ], '2026-08-12');

  assert.deepEqual(rows.map((row) => row.Series), [328, 329]);
});

test('keepSapVisibleSeries keeps every series returned for the posting period', () => {
  const rows = keepSapVisibleSeries([
    { Series: 328, SeriesName: 'EXSO2526', Indicator: 'FY2025-26', IsCurrentPeriod: true, IsDefault: true },
    { Series: 329, SeriesName: 'DCSO2526', Indicator: 'FY2025-26', IsCurrentPeriod: true },
  ], '2026-02-15');

  assert.deepEqual(rows.map((row) => row.Series), [328, 329]);
});

test('keepSapVisibleSeries falls back to the row matching the target financial year', () => {
  const rows = keepSapVisibleSeries([
    { Series: 101, SeriesName: 'DCS02324', Indicator: '2023-2024' },
    { Series: 102, SeriesName: 'DCS02425', Indicator: '2024-2025' },
    { Series: 103, SeriesName: 'DCS02526', Indicator: '2025-2026' },
  ], '2026-02-15');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].Series, 103);
});

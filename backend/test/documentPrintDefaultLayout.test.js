'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getSapDefaultReportCode,
  selectSapDefaultReportRow,
} = require('../utils/documentPrintDefaultLayout');

test('selects the SAP RDFL default with user and business-partner precedence', () => {
  const rows = [
    { UserId: -1, CardCode: '-1', DfltReport: 'GLOBAL', TYPE: 'L' },
    { UserId: 7, CardCode: '-1', DfltReport: 'USER', TYPE: 'L' },
    { UserId: -1, CardCode: 'C100', DfltReport: 'BP', TYPE: 'L' },
    { UserId: 7, CardCode: 'C100', DfltReport: 'USER_BP', TYPE: 'L' },
  ];

  assert.equal(selectSapDefaultReportRow({ rows, userId: 7, cardCode: 'C100' }).DfltReport, 'USER_BP');
  assert.equal(selectSapDefaultReportRow({ rows, userId: 8, cardCode: 'C100' }).DfltReport, 'BP');
  assert.equal(selectSapDefaultReportRow({ rows, userId: 7, cardCode: 'C200' }).DfltReport, 'USER');
  assert.equal(selectSapDefaultReportRow({ rows, userId: 8, cardCode: 'C200' }).DfltReport, 'GLOBAL');
});

test('ignores print sequences and defaults belonging to another user or BP', () => {
  const selected = selectSapDefaultReportRow({
    rows: [
      { UserId: 7, CardCode: 'C100', DfltReport: 'SEQUENCE', TYPE: 'P' },
      { UserId: 9, CardCode: 'C100', DfltReport: 'OTHER_USER', TYPE: 'L' },
      { UserId: 7, CardCode: 'C999', DfltReport: 'OTHER_BP', TYPE: 'L' },
      { UserId: null, CardCode: '', DfltReport: 'FALLBACK', TYPE: 'L' },
    ],
    userId: 7,
    cardCode: 'C100',
  });

  assert.equal(selected.DfltReport, 'FALLBACK');
});

test('supports uppercase column names returned by SAP HANA', () => {
  const selected = selectSapDefaultReportRow({
    rows: [{
      USERID: 7,
      CARDCODE: 'C100',
      DFLTREPORT: 'RDR_CRYSTAL',
      TYPE: 'L',
    }],
    userId: 7,
    cardCode: 'C100',
  });

  assert.equal(getSapDefaultReportCode(selected), 'RDR_CRYSTAL');
});

test('returns an empty layout code when RDFL has no matching default', () => {
  const selected = selectSapDefaultReportRow({
    rows: [],
    userId: 7,
    cardCode: 'C100',
  });

  assert.equal(selected, null);
  assert.equal(getSapDefaultReportCode(selected), '');
});

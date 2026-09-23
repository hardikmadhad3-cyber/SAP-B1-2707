'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DOCUMENT_TYPES,
  hasMisboundStandardColumns,
  isMisboundStandardColumn,
} = require('../services/sapDocumentLayoutService');
const {
  findCprfStandardDefinition,
  findCprfUdfDefinition,
  getSalesDocumentCprfDefinitions,
} = require('../services/sapFormPreferenceUtils');

const grpo = DOCUMENT_TYPES.GRPO;

// Saved rows exactly as the ordinal-matching resolver wrote them for the GRPO
// line matrix: SAP's own captions against completely unrelated UDF fields.
const STALE_GRPO_ROWS = [
  { columnUid: '1', fieldName: 'U_PackingType', columnTitle: 'Item No.' },
  { columnUid: '3', fieldName: 'U_GrossWt', columnTitle: 'Item Description' },
  { columnUid: '11', fieldName: 'U_Buyer_Payment_Terms', columnTitle: 'Quantity' },
  { columnUid: '14', fieldName: 'U_Seller_Quality', columnTitle: 'Unit Price' },
];

const HEALTHY_GRPO_ROWS = [
  { columnUid: '1', fieldName: 'ItemCode', columnTitle: 'Item No.' },
  { columnUid: '3', fieldName: 'Dscription', columnTitle: 'Item Description' },
  { columnUid: '11', fieldName: 'Quantity', columnTitle: 'Quantity' },
  { columnUid: '14', fieldName: 'Price', columnTitle: 'Unit Price' },
  // A company UDF column is legitimate and always carries a U_ column id.
  { columnUid: 'U_PRICE', fieldName: 'U_PRICE', columnTitle: 'Unit Price' },
  { columnUid: 'U_ForRate', fieldName: 'U_ForRate', columnTitle: 'FOR Rate' },
];

test('a saved layout binding a standard matrix id to a UDF is treated as stale', () => {
  assert.equal(hasMisboundStandardColumns(STALE_GRPO_ROWS, grpo), true);
  for (const row of STALE_GRPO_ROWS) {
    assert.equal(isMisboundStandardColumn(row, grpo), true, `${row.columnTitle} -> ${row.fieldName}`);
  }
});

test('a correct layout, including genuine UDF columns, is not treated as stale', () => {
  assert.equal(hasMisboundStandardColumns(HEALTHY_GRPO_ROWS, grpo), false);
  for (const row of HEALTHY_GRPO_ROWS) {
    assert.equal(isMisboundStandardColumn(row, grpo), false, `${row.columnTitle} -> ${row.fieldName}`);
  }
});

test('an empty or unimported layout is never reported as stale', () => {
  assert.equal(hasMisboundStandardColumns([], grpo), false);
  assert.equal(hasMisboundStandardColumns(undefined, grpo), false);
});

test('the CPRF resolver maps standard matrix ids to standard fields, never to a UDF', () => {
  const udfDefinitions = [
    { key: 'U_PackingType', aliasId: 'PackingType', label: 'Packing-Type' },
    { key: 'U_GrossWt', aliasId: 'GrossWt', label: 'GrossWt' },
    { key: 'U_Buyer_Payment_Terms', aliasId: 'Buyer_Payment_Terms', label: 'Buyer - Terms of payment' },
    { key: 'U_Seller_Quality', aliasId: 'Seller_Quality', label: 'Seller - Quality' },
  ];
  const resolve = (row) => {
    const standard = findCprfStandardDefinition({
      row,
      preferredDefinitions: getSalesDocumentCprfDefinitions('GRPO'),
      fallbackDefinitions: [],
    });
    return standard?.fieldName || findCprfUdfDefinition(row, udfDefinitions)?.key || String(row.ColID);
  };

  assert.equal(resolve({ ColID: '1', Caption: 'Item No.' }), 'ItemCode');
  assert.equal(resolve({ ColID: '3', Caption: 'Item Description' }), 'Dscription');
  assert.equal(resolve({ ColID: '11', Caption: 'Quantity' }), 'Quantity');
  assert.equal(resolve({ ColID: '14', Caption: 'Unit Price' }), 'Price');
  // A caption-less standard id must still resolve by its matrix id alone.
  assert.equal(resolve({ ColID: '14', Caption: '' }), 'Price');
  // An explicit UDF identity still resolves to the UDF.
  assert.equal(resolve({ ColID: 'U_Seller_Quality', Caption: 'Seller - Quality' }), 'U_Seller_Quality');
});

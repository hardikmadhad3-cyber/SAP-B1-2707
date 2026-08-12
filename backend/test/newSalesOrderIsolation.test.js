const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const moduleDirectory = path.resolve(__dirname, '../modules/newSalesOrder');
const ownedFiles = [
  'newSalesOrderValidationService.js',
  'newSalesOrderPayloadBuilder.js',
  'newSalesOrderDummyRepository.js',
  'newSalesOrderDummyService.js',
  'newSalesOrderWriteProtection.js',
];

test('dummy persistence module has no Service Layer, Axios, or current Sales Order dependency', () => {
  for (const fileName of ownedFiles) {
    const source = fs.readFileSync(path.join(moduleDirectory, fileName), 'utf8');
    assert.doesNotMatch(source, /require\([^)]*(?:sapService|SalesOrderService|salesOrderService|axios)[^)]*\)/i, fileName);
    assert.doesNotMatch(source, /['"`]\/Orders(?:\(|['"`])/i, fileName);
  }
});

test('dummy repository writes only its additive local SQLite table', () => {
  const source = fs.readFileSync(path.join(moduleDirectory, 'newSalesOrderDummyRepository.js'), 'utf8');
  assert.match(source, /const TABLE_NAME = 'new_sales_order_dummy_drafts'/);
  const mutations = source.match(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO)\s+\$\{TABLE_NAME\}/gi) || [];
  assert.equal(mutations.length, 2);
  assert.doesNotMatch(source, /\b(?:ORDR|RDR1)\b/);
});

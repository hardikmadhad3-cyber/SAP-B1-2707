'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  filterUdfMetadataRowsByPhysicalColumns,
  loadUdfDefinitionsOrEmpty,
} = require('../services/udfMetadataUtils');

test('CUFD metadata is limited to UDF columns physically present in the company table', () => {
  const rows = [
    { AliasID: 'LiveField', Descr: 'Live field' },
    { AliasID: 'U_CASEFIELD', Descr: 'Case-insensitive match' },
    { AliasID: 'DeletedField', Descr: 'Stale CUFD row' },
  ];
  const physicalColumns = [
    { columnName: 'U_LiveField' },
    { columnName: 'U_CaseField' },
  ];

  assert.deepEqual(
    filterUdfMetadataRowsByPhysicalColumns(rows, physicalColumns),
    rows.slice(0, 2),
  );
  assert.deepEqual(filterUdfMetadataRowsByPhysicalColumns(rows, []), []);
});

test('metadata read failures fall back to an empty standard-only UDF definition set', async () => {
  const warnings = [];
  const definitions = await loadUdfDefinitionsOrEmpty('ORDR', {
    getDefinitions: async () => {
      throw new Error('metadata connection unavailable');
    },
    logger: { warn: (message) => warnings.push(message) },
  });

  assert.deepEqual(definitions, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ORDR/);
  assert.match(warnings[0], /continuing without UDFs/);
});

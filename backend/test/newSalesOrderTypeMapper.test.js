'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getStep,
  mapFieldType,
  normalizeDatabaseType,
} = require('../modules/newSalesOrder/newSalesOrderTypeMapper');

test('maps SQL Server and HANA numeric metadata without turning decimals into text', () => {
  const sqlServer = mapFieldType({ databaseType: 'decimal', precision: 19, scale: 6 });
  const hana = mapFieldType({ databaseType: 'DECIMAL', precision: 19, scale: 6 });

  assert.equal(sqlServer.type, 'number');
  assert.equal(hana.type, 'number');
  assert.equal(sqlServer.renderer, 'number');
  assert.equal(sqlServer.precision, 19);
  assert.equal(sqlServer.scale, 6);
  assert.equal(sqlServer.step, '0.000001');
  assert.equal(sqlServer.maximum, '9999999999999.999999');
});

test('maps integer, date, datetime, memo, and boolean database types', () => {
  assert.equal(mapFieldType({ databaseType: 'int', precision: 10, scale: 0 }).type, 'integer');
  assert.equal(mapFieldType({ databaseType: 'DATE' }).type, 'date');
  assert.equal(mapFieldType({ databaseType: 'SECONDDATE' }).type, 'datetime');
  assert.equal(mapFieldType({ databaseType: 'NCLOB' }).type, 'textarea');
  assert.equal(mapFieldType({ databaseType: 'BOOLEAN' }).type, 'checkbox');
});

test('uses stored UFD1 options and detects a two-value SAP yes/no checkbox', () => {
  const select = mapFieldType({
    databaseType: 'nvarchar',
    options: [
      { value: 'BOX', label: 'Box' },
      { value: 'BAG', label: 'Bag' },
    ],
  });
  const checkbox = mapFieldType({
    databaseType: 'nvarchar',
    options: [
      { value: 'Y', label: 'Yes' },
      { value: 'N', label: 'No' },
    ],
  });

  assert.equal(select.type, 'select');
  assert.deepEqual(select.options[0], { value: 'BOX', label: 'Box' });
  assert.equal(checkbox.type, 'checkbox');
  assert.equal(checkbox.renderer, 'checkbox');
});

test('linked fields and semantic item fields map to lookup renderers', () => {
  assert.deepEqual(
    mapFieldType({ databaseType: 'nvarchar', linkedTable: '@NSO_QUALITY' }).type,
    'lookup',
  );
  const item = mapFieldType({ databaseType: 'nvarchar' }, { renderer: 'item-lookup' });
  assert.equal(item.type, 'lookup');
  assert.equal(item.renderer, 'item-lookup');
});

test('step and database type normalization work for scale zero and type declarations', () => {
  assert.equal(getStep(0), '1');
  assert.equal(getStep(3), '0.001');
  assert.equal(normalizeDatabaseType(' DECIMAL(19, 6) '), 'decimal');
});

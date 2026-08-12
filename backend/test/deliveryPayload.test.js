'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { _buildDocumentLinePayload } = require('../services/deliveryService');

test('maps Delivery batch, serial, and bin allocations to Service Layer collections', async () => {
  const payload = await _buildDocumentLinePayload({
    itemNo: 'ALLOC-ITEM',
    quantity: '2',
    unitPrice: '10',
    whse: '01',
    batches: [{ batchNumber: 'B-01', quantity: '2' }],
    serialNumbers: [
      { serialNumber: 'S-01', systemSerialNumber: 101 },
      { serialNumber: 'S-02', systemSerialNumber: 102 },
    ],
    binAllocations: [{ binAbsEntry: 7, quantity: '2', allocationIndex: 0 }],
  }, {}, false, {}, new Set(), 0, true);

  assert.deepEqual(payload.BatchNumbers, [{ BatchNumber: 'B-01', Quantity: 2 }]);
  assert.deepEqual(payload.SerialNumbers, [
    { InternalSerialNumber: 'S-01', SystemSerialNumber: 101, Quantity: 1 },
    { InternalSerialNumber: 'S-02', SystemSerialNumber: 102, Quantity: 1 },
  ]);
  assert.deepEqual(payload.DocumentLinesBinAllocations, [{
    BinAbsEntry: 7,
    Quantity: 2,
    BaseLineNumber: 0,
    SerialAndBatchNumbersBaseLine: 0,
  }]);
});

test('preserves SAP base references for an A/R Reserve Invoice row', async () => {
  const payload = await _buildDocumentLinePayload({
    itemNo: 'RESERVE-ITEM',
    quantity: '3',
    unitPrice: '25',
    whse: '02',
    baseEntry: 501,
    baseType: 13,
    baseLine: 4,
  }, {}, false, {}, new Set(), 0, true);

  assert.equal(payload.BaseEntry, 501);
  assert.equal(payload.BaseType, 13);
  assert.equal(payload.BaseLine, 4);
  assert.equal(payload.ItemCode, undefined);
});

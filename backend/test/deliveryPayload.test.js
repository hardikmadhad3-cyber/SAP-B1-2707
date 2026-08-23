'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const deliveryDb = require('../services/deliveryDbService');
const { _buildDocumentLinePayload } = require('../services/deliveryService');

const originalResolveDeliveryLineUomEntry = deliveryDb.resolveDeliveryLineUomEntry;
test.before(() => {
  deliveryDb.resolveDeliveryLineUomEntry = async () => null;
});
test.after(() => {
  deliveryDb.resolveDeliveryLineUomEntry = originalResolveDeliveryLineUomEntry;
});

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

test('maps editable live DLN1 fields only when the active company exposes them', async () => {
  const hsnCodeDbService = require('../services/hsnCodeDbService');
  const originalResolveHsn = hsnCodeDbService.resolveHSNCodeToAbsEntry;
  const originalResolveSac = hsnCodeDbService.resolveSACCodeToAbsEntry;
  hsnCodeDbService.resolveHSNCodeToAbsEntry = async (value) => value === '1001' ? 41 : null;
  hsnCodeDbService.resolveSACCodeToAbsEntry = async (value) => value === '9983' ? 73 : null;

  try {
    const payload = await _buildDocumentLinePayload({
      itemNo: 'LIVE-ITEM',
      itemDescription: 'Company item description',
      quantity: '2',
      unitPrice: '10',
      whse: '01',
      cogsDistRule: 'COGS-1',
      cogsDistRule2: 'COGS-2',
      glAccount: '410000',
      distRule2: 'DIM-2',
      distRule3: 'DIM-3',
      lineDeliveryDate: '2026-08-20T00:00:00',
      lineShippingType: '4',
      taxLiable: 'Y',
      wTaxLiable: 'N',
      loc: '3',
      blanketAgreementNo: '91',
      blanketAgreementLine: '2',
      commPercent: '1.25',
      withoutQtyPosting: 'tYES',
      hsnCode: '1001',
      sacCode: '9983',
    }, {
      CogsOcrCod: 'nvarchar',
      CogsOcrCo2: 'nvarchar',
      AcctCode: 'nvarchar',
      OcrCode2: 'nvarchar',
      ShipDate: 'date',
      TrnsCode: 'int',
      TaxOnly: 'char',
      WtLiable: 'char',
      LocCode: 'int',
      AgrNo: 'int',
      AgrLnNum: 'int',
      CommPercent: 'numeric',
      NoInvtryMv: 'char',
      HsnEntry: 'int',
      SACEntry: 'int',
    }, false, {}, new Set(), 0, true);

    assert.equal(payload.ItemDescription, 'Company item description');
    assert.equal(payload.COGSCostingCode, 'COGS-1');
    assert.equal(payload.COGSCostingCode2, 'COGS-2');
    assert.equal(payload.AccountCode, '410000');
    assert.equal(payload.CostingCode2, 'DIM-2');
    assert.equal(payload.CostingCode3, undefined);
    assert.equal(payload.ShipDate, '2026-08-20');
    assert.equal(payload.ShippingMethod, 4);
    assert.equal(payload.TaxOnly, 'tYES');
    assert.equal(payload.WTLiable, 'tNO');
    assert.equal(payload.LocationCode, 3);
    assert.equal(payload.AgreementNo, 91);
    assert.equal(payload.AgreementRowNumber, 2);
    assert.equal(payload.CommissionPercent, 1.25);
    assert.equal(payload.WithoutInventoryMovement, 'tYES');
    assert.equal(payload.HSNEntry, 41);
    assert.equal(payload.SACEntry, 73);
  } finally {
    hsnCodeDbService.resolveHSNCodeToAbsEntry = originalResolveHsn;
    hsnCodeDbService.resolveSACCodeToAbsEntry = originalResolveSac;
  }
});

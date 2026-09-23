const test = require('node:test');
const assert = require('node:assert/strict');

const { buildAPInvoiceDocumentLine } = require('../services/apInvoicePayloadUtils');

test('preserves edited destination values on a GRPO-based A/P Invoice line', () => {
  const documentLine = buildAPInvoiceDocumentLine({
    itemNo: 'RM-001',
    itemDescription: 'Edited invoice description',
    quantity: '4',
    unitPrice: '244',
    stdDiscount: '1.5',
    taxCode: 'GST18',
    uomCode: 'KG',
    whse: 'WH-02',
    wtaxLiable: 'Y',
    glAccount: '500100',
    distRule: 'ADMIN',
    countryOfOrigin: 'IN',
    loc: '2',
    blanketAgreementNo: '17',
    baseEntry: '201',
    baseType: '20',
    baseLine: '0',
    udf: {
      U_PackingType: 'Bag',
    },
  });

  assert.deepEqual(documentLine, {
    ItemDescription: 'Edited invoice description',
    Quantity: 4,
    UnitPrice: 244,
    Price: 244,
    DiscountPercent: 1.5,
    TaxCode: 'GST18',
    UoMCode: 'KG',
    WarehouseCode: 'WH-02',
    WTLiable: 'tYES',
    AccountCode: '500100',
    CostingCode: 'ADMIN',
    CountryOrg: 'IN',
    LocationCode: 2,
    AgreementNo: 17,
    BaseEntry: 201,
    BaseType: 20,
    BaseLine: 0,
    U_PackingType: 'Bag',
  });
});

test('overrides a copied GRPO discount when changed to zero', () => {
  const documentLine = buildAPInvoiceDocumentLine({
    itemNo: 'RM-002',
    quantity: '1',
    unitPrice: '100',
    stdDiscount: '0',
    taxCode: 'GST12',
    uomCode: 'PCS',
    whse: 'WH-01',
    baseEntry: 202,
    baseType: 20,
    baseLine: 1,
  });

  assert.equal(documentLine.DiscountPercent, 0);
  assert.equal(documentLine.UnitPrice, 100);
  assert.equal(documentLine.TaxCode, 'GST12');
  assert.equal(documentLine.UoMCode, 'PCS');
});

test('keeps manual A/P Invoice values without adding base references', () => {
  const documentLine = buildAPInvoiceDocumentLine({
    itemNo: 'RM-003',
    itemDescription: 'Manual invoice line',
    quantity: 2,
    unitPrice: 50,
    taxCode: 'GST5',
    uomCode: 'BOX',
    whse: 'WH-01',
  });

  assert.equal(documentLine.ItemCode, 'RM-003');
  assert.equal(documentLine.UnitPrice, 50);
  assert.equal(documentLine.Price, 50);
  assert.equal(documentLine.BaseEntry, undefined);
  assert.equal(documentLine.BaseType, undefined);
  assert.equal(documentLine.BaseLine, undefined);
});

test('serializes edited UoM Name on manual A/P Invoice lines', () => {
  const documentLine = buildAPInvoiceDocumentLine({
    itemNo: 'RM-005',
    quantity: 2,
    unitPrice: 50,
    uomName: 'Mtr.',
  });

  assert.equal(documentLine.MeasureUnit, 'Mtr.');
  assert.equal(documentLine.UoMCode, undefined);
});
test('does not restore UoMCode after A/P Invoice UoM Name is cleared', () => {
  const documentLine = buildAPInvoiceDocumentLine({
    itemNo: 'RM-006',
    quantity: 2,
    unitPrice: 50,
    uomName: '',
    uomCode: 'MTR',
    uomNameEdited: true,
  });

  assert.equal(documentLine.UoMCode, undefined);
  assert.equal(documentLine.MeasureUnit, undefined);
});

test('uses MeasureUnit rather than the SAP manual marker on duplicated A/P Invoice lines', () => {
  const documentLine = buildAPInvoiceDocumentLine({
    itemNo: 'RM-007',
    quantity: 2,
    unitPrice: 50,
    uomEntry: -1,
    uomCode: 'Manual',
    uomName: 'KGS',
  });

  assert.equal(documentLine.MeasureUnit, 'KGS');
  assert.equal(documentLine.UoMCode, undefined);
});

test('uses the numeric SAP UoM entry when a standard purchase UoM is auto-loaded', () => {
  const documentLine = buildAPInvoiceDocumentLine({
    itemNo: 'RM-BOX',
    quantity: 2,
    unitPrice: 50,
    uomEntry: 9,
    uomCode: 'Box',
    uomName: 'BOX',
  });

  assert.equal(documentLine.UoMEntry, 9);
  assert.equal(documentLine.UoMCode, undefined);
  assert.equal(documentLine.MeasureUnit, undefined);
});
test('continues filtering line UDFs with the allowed SAP field set', () => {
  const documentLine = buildAPInvoiceDocumentLine(
    {
      itemNo: 'RM-004',
      quantity: 1,
      unitPrice: 25,
      udf: {
        U_Allowed: 'Yes',
        U_NotAllowed: 'No',
      },
    },
    new Set(['U_Allowed']),
  );

  assert.equal(documentLine.U_Allowed, 'Yes');
  assert.equal(documentLine.U_NotAllowed, undefined);
});

test('adds incoming batches to a direct Purchase Order based A/P Invoice line', () => {
  const documentLine = buildAPInvoiceDocumentLine({
    itemNo: 'BATCH-PO',
    quantity: 2,
    unitPrice: 50,
    whse: 'WH-01',
    baseEntry: 300,
    baseType: 22,
    baseLine: 0,
    batchManaged: true,
    batches: [
      { batchNumber: 'LOT-001', quantity: 2, supplierLotNo: 'SUP-9' },
    ],
  });

  assert.deepEqual(documentLine.BatchNumbers, [{
    BatchNumber: 'LOT-001',
    Quantity: 2,
    ManufacturerSerialNumber: 'SUP-9',
  }]);
});

test('does not reassign batches on a GRPO based A/P Invoice line', () => {
  const documentLine = buildAPInvoiceDocumentLine({
    itemNo: 'BATCH-GRPO',
    quantity: 2,
    unitPrice: 50,
    whse: 'WH-01',
    baseEntry: 301,
    baseType: 20,
    baseLine: 0,
    batchManaged: true,
    batches: [{ batchNumber: 'LOT-EXISTING', quantity: 2 }],
  });

  assert.equal(documentLine.BatchNumbers, undefined);
});

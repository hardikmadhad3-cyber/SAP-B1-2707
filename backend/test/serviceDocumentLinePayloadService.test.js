const test = require('node:test');
const assert = require('node:assert/strict');

const { buildStandardServiceLinePayload } = require('../services/serviceDocumentLinePayloadService');

test('maps only supported SAP service-line fields', () => {
  const result = buildStandardServiceLinePayload({
    description: 'Consulting service',
    glAccount: '400100',
    sQty: '2',
    unitPrice: '125.50',
    discountPercent: '5',
    taxCode: 'GST18',
    distRule: 'SALES',
    distRule2: 'NORTH',
    distRule3: 'ONLINE',
    distRule4: 'TEAM1',
    distRule5: 'ACT1',
    projectCode: 'PRJ-1',
    wtaxLiable: 'Y',
    blanketAgreementNo: '42',
    baseType: '17',
    baseEntry: '88',
    baseLine: '3',
    ItemCode: 'ITEM-ONLY',
    LineTotal: 999,
    TaxAmount: 99,
    U_StaleCompanyField: 'must-not-pass',
    unsupportedLayoutField: 'must-not-pass',
  });

  assert.deepEqual(result, {
    AccountCode: '400100',
    ItemDescription: 'Consulting service',
    Quantity: 2,
    UnitPrice: 125.5,
    DiscountPercent: 5,
    TaxCode: 'GST18',
    CostingCode: 'SALES',
    WTLiable: 'tYES',
    CostingCode2: 'NORTH',
    CostingCode3: 'ONLINE',
    CostingCode4: 'TEAM1',
    CostingCode5: 'ACT1',
    ProjectCode: 'PRJ-1',
    AgreementNo: 42,
    BaseType: 17,
    BaseEntry: 88,
    BaseLine: 3,
  });
});

test('uses SAP service defaults and omits incomplete base links', () => {
  const result = buildStandardServiceLinePayload({
    description: 'Freight service',
    glAccount: '500100',
    totalLC: '1,200',
    baseType: 17,
    baseEntry: 88,
  });

  assert.equal(result.Quantity, 1);
  assert.equal(result.UnitPrice, 1200);
  assert.equal(result.DiscountPercent, 0);
  assert.equal(result.WTLiable, 'tNO');
  assert.equal(result.BaseType, undefined);
  assert.equal(result.BaseEntry, undefined);
  assert.equal(result.BaseLine, undefined);
});

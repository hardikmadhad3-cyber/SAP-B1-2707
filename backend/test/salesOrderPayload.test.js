'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const salesOrderDb = require('../services/salesOrderDbService');
const {
  _buildDocumentLinePayload,
  _mergeCompanyCurrencyRows,
  _resolveSalesOrderDocumentCurrency,
} = require('../services/SalesOrderService');

const originalResolveSalesOrderLineUomEntry = salesOrderDb.resolveSalesOrderLineUomEntry;

test.before(() => {
  salesOrderDb.resolveSalesOrderLineUomEntry = async () => null;
});

test.after(() => {
  salesOrderDb.resolveSalesOrderLineUomEntry = originalResolveSalesOrderLineUomEntry;
});

test('does not inject warehouse or tax defaults from another SAP company', async () => {
  const payload = await _buildDocumentLinePayload({
    itemNo: 'ITEM-01',
    quantity: '1',
    unitPrice: '25',
    whse: '',
    taxCode: '',
  }, { rdr1FieldMetadata: {} });

  assert.equal(payload.WarehouseCode, '');
  assert.equal(payload.TaxCode, undefined);
  assert.notEqual(payload.WarehouseCode, '01');
  assert.notEqual(payload.TaxCode, 'IGST5');
});

test('uses only selected-company currencies without injecting INR or a common-currency list', () => {
  const currencies = _mergeCompanyCurrencyRows({
    currencies: [
      { CurrCode: 'JPY', CurrName: 'Japanese Yen' },
      { CurrCode: 'sgd', CurrName: 'Singapore Dollar' },
    ],
    localCurrency: 'SGD',
    systemCurrency: 'USD',
  });

  assert.deepEqual(currencies, [
    { CurrCode: 'JPY', CurrName: 'Japanese Yen' },
    { CurrCode: 'sgd', CurrName: 'Singapore Dollar' },
    { CurrCode: 'USD', CurrName: 'USD' },
  ]);
  assert.equal(currencies.some(({ CurrCode }) => CurrCode === 'INR'), false);
  assert.equal(currencies.some(({ CurrCode }) => CurrCode === 'EUR'), false);
});

test('resolves a missing payload currency from the selected company and business partner', () => {
  const referenceData = {
    local_currency: 'SGD',
    system_currency: 'USD',
    vendors: [
      { CardCode: 'C-USD', Currency: 'USD' },
      { CardCode: 'C-ALL', Currency: '##' },
    ],
  };

  assert.equal(_resolveSalesOrderDocumentCurrency({ vendor: 'C-USD' }, referenceData), 'USD');
  assert.equal(_resolveSalesOrderDocumentCurrency({ vendor: 'C-ALL' }, referenceData), 'SGD');
  assert.equal(_resolveSalesOrderDocumentCurrency({ vendor: 'C-ALL', currencyMode: 'SYSTEM' }, referenceData), 'USD');
  assert.equal(_resolveSalesOrderDocumentCurrency({ vendor: 'C-USD', currency: 'EUR' }, referenceData), 'EUR');
});

test('serializes editable Sales Order line fields to their Service Layer properties', async () => {
  const payload = await _buildDocumentLinePayload({
    itemNo: 'ITEM-02',
    itemDescription: 'Saved description',
    quantity: '3',
    unitPrice: '12.5',
    whse: 'W-02',
    taxCode: 'GST12',
    uomCode: 'BOX',
    cogsDistRule: 'COGS-1',
    cogsDistRule2: 'COGS-2',
    glAccount: '410000',
    loc: '7',
    blanketAgreementNo: '44',
    blanketAgreementLine: '5',
    commPercent: '2.75',
    wTaxLiable: false,
    withoutQtyPosting: true,
  }, {
    rdr1FieldMetadata: {
      CogsOcrCod: 'nvarchar',
      CogsOcrCo2: 'nvarchar',
      AcctCode: 'nvarchar',
      LocCode: 'int',
      AgrNo: 'int',
      AgrLnNum: 'int',
      CommPercent: 'numeric',
      WtLiable: 'char',
      NoInvtryMv: 'char',
    },
  });

  assert.equal(payload.ItemDescription, 'Saved description');
  assert.equal(payload.WarehouseCode, 'W-02');
  assert.equal(payload.TaxCode, 'GST12');
  assert.equal(payload.UoMCode, 'BOX');
  assert.equal(payload.COGSCostingCode, 'COGS-1');
  assert.equal(payload.COGSCostingCode2, 'COGS-2');
  assert.equal(payload.AccountCode, '410000');
  assert.equal(payload.LocationCode, 7);
  assert.equal(payload.AgreementNo, 44);
  assert.equal(payload.AgreementRowNumber, 5);
  assert.equal(payload.CommissionPercent, 2.75);
  assert.equal(payload.WTLiable, 'tNO');
  assert.equal(payload.WithoutInventoryMovement, 'tYES');
});

test('omits optional RDR1 properties that the selected company does not expose', async () => {
  const payload = await _buildDocumentLinePayload({
    itemNo: 'ITEM-03',
    quantity: '1',
    unitPrice: '10',
    whse: 'W-01',
    lineDeliveryDate: '2026-08-30',
    lineShippingType: '4',
    taxLiable: true,
    hsnCode: '1001',
    sacCode: '9983',
  }, { rdr1FieldMetadata: {} });

  assert.equal(payload.ShipDate, undefined);
  assert.equal(payload.ShippingMethod, undefined);
  assert.equal(payload.TaxOnly, undefined);
  assert.equal(payload.HSNEntry, undefined);
  assert.equal(payload.SACEntry, undefined);
});

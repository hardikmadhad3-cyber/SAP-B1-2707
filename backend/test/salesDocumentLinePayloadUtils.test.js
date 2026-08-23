'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assignMappedUdfValue,
  buildMetadataValidatedStandardLine,
  compactDocumentLinePayload,
  filterMetadataValidatedUdfDefinitions,
  filterMetadataValidatedUdfs,
  intersectPhysicalUdfKeys,
  resolveMetadataUdfKey,
} = require('../services/salesDocumentLinePayloadUtils');
const { applyUdfValues } = require('../services/udfPayloadUtils');

const QUT1_FIELDS = Object.freeze({
  ItemCode: 'nvarchar',
  Dscription: 'nvarchar',
  Quantity: 'decimal',
  Price: 'decimal',
  WhsCode: 'nvarchar',
  VatGroup: 'nvarchar',
  DiscPrcnt: 'decimal',
  OcrCode: 'nvarchar',
  OcrCode2: 'nvarchar',
  CogsOcrCod: 'nvarchar',
  AcctCode: 'nvarchar',
  FreeTxt: 'nvarchar',
  ShipDate: 'date',
  ReqDate: 'date',
  TrnsCode: 'int',
  TaxOnly: 'char',
  WtLiable: 'char',
  AgrNo: 'int',
  AgrLnNum: 'int',
  CommPercent: 'decimal',
  NoInvtryMv: 'char',
  LocCode: 'int',
  CountryOrg: 'nvarchar',
  UomEntry: 'int',
  HsnEntry: 'int',
  SACEntry: 'int',
  U_CurrentCompany: 'nvarchar',
});

test('QUT1 writable standard fields serialize from live canonical values', async () => {
  const resolverCalls = [];
  const line = await buildMetadataValidatedStandardLine({
    line: {
      lineNum: '4',
      itemNo: 'I-100',
      itemDescription: 'Live item',
      quantity: '2.5',
      unitPrice: '12.25',
      whse: 'W1',
      taxCode: 'GST18',
      stdDiscount: '5',
      distRule: 'D1',
      cogsDistRule: 'C1',
      glAccount: '410000',
      freeText: 'Line note',
      lineDeliveryDate: '2026-08-21T00:00:00',
      quotedDate: '2026-08-22',
      requiredDate: '2026-08-23T10:30:00',
      lineShippingType: '3',
      taxLiable: true,
      wTaxLiable: false,
      blanketAgreementNo: '12',
      blanketAgreementLine: '2',
      commPercent: '1.75',
      withoutQtyPosting: 'Y',
      loc: '8',
      countryOfOrigin: 'IN',
      uomCode: 'BOX',
      hsnCode: '1001',
      sacCode: '9983',
      baseType: '17',
      baseEntry: '90',
      baseLine: '1',
      values: { CostingCode2: 'D2' },
    },
    fieldMetadata: QUT1_FIELDS,
    includeLineNum: true,
    resolveUomEntry: async (itemCode, uomCode) => {
      resolverCalls.push([itemCode, uomCode]);
      return 7;
    },
    resolveHsnEntry: async () => 44,
    resolveSacEntry: async () => 55,
  });

  assert.deepEqual(resolverCalls, [['I-100', 'BOX']]);
  assert.deepEqual(line, {
    LineNum: 4,
    ItemCode: 'I-100',
    ItemDescription: 'Live item',
    Quantity: 2.5,
    UnitPrice: 12.25,
    WarehouseCode: 'W1',
    TaxCode: 'GST18',
    DiscountPercent: 5,
    CostingCode: 'D1',
    CostingCode2: 'D2',
    COGSCostingCode: 'C1',
    AccountCode: '410000',
    FreeText: 'Line note',
    ShipDate: '2026-08-21',
    RequiredDate: '2026-08-23',
    ShippingMethod: 3,
    TaxOnly: 'tYES',
    WTLiable: 'tNO',
    AgreementNo: 12,
    AgreementRowNumber: 2,
    CommissionPercent: 1.75,
    WithoutInventoryMovement: 'tYES',
    LocationCode: 8,
    CountryOrg: 'IN',
    UoMEntry: 7,
    HSNEntry: 44,
    SACEntry: 55,
    BaseType: 17,
    BaseEntry: 90,
    BaseLine: 1,
  });
});

test('ShipDate is canonical on INV1/RIN1 while quotation RequiredDate is physical-field gated', async () => {
  const source = {
    itemNo: 'I-200',
    quantity: 1,
    unitPrice: 5,
    lineDeliveryDate: '2026-09-01',
    quotedDate: '2026-09-02',
    requiredDate: '2026-09-03',
  };
  const quotationLine = await buildMetadataValidatedStandardLine({
    line: source,
    fieldMetadata: { ShipDate: 'date', ReqDate: 'date' },
  });
  const invoiceOrCreditLine = await buildMetadataValidatedStandardLine({
    line: source,
    fieldMetadata: { SHIPDATE: { dataType: 'DATE' } },
  });

  assert.equal(quotationLine.ShipDate, '2026-09-01');
  assert.equal(quotationLine.RequiredDate, '2026-09-03');
  assert.equal(invoiceOrCreditLine.ShipDate, '2026-09-01');
  assert.equal(Object.hasOwn(invoiceOrCreditLine, 'RequiredDate'), false);
});

test('base-document links remain structural when a caller omits ItemCode', async () => {
  const line = await buildMetadataValidatedStandardLine({
    line: {
      itemNo: 'SOURCE-ITEM',
      quantity: 3,
      unitPrice: 9,
      baseType: 17,
      baseEntry: 120,
      baseLine: 2,
    },
    fieldMetadata: { ItemCode: 'nvarchar', Quantity: 'decimal', Price: 'decimal' },
    includeItemCode: false,
  });

  assert.equal(Object.hasOwn(line, 'ItemCode'), false);
  assert.deepEqual({
    BaseType: line.BaseType,
    BaseEntry: line.BaseEntry,
    BaseLine: line.BaseLine,
  }, { BaseType: 17, BaseEntry: 120, BaseLine: 2 });
});

test('an unsupported numeric UoM entry is never mislabeled as UoMCode', async () => {
  const line = await buildMetadataValidatedStandardLine({
    line: { itemNo: 'I-250', quantity: 1, unitPrice: 1, uomEntry: 7 },
    fieldMetadata: { UomCode: 'nvarchar' },
  });

  assert.equal(Object.hasOwn(line, 'UoMEntry'), false);
  assert.equal(Object.hasOwn(line, 'UoMCode'), false);
});

test('PATCH callers can explicitly clear a supported discount without changing create defaults', async () => {
  const source = { itemNo: 'I-255', quantity: 1, unitPrice: 10, stdDiscount: '' };
  const createLine = await buildMetadataValidatedStandardLine({
    line: source,
    fieldMetadata: { DiscPrcnt: 'decimal' },
  });
  const updateLine = await buildMetadataValidatedStandardLine({
    line: source,
    fieldMetadata: { DiscPrcnt: 'decimal' },
    defaultDiscountPercent: 0,
  });
  const unsupportedLine = await buildMetadataValidatedStandardLine({
    line: source,
    fieldMetadata: { ItemCode: 'nvarchar' },
    defaultDiscountPercent: 0,
  });

  assert.equal(Object.hasOwn(createLine, 'DiscountPercent'), false);
  assert.equal(updateLine.DiscountPercent, 0);
  assert.equal(Object.hasOwn(unsupportedLine, 'DiscountPercent'), false);
});

test('explicit HSN/SAC entries serialize without treating numeric codes as entries', async () => {
  const direct = await buildMetadataValidatedStandardLine({
    line: { itemNo: 'I-260', quantity: 1, unitPrice: 1, hsnEntry: 44, sacEntry: 55 },
    fieldMetadata: { HsnEntry: 'int', SacEntry: 'int' },
  });
  const unresolvedCodes = await buildMetadataValidatedStandardLine({
    line: { itemNo: 'I-260', quantity: 1, unitPrice: 1, hsnCode: '1001', sacCode: '9983' },
    fieldMetadata: { HsnEntry: 'int', SacEntry: 'int' },
  });

  assert.equal(direct.HSNEntry, 44);
  assert.equal(direct.SACEntry, 55);
  assert.equal(Object.hasOwn(unresolvedCodes, 'HSNEntry'), false);
  assert.equal(Object.hasOwn(unresolvedCodes, 'SACEntry'), false);
});

test('unavailable physical metadata uses only SAP-standard fallback fields and emits no UDFs', async () => {
  const line = await buildMetadataValidatedStandardLine({
    line: {
      itemNo: 'I-300',
      quantity: '2',
      unitPrice: '',
      whse: '01',
      taxCode: 'EXEMPT',
      stdDiscount: '',
      distRule: 'D1',
      freeText: 'Fallback note',
      lineDeliveryDate: '2026-10-01',
      requiredDate: '2026-10-02',
      wTaxLiable: false,
      glAccount: '410000',
      countryOfOrigin: 'IN',
      hsnCode: '1001',
      uomCode: 'EA',
    },
    fieldMetadata: {},
    resolveHsnEntry: async () => 99,
  });

  assert.deepEqual(line, {
    ItemCode: 'I-300',
    Quantity: 2,
    WarehouseCode: '01',
    TaxCode: 'EXEMPT',
    CostingCode: 'D1',
    FreeText: 'Fallback note',
    ShipDate: '2026-10-01',
    UoMCode: 'EA',
  });
  assert.equal(Object.values(line).some((value) => Number.isNaN(value)), false);

  const allowed = new Set(['U_CurrentCompany', 'U_StaticLegacy']);
  assert.deepEqual([...intersectPhysicalUdfKeys(allowed, {})], []);
  assert.deepEqual(filterMetadataValidatedUdfs({
    U_CurrentCompany: 'value',
    U_StaticLegacy: 'default',
  }, allowed, {}), {});

  const headerPayload = {};
  applyUdfValues(headerPayload, { U_StaticLegacy: 'default' }, new Set(), new Map());
  assert.deepEqual(headerPayload, {});
});

test('generic and legacy UDF values are limited to current physical CUFD-backed columns', () => {
  const allowed = new Set(['U_CurrentCompany', 'U_MissingPhysical']);
  const metadata = {
    ItemCode: 'nvarchar',
    u_currentcompany: 'nvarchar',
    U_PhysicalButNotAllowed: 'nvarchar',
  };
  const physicalKeys = intersectPhysicalUdfKeys(allowed, metadata);
  const values = filterMetadataValidatedUdfs({
    U_CurrentCompany: 'live',
    U_MissingPhysical: 'static-default',
    U_PhysicalButNotAllowed: 'unknown',
    U_Unknown: 'unknown',
  }, physicalKeys, metadata);

  assert.deepEqual([...physicalKeys], ['U_CurrentCompany']);
  assert.deepEqual(values, { U_CurrentCompany: 'live' });

  const definitions = filterMetadataValidatedUdfDefinitions(new Map([
    ['U_CurrentCompany', { key: 'U_CurrentCompany' }],
    ['U_MissingPhysical', { key: 'U_MissingPhysical' }],
  ]), metadata);
  assert.deepEqual([...definitions.keys()], ['U_CurrentCompany']);
  assert.deepEqual([...filterMetadataValidatedUdfDefinitions(definitions, {}).keys()], []);
  assert.equal(resolveMetadataUdfKey(
    new Map([['U_PLACE_OF_SUPPLY', { key: 'U_PLACE_OF_SUPPLY' }]]),
    ['U_PlaceOfSupply', 'U_PLACE_OF_SUPPLY'],
  ), 'U_PLACE_OF_SUPPLY');
});

test('legacy UDF aliases do not overwrite an entered live UDF with an unavailable mapped value', () => {
  const values = { U_Unit_Price: '125.50' };
  const normalize = (value) => (value == null || value === '' ? null : value);

  assignMappedUdfValue(values, 'U_Unit_Price', undefined, normalize);
  assignMappedUdfValue(values, 'U_Required_Date', undefined, normalize);
  assignMappedUdfValue(values, 'U_Unit_Price', '130.00', normalize);

  assert.deepEqual(values, {
    U_Unit_Price: '130.00',
  });
});

test('quotation PATCH compaction preserves only explicit null UDF clears', () => {
  const values = {
    ItemCode: 'I-400',
    AccountCode: null,
    U_LiveClear: null,
    U_Undefined: undefined,
    FreeText: '',
  };

  assert.deepEqual(compactDocumentLinePayload(values), { ItemCode: 'I-400' });
  assert.deepEqual(compactDocumentLinePayload(values, { preserveNullUdfs: true }), {
    ItemCode: 'I-400',
    U_LiveClear: null,
  });
});

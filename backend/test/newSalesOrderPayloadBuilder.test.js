const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertValidNewSalesOrderForm,
  validateNewSalesOrderForm,
} = require('../modules/newSalesOrder/newSalesOrderValidationService');
const { buildNewSalesOrderPayload } = require('../modules/newSalesOrder/newSalesOrderPayloadBuilder');
const {
  companyAFormData,
  companyASchema,
  companyBFormData,
  companyBSchema,
} = require('./fixtures/newSalesOrderDummyFixtures');

const allowFixtureLookup = async ({ value }) => ({ valid: ['C00001', 'C00002', 'ITEM001', 'ITEM002', 'CONT-20', 'Q-A'].includes(value) });

test('validates and serializes standard and dynamically discovered Company A UDF fields', async () => {
  const canonicalFormData = await assertValidNewSalesOrderForm({
    schema: companyASchema,
    formData: companyAFormData,
    validateLookupValue: allowFixtureLookup,
  });
  const payload = buildNewSalesOrderPayload({ schema: companyASchema, canonicalFormData });

  assert.deepEqual(payload, {
    CardCode: 'C00001',
    DocDate: '2026-08-03',
    Comments: 'Dummy New Sales Order test',
    DocumentLines: [{
      ItemCode: 'ITEM001',
      Quantity: 5.25,
      UnitPrice: 100,
      U_PackingType: 'BOX',
      U_GrossWt: 50.5,
      U_TotalPackage: 3,
      U_ContainerType: 'CONT-20',
      U_NewLiveField: 'automatic',
    }],
  });
});

test('serializes Company B date and checkbox fields without carrying Company A UDFs', async () => {
  const canonicalFormData = await assertValidNewSalesOrderForm({
    schema: companyBSchema,
    formData: companyBFormData,
    validateLookupValue: allowFixtureLookup,
  });
  const payload = buildNewSalesOrderPayload({ schema: companyBSchema, canonicalFormData });

  assert.equal(payload.DocumentLines[0].U_Quality, 'Q-A');
  assert.equal(payload.DocumentLines[0].U_ExpectedDate, '2026-08-10');
  assert.equal(payload.DocumentLines[0].U_Approved, 'tYES');
  assert.equal(payload.DocumentLines[0].UnitPrice, null);
  assert.equal(payload.DocumentLines[0].U_GrossWt, undefined);
  assert.equal(payload.DocumentLines[0].U_TotalPackage, undefined);
});

test('validates and serializes an A/R Invoice using its live OINV/INV1 schema tables', async () => {
  const schema = {
    documentType: 'AR_INVOICE',
    headerTable: 'OINV',
    lineTable: 'INV1',
    headerFields: [{
      id: 'OINV.CardCode',
      tableName: 'OINV',
      stateKey: 'customerCode',
      sapField: 'CardCode',
      databaseField: 'CardCode',
      type: 'text',
      storage: 'standard',
      required: true,
    }],
    lineFields: [{
      id: 'INV1.ItemCode',
      tableName: 'INV1',
      stateKey: 'itemNo',
      sapField: 'ItemCode',
      databaseField: 'ItemCode',
      type: 'text',
      storage: 'standard',
      required: true,
    }, {
      id: 'INV1.U_LiveInvoiceField',
      tableName: 'INV1',
      stateKey: 'U_LiveInvoiceField',
      sapField: 'U_LiveInvoiceField',
      databaseField: 'U_LiveInvoiceField',
      type: 'text',
      storage: 'udf',
    }],
  };
  const canonicalFormData = await assertValidNewSalesOrderForm({
    schema,
    formData: {
      header: { values: { customerCode: 'C00001' }, udf: {} },
      lines: [{ values: { itemNo: 'ITEM001' }, udf: { U_LiveInvoiceField: 'LIVE' } }],
    },
  });
  const payload = buildNewSalesOrderPayload({ schema, canonicalFormData });

  assert.deepEqual(payload, {
    CardCode: 'C00001',
    DocumentLines: [{ ItemCode: 'ITEM001', U_LiveInvoiceField: 'LIVE' }],
  });
});

test('rejects schema tables that do not match the active document profile', async () => {
  await assert.rejects(
    validateNewSalesOrderForm({
      schema: { ...companyASchema, documentType: 'AR_INVOICE' },
      formData: companyAFormData,
    }),
    (error) => error.statusCode === 500 && error.code === 'INVALID_SCHEMA',
  );
});

test('rejects an arbitrary UDF that is absent from the current company schema', async () => {
  const formData = structuredClone(companyBFormData);
  formData.lines[0].udf.U_GrossWt = '99.5';
  const result = await validateNewSalesOrderForm({
    schema: companyBSchema,
    formData,
    validateLookupValue: allowFixtureLookup,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'unknown_field' && error.path.endsWith('U_GrossWt')));
});

test('stores dropdown codes and rejects display labels', async () => {
  const formData = structuredClone(companyAFormData);
  formData.lines[0].udf.U_PackingType = 'Box';
  const result = await validateNewSalesOrderForm({
    schema: companyASchema,
    formData,
    validateLookupValue: allowFixtureLookup,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.fieldId === 'RDR1.U_PackingType' && error.code === 'invalid_option'));
});

test('rejects decimals in integer fields and enforces numeric scale', async () => {
  const formData = structuredClone(companyAFormData);
  formData.lines[0].udf.U_TotalPackage = '3.5';
  formData.lines[0].udf.U_GrossWt = '1.1234567';
  const result = await validateNewSalesOrderForm({
    schema: companyASchema,
    formData,
    validateLookupValue: allowFixtureLookup,
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.fieldId === 'RDR1.U_TotalPackage' && error.code === 'integer_required'));
  assert.ok(result.errors.some((error) => error.fieldId === 'RDR1.U_GrossWt' && error.code === 'scale_exceeded'));
});

test('requires current-company validation for lookup fields without inline options', async () => {
  await assert.rejects(
    assertValidNewSalesOrderForm({ schema: companyASchema, formData: companyAFormData }),
    (error) => error.statusCode === 503 && error.code === 'LOOKUP_VALIDATION_UNAVAILABLE',
  );
});

test('rejects user changes to read-only and display-only fields', async () => {
  const formData = structuredClone(companyAFormData);
  formData.header.values.docNum = '123';
  const result = await validateNewSalesOrderForm({
    schema: companyASchema,
    formData,
    validateLookupValue: allowFixtureLookup,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.fieldId === 'ORDR.DocNum' && error.code === 'read_only'));
});

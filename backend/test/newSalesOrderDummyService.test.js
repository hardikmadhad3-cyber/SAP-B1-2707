const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createNewSalesOrderDummyService,
  saveNewSalesOrderDummy,
  validateNewSalesOrderDummy,
} = require('../modules/newSalesOrder/newSalesOrderDummyService');
const {
  companyAFormData,
  companyASchema,
} = require('./fixtures/newSalesOrderDummyFixtures');

const trustedContext = { companyId: 1, companyDb: 'DUMMY_COMPANY_A', userCode: 'tester-a' };
const validateLookupValue = async () => ({ valid: true });

test('validation returns the controller contract without writing a draft', async () => {
  const result = await validateNewSalesOrderDummy({
    currentSchema: companyASchema,
    trustedContext,
    schemaVersion: 'schema-a-v1',
    formData: companyAFormData,
    validateLookupValue,
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.payload.CardCode, 'C00001');
  assert.equal(result.payload.DocumentLines[0].U_NewLiveField, 'automatic');
});

test('dummy save persists only through the injected local repository and returns draft plus payload', async () => {
  const calls = [];
  const repository = {
    saveDummyDraft: async (draft) => {
      calls.push(draft);
      return { id: 1, dummyDocumentNumber: 'NSO-TEST-000001', ...draft };
    },
  };
  const result = await saveNewSalesOrderDummy({
    currentSchema: companyASchema,
    trustedContext,
    schemaVersion: 'schema-a-v1',
    formData: companyAFormData,
    validateLookupValue,
    repository,
    environment: { NEW_SALES_ORDER_USE_DUMMY_SAVE: 'true' },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].companyId, 1);
  assert.equal(calls[0].companyDb, 'DUMMY_COMPANY_A');
  assert.equal(calls[0].userCode, 'tester-a');
  assert.equal(result.draft.dummyDocumentNumber, 'NSO-TEST-000001');
  assert.deepEqual(result.draft.generatedPayload, result.payload);
});

test('factory blocks disabled dummy mode before schema loading or persistence', async () => {
  let schemaCalls = 0;
  let repositoryCalls = 0;
  const service = createNewSalesOrderDummyService({
    getCurrentSchema: async () => {
      schemaCalls += 1;
      return companyASchema;
    },
    validateLookupValue,
    repository: { saveDummyDraft: async () => { repositoryCalls += 1; } },
    environment: { NEW_SALES_ORDER_USE_DUMMY_SAVE: 'TRUE' },
  });

  await assert.rejects(
    service.saveDummy({ trustedContext, schemaVersion: 'schema-a-v1', formData: companyAFormData }),
    (error) => error.statusCode === 503 && error.code === 'NEW_SALES_ORDER_DUMMY_SAVE_DISABLED',
  );
  assert.equal(schemaCalls, 0);
  assert.equal(repositoryCalls, 0);
});

test('rejects stale schema and mismatched trusted company scope before persistence', async () => {
  let repositoryCalls = 0;
  const repository = { saveDummyDraft: async () => { repositoryCalls += 1; } };

  await assert.rejects(
    saveNewSalesOrderDummy({
      currentSchema: companyASchema,
      trustedContext,
      schemaVersion: 'stale-v0',
      formData: companyAFormData,
      validateLookupValue,
      repository,
      environment: { NEW_SALES_ORDER_USE_DUMMY_SAVE: 'true' },
    }),
    (error) => error.statusCode === 409 && error.code === 'SCHEMA_VERSION_MISMATCH',
  );
  await assert.rejects(
    saveNewSalesOrderDummy({
      currentSchema: companyASchema,
      trustedContext: { ...trustedContext, companyDb: 'ATTACKER_DB' },
      schemaVersion: 'schema-a-v1',
      formData: companyAFormData,
      validateLookupValue,
      repository,
      environment: { NEW_SALES_ORDER_USE_DUMMY_SAVE: 'true' },
    }),
    (error) => error.statusCode === 403 && error.code === 'SCHEMA_SCOPE_MISMATCH',
  );
  assert.equal(repositoryCalls, 0);
});

const {
  assertValidNewSalesOrderForm,
  createHttpError,
  validateNewSalesOrderForm,
} = require('./newSalesOrderValidationService');
const { buildNewSalesOrderPayload } = require('./newSalesOrderPayloadBuilder');
const dummyRepository = require('./newSalesOrderDummyRepository');
const { assertDummySaveEnabled } = require('./newSalesOrderWriteProtection');

const text = (value) => String(value ?? '').trim();

const assertCurrentSchemaVersion = (currentSchema, submittedSchemaVersion) => {
  const current = text(currentSchema?.schemaVersion);
  const submitted = text(submittedSchemaVersion);
  if (!current) {
    throw createHttpError(500, 'The current schema has no schemaVersion.', undefined, 'INVALID_SCHEMA');
  }
  if (!submitted) {
    throw createHttpError(400, 'schemaVersion is required.', undefined, 'SCHEMA_VERSION_REQUIRED');
  }
  if (submitted !== current) {
    throw createHttpError(
      409,
      'The New Sales Order schema changed. Reload the form before continuing.',
      { submittedSchemaVersion: submitted, currentSchemaVersion: current },
      'SCHEMA_VERSION_MISMATCH',
    );
  }
  return current;
};

const resolveTrustedScope = ({ currentSchema, trustedContext = {} }) => {
  const companyId = Number(trustedContext.companyId ?? currentSchema?.companyId);
  const companyDb = text(trustedContext.companyDb ?? trustedContext.dbName ?? currentSchema?.companyDb);
  const userCode = text(trustedContext.userCode ?? trustedContext.username ?? currentSchema?.userCode);
  if (!Number.isSafeInteger(companyId) || companyId <= 0 || !companyDb || !userCode) {
    throw createHttpError(500, 'Trusted company and user scope is incomplete.', undefined, 'INVALID_TRUSTED_SCOPE');
  }

  if (currentSchema?.companyId != null && Number(currentSchema.companyId) !== companyId) {
    throw createHttpError(403, 'Current schema does not match the selected company.', undefined, 'SCHEMA_SCOPE_MISMATCH');
  }
  if (text(currentSchema?.companyDb) && text(currentSchema.companyDb).toUpperCase() !== companyDb.toUpperCase()) {
    throw createHttpError(403, 'Current schema database does not match the selected company.', undefined, 'SCHEMA_SCOPE_MISMATCH');
  }
  if (text(currentSchema?.userCode) && text(currentSchema.userCode).toUpperCase() !== userCode.toUpperCase()) {
    throw createHttpError(403, 'Current schema user does not match the authenticated user.', undefined, 'SCHEMA_SCOPE_MISMATCH');
  }

  return { companyId, companyDb, userCode };
};

const scopedLookupValidator = (validateLookupValue, trustedContext) => (
  typeof validateLookupValue === 'function'
    ? (input) => validateLookupValue({ ...input, trustedContext })
    : undefined
);

const validateNewSalesOrderDummy = async ({
  currentSchema,
  trustedContext = {},
  schemaVersion,
  formData,
  validateLookupValue,
} = {}) => {
  assertCurrentSchemaVersion(currentSchema, schemaVersion);
  resolveTrustedScope({ currentSchema, trustedContext });
  const validation = await validateNewSalesOrderForm({
    schema: currentSchema,
    formData,
    validateLookupValue: scopedLookupValidator(validateLookupValue, trustedContext),
  });
  return {
    valid: validation.valid,
    errors: validation.errors,
    payload: validation.valid
      ? buildNewSalesOrderPayload({ schema: currentSchema, canonicalFormData: validation.canonicalFormData })
      : null,
    canonicalFormData: validation.canonicalFormData,
  };
};

const saveNewSalesOrderDummy = async ({
  currentSchema,
  trustedContext = {},
  schemaVersion,
  formData,
  validateLookupValue,
  repository = dummyRepository,
  environment = process.env,
} = {}) => {
  assertDummySaveEnabled(environment);
  const currentVersion = assertCurrentSchemaVersion(currentSchema, schemaVersion);
  const scope = resolveTrustedScope({ currentSchema, trustedContext });
  const canonicalFormData = await assertValidNewSalesOrderForm({
    schema: currentSchema,
    formData,
    validateLookupValue: scopedLookupValidator(validateLookupValue, trustedContext),
  });
  const payload = buildNewSalesOrderPayload({ schema: currentSchema, canonicalFormData });
  if (!repository || typeof repository.saveDummyDraft !== 'function') {
    throw createHttpError(500, 'A local dummy-draft repository is required.', undefined, 'DUMMY_REPOSITORY_REQUIRED');
  }

  const draft = await repository.saveDummyDraft({
    ...scope,
    schemaVersion: currentVersion,
    formData: canonicalFormData,
    generatedPayload: payload,
    validationStatus: 'validated',
  });
  return { draft, payload };
};

const createNewSalesOrderDummyService = ({
  getCurrentSchema,
  validateLookupValue,
  repository = dummyRepository,
  environment = process.env,
} = {}) => {
  if (typeof getCurrentSchema !== 'function') {
    throw createHttpError(500, 'getCurrentSchema is required.', undefined, 'SCHEMA_LOADER_REQUIRED');
  }

  const loadSchema = async (trustedContext) => {
    const currentSchema = await getCurrentSchema(trustedContext);
    if (!currentSchema || typeof currentSchema !== 'object') {
      throw createHttpError(500, 'Current schema could not be loaded.', undefined, 'INVALID_SCHEMA');
    }
    return currentSchema;
  };

  return {
    validateDummy: async ({ trustedContext = {}, schemaVersion, formData } = {}) =>
      validateNewSalesOrderDummy({
        currentSchema: await loadSchema(trustedContext),
        trustedContext,
        schemaVersion,
        formData,
        validateLookupValue,
      }),
    saveDummy: async ({ trustedContext = {}, schemaVersion, formData } = {}) => {
      assertDummySaveEnabled(environment);
      return saveNewSalesOrderDummy({
          currentSchema: await loadSchema(trustedContext),
          trustedContext,
          schemaVersion,
          formData,
          validateLookupValue,
          repository,
          environment,
        });
    },
  };
};

module.exports = {
  assertCurrentSchemaVersion,
  createNewSalesOrderDummyService,
  resolveTrustedScope,
  saveNewSalesOrderDummy,
  validateNewSalesOrderDummy,
};

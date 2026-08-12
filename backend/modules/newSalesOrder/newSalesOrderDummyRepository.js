const authDbService = require('../../services/authDbService');

const TABLE_NAME = 'new_sales_order_dummy_drafts';

const text = (value) => String(value ?? '').trim();

const createRepositoryError = (message, code = 'INVALID_DUMMY_DRAFT') => {
  const error = new Error(message);
  error.statusCode = 500;
  error.code = code;
  return error;
};

const formatDummyDocumentNumber = (id) => {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw createRepositoryError('A valid local dummy draft id is required.');
  }
  return `NSO-TEST-${String(numericId).padStart(6, '0')}`;
};

const parseJson = (value, fieldName) => {
  try {
    return JSON.parse(String(value || 'null'));
  } catch (_error) {
    throw createRepositoryError(`Stored ${fieldName} is not valid JSON.`, 'CORRUPT_DUMMY_DRAFT');
  }
};

const mapDraftRow = (row) => {
  if (!row) return null;
  return {
    id: Number(row.id),
    dummyDocumentNumber: row.dummyDocumentNumber,
    companyId: Number(row.companyId),
    companyDb: row.companyDb,
    userCode: row.userCode,
    schemaVersion: row.schemaVersion,
    formData: parseJson(row.formDataJson, 'formDataJson'),
    generatedPayload: parseJson(row.generatedPayloadJson, 'generatedPayloadJson'),
    validationStatus: row.validationStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

const normalizeDraft = (draft = {}) => {
  const companyId = Number(draft.companyId);
  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw createRepositoryError('A valid trusted companyId is required.');
  }

  const companyDb = text(draft.companyDb);
  const userCode = text(draft.userCode);
  const schemaVersion = text(draft.schemaVersion);
  if (!companyDb || !userCode || !schemaVersion) {
    throw createRepositoryError('companyDb, userCode, and schemaVersion are required.');
  }
  if (!draft.formData || typeof draft.formData !== 'object' || Array.isArray(draft.formData)) {
    throw createRepositoryError('Validated formData is required.');
  }
  if (!draft.generatedPayload || typeof draft.generatedPayload !== 'object' || Array.isArray(draft.generatedPayload)) {
    throw createRepositoryError('A generated dummy payload is required.');
  }

  return {
    companyId,
    companyDb,
    userCode,
    schemaVersion,
    formDataJson: JSON.stringify(draft.formData),
    generatedPayloadJson: JSON.stringify(draft.generatedPayload),
    validationStatus: text(draft.validationStatus) || 'validated',
  };
};

const createNewSalesOrderDummyRepository = ({ authDb = authDbService } = {}) => {
  if (!authDb || typeof authDb.transaction !== 'function') {
    throw createRepositoryError('An auth SQLite transaction provider is required.');
  }

  const saveDummyDraft = async (draft) => {
    const normalized = normalizeDraft(draft);
    return authDb.transaction(async (tx) => {
      const inserted = await tx.query(`
        INSERT INTO ${TABLE_NAME} (
          dummyDocumentNumber,
          companyId,
          companyDb,
          userCode,
          schemaVersion,
          formDataJson,
          generatedPayloadJson,
          validationStatus,
          createdAt,
          updatedAt
        ) VALUES (
          NULL,
          @companyId,
          @companyDb,
          @userCode,
          @schemaVersion,
          @formDataJson,
          @generatedPayloadJson,
          @validationStatus,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `, normalized);

      const id = Number(inserted.lastInsertId);
      const dummyDocumentNumber = formatDummyDocumentNumber(id);
      await tx.query(`
        UPDATE ${TABLE_NAME}
        SET dummyDocumentNumber = @dummyDocumentNumber,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = @id
      `, { id, dummyDocumentNumber });

      const row = await tx.queryOne(`
        SELECT
          id,
          dummyDocumentNumber,
          companyId,
          companyDb,
          userCode,
          schemaVersion,
          formDataJson,
          generatedPayloadJson,
          validationStatus,
          createdAt,
          updatedAt
        FROM ${TABLE_NAME}
        WHERE id = @id
          AND companyId = @companyId
          AND userCode = @userCode
      `, {
        id,
        companyId: normalized.companyId,
        userCode: normalized.userCode,
      });

      if (!row) {
        throw createRepositoryError('The local dummy draft could not be reloaded after saving.');
      }
      return mapDraftRow(row);
    });
  };

  const findDummyDraftForScope = async ({ id, companyId, userCode }) => {
    const row = await authDb.queryOne(`
      SELECT
        id,
        dummyDocumentNumber,
        companyId,
        companyDb,
        userCode,
        schemaVersion,
        formDataJson,
        generatedPayloadJson,
        validationStatus,
        createdAt,
        updatedAt
      FROM ${TABLE_NAME}
      WHERE id = @id
        AND companyId = @companyId
        AND userCode = @userCode
    `, {
      id: Number(id),
      companyId: Number(companyId),
      userCode: text(userCode),
    });
    return mapDraftRow(row);
  };

  return {
    findDummyDraftForScope,
    saveDummyDraft,
  };
};

const defaultRepository = createNewSalesOrderDummyRepository();

module.exports = {
  TABLE_NAME,
  createNewSalesOrderDummyRepository,
  findDummyDraftForScope: defaultRepository.findDummyDraftForScope,
  formatDummyDocumentNumber,
  mapDraftRow,
  saveDummyDraft: defaultRepository.saveDummyDraft,
};

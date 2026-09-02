'use strict';

const authDbService = require('../../services/authDbService');

const text = (value) => String(value ?? '').trim();

const createSalesDocumentFieldConfigRepository = ({ authDb = authDbService } = {}) => {
  if (!authDb || typeof authDb.queryRows !== 'function' || typeof authDb.transaction !== 'function') {
    throw new TypeError('An auth database service with queryRows and transaction is required.');
  }

  const list = async (companyId, documentType) => authDb.queryRows(`
    SELECT LookupConfigurationId, CompanyId, DocumentType, FieldId, LookupSource,
      CreatedByUserId, UpdatedByUserId, CreatedAt, UpdatedAt
    FROM SalesDocumentFieldLookupConfigurations
    WHERE CompanyId = @companyId
      AND DocumentType = @documentType
    ORDER BY FieldId
  `, {
    companyId: Number(companyId),
    documentType: text(documentType).toUpperCase(),
  });

  const replace = async ({ companyId, documentType, userId, assignments }) => authDb.transaction(async (db) => {
    const scope = {
      companyId: Number(companyId),
      documentType: text(documentType).toUpperCase(),
    };
    await db.query(`
      DELETE FROM SalesDocumentFieldLookupConfigurations
      WHERE CompanyId = @companyId
        AND DocumentType = @documentType
    `, scope);

    for (const assignment of assignments) {
      await db.query(`
        INSERT INTO SalesDocumentFieldLookupConfigurations (
          CompanyId, DocumentType, FieldId, LookupSource,
          CreatedByUserId, UpdatedByUserId, CreatedAt, UpdatedAt
        ) VALUES (
          @companyId, @documentType, @fieldId, @lookupSource,
          @userId, @userId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, {
        ...scope,
        fieldId: assignment.fieldId,
        lookupSource: assignment.lookupSource,
        userId: Number(userId),
      });
    }

    return assignments.length;
  });

  return { list, replace };
};

const defaultRepository = createSalesDocumentFieldConfigRepository();

module.exports = defaultRepository;
module.exports.createSalesDocumentFieldConfigRepository = createSalesDocumentFieldConfigRepository;

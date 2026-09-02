'use strict';

const authDbService = require('../../services/authDbService');

const createSalesDocumentCustomLookupRepository = ({ authDb = authDbService } = {}) => {
  const list = (companyId) => authDb.queryRows(`
    SELECT CustomLookupId, CompanyId, LookupName, QueryText,
      CreatedByUserId, UpdatedByUserId, CreatedAt, UpdatedAt
    FROM SalesDocumentCustomLookups
    WHERE CompanyId = @companyId
    ORDER BY LookupName, CustomLookupId
  `, { companyId: Number(companyId) });

  const findById = (companyId, customLookupId) => authDb.queryOne(`
    SELECT CustomLookupId, CompanyId, LookupName, QueryText,
      CreatedByUserId, UpdatedByUserId, CreatedAt, UpdatedAt
    FROM SalesDocumentCustomLookups
    WHERE CompanyId = @companyId AND CustomLookupId = @customLookupId
  `, { companyId: Number(companyId), customLookupId: Number(customLookupId) });

  const save = async ({ customLookupId, companyId, lookupName, queryText, userId }) => {
    const params = {
      customLookupId: Number(customLookupId) || null,
      companyId: Number(companyId),
      lookupName: String(lookupName || '').trim(),
      queryText: String(queryText || '').trim(),
      userId: Number(userId),
    };
    if (params.customLookupId) {
      const result = await authDb.query(`
        UPDATE SalesDocumentCustomLookups
        SET LookupName = @lookupName, QueryText = @queryText,
          UpdatedByUserId = @userId, UpdatedAt = CURRENT_TIMESTAMP
        WHERE CompanyId = @companyId AND CustomLookupId = @customLookupId
      `, params);
      if (!Number(result.rowsAffected?.[0] || 0)) return null;
      return findById(params.companyId, params.customLookupId);
    }
    const result = await authDb.query(`
      INSERT INTO SalesDocumentCustomLookups (
        CompanyId, LookupName, QueryText, CreatedByUserId, UpdatedByUserId, CreatedAt, UpdatedAt
      ) VALUES (
        @companyId, @lookupName, @queryText, @userId, @userId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, {
      companyId: params.companyId,
      lookupName: params.lookupName,
      queryText: params.queryText,
      userId: params.userId,
    });
    return findById(params.companyId, Number(result.lastInsertId));
  };

  return { findById, list, save };
};

const defaultRepository = createSalesDocumentCustomLookupRepository();
module.exports = defaultRepository;
module.exports.createSalesDocumentCustomLookupRepository = createSalesDocumentCustomLookupRepository;

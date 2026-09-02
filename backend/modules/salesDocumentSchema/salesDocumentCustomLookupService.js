'use strict';

const repository = require('./salesDocumentCustomLookupRepository');
const readOnlyDbService = require('../newSalesOrder/newSalesOrderReadOnlyDbService');
const { createHttpError } = require('../newSalesOrder/newSalesOrderContextService');

const text = (value) => String(value ?? '').trim();
const MAX_QUERY_LENGTH = 20000;
const REQUIRED_ALIAS = (alias) => new RegExp(`\\bAS\\s+(?:\\[${alias}\\]|\"${alias}\"|${alias}\\b)`, 'i');

const normalizeInput = (body = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError(400, 'A JSON request body is required.', 'INVALID_CUSTOM_LOOKUP');
  }
  const unknown = Object.keys(body).find((key) => !['id', 'name', 'queryText'].includes(key));
  if (unknown) throw createHttpError(400, `Unknown custom lookup field ${unknown}.`, 'UNKNOWN_CUSTOM_LOOKUP_FIELD');
  const id = body.id === undefined || body.id === null || body.id === '' ? null : Number(body.id);
  const name = text(body.name);
  const queryText = text(body.queryText);
  if (id !== null && (!Number.isInteger(id) || id <= 0)) {
    throw createHttpError(400, 'Custom lookup id must be a positive integer.', 'INVALID_CUSTOM_LOOKUP_ID');
  }
  if (!name || name.length > 100) {
    throw createHttpError(400, 'Custom lookup name is required and limited to 100 characters.', 'INVALID_CUSTOM_LOOKUP_NAME');
  }
  if (!queryText || queryText.length > MAX_QUERY_LENGTH) {
    throw createHttpError(400, `Custom lookup query is required and limited to ${MAX_QUERY_LENGTH} characters.`, 'INVALID_CUSTOM_LOOKUP_QUERY');
  }
  try {
    readOnlyDbService.assertStaticReadOnlySql(queryText);
  } catch (error) {
    throw createHttpError(400, error.message, 'UNSAFE_CUSTOM_LOOKUP_QUERY');
  }
  if (!REQUIRED_ALIAS('value').test(queryText) || !REQUIRED_ALIAS('label').test(queryText)) {
    throw createHttpError(400, 'The query must return columns aliased as value and label. description is optional.', 'CUSTOM_LOOKUP_ALIASES_REQUIRED');
  }
  return { id, name, queryText };
};

const rowValue = (row, key) => {
  const match = Object.keys(row || {}).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
  return match ? row[match] : undefined;
};

const createSalesDocumentCustomLookupService = ({
  customLookups = repository,
  readOnlyDb = readOnlyDbService,
} = {}) => {
  const execute = async (context, queryText, queryId = 'custom-lookup.preview') => {
    const rows = await readOnlyDb.select({ context, queryId, sql: queryText, params: {} });
    if (rows.length && (rowValue(rows[0], 'value') === undefined || rowValue(rows[0], 'label') === undefined)) {
      throw createHttpError(422, 'The query result must contain value and label columns.', 'CUSTOM_LOOKUP_RESULT_INVALID');
    }
    return rows;
  };

  const preview = async (context, body) => {
    const input = normalizeInput(body);
    const rows = await execute(context, input.queryText);
    return {
      success: true,
      rowCount: rows.length,
      columns: rows.length ? Object.keys(rows[0]) : [],
      rows,
    };
  };

  const save = async (context, body) => {
    const input = normalizeInput(body);
    const existing = await customLookups.list(context.companyId);
    if (existing.some((row) => text(row.LookupName).toLowerCase() === input.name.toLowerCase()
      && Number(row.CustomLookupId) !== Number(input.id))) {
      throw createHttpError(409, 'A custom lookup with this name already exists for the company.', 'CUSTOM_LOOKUP_NAME_EXISTS');
    }
    await execute(context, input.queryText, `custom-lookup.validate.${input.id || 'new'}`);
    const saved = await customLookups.save({
      customLookupId: input.id,
      companyId: context.companyId,
      lookupName: input.name,
      queryText: input.queryText,
      userId: context.userId,
    });
    if (!saved) throw createHttpError(404, 'Custom lookup was not found for this company.', 'CUSTOM_LOOKUP_NOT_FOUND');
    return {
      success: true,
      customLookup: {
        id: Number(saved.CustomLookupId),
        source: `custom:${Number(saved.CustomLookupId)}`,
        name: text(saved.LookupName),
        queryText: text(saved.QueryText),
      },
    };
  };

  return { execute, preview, save };
};

const defaultService = createSalesDocumentCustomLookupService();
module.exports = defaultService;
module.exports.createSalesDocumentCustomLookupService = createSalesDocumentCustomLookupService;
module.exports.normalizeInput = normalizeInput;
module.exports.rowValue = rowValue;

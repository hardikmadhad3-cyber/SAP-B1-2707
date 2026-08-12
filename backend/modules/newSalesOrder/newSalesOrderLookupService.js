'use strict';

const readOnlyDbService = require('./newSalesOrderReadOnlyDbService');
const metadataRepository = require('./newSalesOrderMetadataRepository');
const schemaService = require('./newSalesOrderSchemaService');
const {
  FORBIDDEN_LOOKUP_KEYS,
  LOOKUP_PAGING,
  LOOKUP_QUERY_KEYS,
  LOOKUP_SOURCE_SET,
  LINKED_TABLE_COLUMN_CANDIDATES,
} = require('./newSalesOrderConstants');
const { rowValue, normalizeSapIdentifier } = require('./newSalesOrderMetadataRepository');

const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();

const createHttpError = (statusCode, message, code, details) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  if (details !== undefined) error.details = details;
  return error;
};

const STANDARD_LOOKUP_SQL = Object.freeze({
  items: `
    SELECT
      T0.ItemCode AS value,
      T0.ItemName AS label,
      T0.ItemName AS description
    FROM OITM T0
    WHERE T0.SellItem = 'Y'
      AND COALESCE(T0.validFor, 'Y') <> 'N'
      AND (@search = '' OR T0.ItemCode LIKE @like OR COALESCE(T0.ItemName, '') LIKE @like)
    ORDER BY T0.ItemCode
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
  'business-partners': `
    SELECT
      T0.CardCode AS value,
      T0.CardName AS label,
      T0.CardName AS description
    FROM OCRD T0
    WHERE T0.CardType = 'C'
      AND COALESCE(T0.validFor, 'Y') <> 'N'
      AND COALESCE(T0.frozenFor, 'N') <> 'Y'
      AND (@search = '' OR T0.CardCode LIKE @like OR COALESCE(T0.CardName, '') LIKE @like)
    ORDER BY T0.CardCode
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
  warehouses: `
    SELECT
      T0.WhsCode AS value,
      T0.WhsName AS label,
      T0.WhsName AS description
    FROM OWHS T0
    WHERE COALESCE(T0.Inactive, 'N') <> 'Y'
      AND (@search = '' OR T0.WhsCode LIKE @like OR COALESCE(T0.WhsName, '') LIKE @like)
    ORDER BY T0.WhsCode
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
  'tax-codes': `
    SELECT
      T0.Code AS value,
      T0.Name AS label,
      T0.Name AS description
    FROM OSTC T0
    WHERE COALESCE(T0.Lock, 'N') <> 'Y'
      AND (@search = '' OR T0.Code LIKE @like OR COALESCE(T0.Name, '') LIKE @like)
    ORDER BY T0.Code
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
  'shipping-types': `
    SELECT
      T0.TrnspCode AS value,
      T0.TrnspName AS label,
      T0.TrnspName AS description
    FROM OSHP T0
    WHERE @search = ''
      OR CAST(T0.TrnspCode AS NVARCHAR(50)) LIKE @like
      OR COALESCE(T0.TrnspName, '') LIKE @like
    ORDER BY T0.TrnspName, T0.TrnspCode
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
  'distribution-rules': `
    SELECT
      T0.OcrCode AS value,
      T0.OcrName AS label,
      T0.OcrName AS description
    FROM OOCR T0
    WHERE COALESCE(T0.Active, 'Y') <> 'N'
      AND (@search = '' OR T0.OcrCode LIKE @like OR COALESCE(T0.OcrName, '') LIKE @like)
    ORDER BY T0.OcrCode
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
  'hsn-codes': `
    SELECT
      T0.AbsEntry AS value,
      T0.ChapterID AS label,
      T0.Dscription AS description
    FROM OCHP T0
    WHERE @search = ''
      OR CAST(T0.AbsEntry AS NVARCHAR(50)) LIKE @like
      OR T0.ChapterID LIKE @like
      OR COALESCE(T0.Dscription, '') LIKE @like
      OR COALESCE(T0.Heading, '') LIKE @like
      OR COALESCE(T0.SubHeading, '') LIKE @like
    ORDER BY T0.ChapterID
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
  countries: `
    SELECT
      T0.Code AS value,
      T0.Name AS label,
      T0.Name AS description
    FROM OCRY T0
    WHERE @search = '' OR T0.Code LIKE @like OR COALESCE(T0.Name, '') LIKE @like
    ORDER BY T0.Name, T0.Code
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
  'sales-employees': `
    SELECT
      T0.SlpCode AS value,
      T0.SlpName AS label,
      T0.Memo AS description
    FROM OSLP T0
    WHERE COALESCE(T0.Active, 'Y') = 'Y'
      AND (@search = '' OR CAST(T0.SlpCode AS NVARCHAR(50)) LIKE @like OR COALESCE(T0.SlpName, '') LIKE @like)
    ORDER BY T0.SlpName, T0.SlpCode
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
  owners: `
    SELECT
      T0.empID AS value,
      T0.firstName AS firstName,
      T0.lastName AS lastName
    FROM OHEM T0
    WHERE @search = ''
      OR CAST(T0.empID AS NVARCHAR(50)) LIKE @like
      OR COALESCE(T0.firstName, '') LIKE @like
      OR COALESCE(T0.lastName, '') LIKE @like
    ORDER BY T0.firstName, T0.lastName, T0.empID
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
  'uom-codes': `
    SELECT
      T0.UomCode AS value,
      T0.UomName AS label,
      T0.UomName AS description
    FROM OUOM T0
    WHERE @search = '' OR T0.UomCode LIKE @like OR COALESCE(T0.UomName, '') LIKE @like
    ORDER BY T0.UomCode
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `,
});

const ITEM_UOM_LOOKUP_SQL = `
  SELECT
    U.UomCode AS value,
    U.UomName AS label,
    U.UomName AS description
  FROM OITM I
  INNER JOIN UGP1 G ON G.UgpEntry = I.UgpEntry
  INNER JOIN OUOM U ON U.UomEntry = G.UomEntry
  WHERE I.ItemCode = @itemCode
    AND (@search = '' OR U.UomCode LIKE @like OR COALESCE(U.UomName, '') LIKE @like)
  ORDER BY G.LineNum, U.UomCode
  OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
`;

const parsePaging = (input = {}) => {
  const rawPage = input.page;
  const rawLimit = input.limit;
  const page = rawPage === undefined || rawPage === '' ? LOOKUP_PAGING.defaultPage : Number(rawPage);
  const requestedLimit = rawLimit === undefined || rawLimit === '' ? LOOKUP_PAGING.defaultLimit : Number(rawLimit);
  if (!Number.isInteger(page) || page < 1) {
    throw createHttpError(400, 'page must be a positive integer.', 'INVALID_LOOKUP_PAGE');
  }
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw createHttpError(400, 'limit must be a positive integer.', 'INVALID_LOOKUP_LIMIT');
  }
  const limit = Math.min(requestedLimit, LOOKUP_PAGING.maximumLimit);
  return { page, limit, offset: (page - 1) * limit, fetchLimit: limit + 1 };
};

const normalizeLookupInput = (input = {}) => {
  const keys = Object.keys(input || {});
  const forbiddenKey = keys.find((key) => FORBIDDEN_LOOKUP_KEYS.some((blocked) => blocked.toLowerCase() === key.toLowerCase()));
  if (forbiddenKey) {
    throw createHttpError(400, `${forbiddenKey} is not accepted by the lookup API.`, 'ARBITRARY_LOOKUP_TARGET_REJECTED');
  }
  const unknownKey = keys.find((key) => !LOOKUP_QUERY_KEYS.some((allowed) => allowed.toLowerCase() === key.toLowerCase()));
  if (unknownKey) {
    throw createHttpError(400, `Unknown lookup parameter ${unknownKey}.`, 'UNKNOWN_LOOKUP_PARAMETER');
  }
  if (input.q !== undefined && input.query !== undefined && text(input.q) !== text(input.query)) {
    throw createHttpError(400, 'q and query cannot contain different values.', 'CONFLICTING_LOOKUP_QUERY');
  }

  const search = text(input.q ?? input.query);
  if (search.length > LOOKUP_PAGING.maximumSearchLength) {
    throw createHttpError(
      400,
      `Lookup search is limited to ${LOOKUP_PAGING.maximumSearchLength} characters.`,
      'LOOKUP_SEARCH_TOO_LONG',
    );
  }
  const itemCode = text(input.itemCode);
  if (itemCode.length > 50) {
    throw createHttpError(400, 'itemCode is too long.', 'INVALID_ITEM_CODE');
  }
  return {
    ...parsePaging(input),
    search,
    like: `%${search}%`,
    itemCode,
    fieldId: text(input.fieldId),
    schemaVersion: text(input.schemaVersion),
    documentType: text(input.documentType),
  };
};

const normalizeOption = (row, source) => {
  const value = rowValue(row, 'value');
  if (value === null || value === undefined || text(value) === '') return null;
  if (source === 'owners') {
    const firstName = text(rowValue(row, 'firstName'));
    const lastName = text(rowValue(row, 'lastName'));
    const name = [firstName, lastName].filter(Boolean).join(' ') || String(value);
    return { value: String(value), label: name, description: name };
  }
  const label = text(rowValue(row, 'label')) || String(value);
  return {
    value: String(value),
    label,
    description: text(rowValue(row, 'description')) || label,
  };
};

const pageOptions = ({ source, rows, page, limit, schemaVersion }) => {
  const seen = new Set();
  const normalized = [];
  for (const row of rows || []) {
    const option = normalizeOption(row, source);
    if (!option || seen.has(option.value)) continue;
    seen.add(option.value);
    normalized.push(option);
  }
  const hasMore = normalized.length > limit;
  return {
    source,
    items: normalized.slice(0, limit),
    page,
    limit,
    hasMore,
    ...(schemaVersion ? { schemaVersion } : {}),
  };
};

const quoteIdentifier = (value) => `[${normalizeSapIdentifier(value, 'SAP identifier').replace(/]/g, ']]')}]`;

const findColumn = (columns, candidates) => {
  for (const candidate of candidates) {
    const match = (columns || []).find((column) => upper(column.columnName) === upper(candidate));
    if (match) return match.columnName;
  }
  return '';
};

const buildLinkedTableSql = ({ tableName, codeColumn, labelColumn, descriptionColumn }) => {
  const table = quoteIdentifier(tableName);
  const code = quoteIdentifier(codeColumn);
  const label = quoteIdentifier(labelColumn || codeColumn);
  const description = quoteIdentifier(descriptionColumn || labelColumn || codeColumn);
  return `
    SELECT
      CAST(${code} AS NVARCHAR(254)) AS value,
      CAST(${label} AS NVARCHAR(254)) AS label,
      CAST(${description} AS NVARCHAR(254)) AS description
    FROM ${table}
    WHERE @search = ''
      OR CAST(${code} AS NVARCHAR(254)) LIKE @like
      OR CAST(${label} AS NVARCHAR(254)) LIKE @like
    ORDER BY ${label}, ${code}
    OFFSET @offset ROWS FETCH NEXT @fetchLimit ROWS ONLY
  `;
};

const findSchemaField = (schema, fieldId) => {
  if (!/^(ORDR|RDR1|ODLN|DLN1)\.[A-Za-z0-9_]+$/i.test(fieldId)) {
    throw createHttpError(400, 'A valid allowlisted sales-document fieldId is required.', 'INVALID_LOOKUP_FIELD');
  }
  const fields = [...(schema.headerFields || []), ...(schema.lineFields || [])];
  const field = fields.find((candidate) => upper(candidate.id) === upper(fieldId));
  if (!field || upper(field.storage) !== 'UDF') {
    throw createHttpError(404, 'The lookup field is not present in the current company schema.', 'LOOKUP_FIELD_NOT_FOUND');
  }
  return field;
};

const createNewSalesOrderLookupService = ({
  readOnlyDb = readOnlyDbService,
  metadata = metadataRepository,
  schemas = schemaService,
} = {}) => {
  const queryRows = async (context, source, sql, paging, extraParams = {}) => readOnlyDb.select({
    context,
    queryId: `lookup.${source}`,
    sql,
    params: {
      search: paging.search,
      like: paging.like,
      offset: paging.offset,
      fetchLimit: paging.fetchLimit,
      ...extraParams,
    },
  });

  const getSacOptions = async (context, paging) => {
    const columns = await metadata.getTableColumns(context, 'OSAC');
    const entryColumn = findColumn(columns, ['AbsEntry']);
    const codeColumn = findColumn(columns, ['ServCode', 'ServiceCode']);
    const nameColumn = findColumn(columns, ['ServName', 'ServiceName']) || codeColumn;
    if (!codeColumn) {
      throw createHttpError(422, 'SAC lookup is not supported by this company database.', 'SAC_METADATA_UNAVAILABLE');
    }
    const sql = buildLinkedTableSql({
      tableName: 'OSAC',
      codeColumn: entryColumn || codeColumn,
      labelColumn: codeColumn,
      descriptionColumn: nameColumn,
    });
    return queryRows(context, 'sac-codes', sql, paging);
  };

  const getDynamicOptions = async (context, source, paging, suppliedSchema) => {
    const schema = suppliedSchema || await schemas.getSchema(context, paging.documentType);
    if (paging.schemaVersion && paging.schemaVersion !== schema.schemaVersion) {
      throw createHttpError(409, 'The document field schema changed. Reload the page.', 'STALE_SCHEMA_VERSION', {
        currentSchemaVersion: schema.schemaVersion,
      });
    }
    const field = findSchemaField(schema, paging.fieldId);

    if (source === 'udf-valid-values') {
      if (!Array.isArray(field.options) || !field.options.length) {
        throw createHttpError(422, 'This field has no UFD1 valid values.', 'UDF_VALID_VALUES_UNAVAILABLE');
      }
      const search = paging.search.toLowerCase();
      const matches = field.options.filter((option) => !search
        || String(option.value || '').toLowerCase().includes(search)
        || String(option.label || '').toLowerCase().includes(search));
      const start = paging.offset;
      const rows = matches.slice(start, start + paging.fetchLimit);
      return { rows, schema };
    }

    let tableName;
    if (source === 'udf-linked-table') {
      tableName = text(field.linkedTable);
      if (!tableName) {
        throw createHttpError(422, 'This field has no CUFD LinkedTable metadata.', 'LINKED_TABLE_UNAVAILABLE');
      }
    } else {
      if (!text(field.relUDO)) {
        throw createHttpError(422, 'This field has no CUFD RelUDO metadata.', 'UDO_LOOKUP_UNAVAILABLE');
      }
      tableName = await metadata.resolveUdoTable(context, field.relUDO);
      if (!tableName) {
        throw createHttpError(422, 'The related UDO table could not be resolved.', 'UDO_LOOKUP_UNAVAILABLE');
      }
    }

    const approvedTable = normalizeSapIdentifier(tableName, 'Linked table');
    if (!await metadata.tableExists(context, approvedTable)) {
      throw createHttpError(422, 'The linked lookup table does not exist in the current company.', 'LINKED_TABLE_UNAVAILABLE');
    }
    const columns = await metadata.getTableColumns(context, approvedTable);
    const codeColumn = findColumn(columns, LINKED_TABLE_COLUMN_CANDIDATES.code);
    const labelColumn = findColumn(columns, LINKED_TABLE_COLUMN_CANDIDATES.label) || codeColumn;
    if (!codeColumn) {
      throw createHttpError(422, 'The linked table has no approved lookup code column.', 'LINKED_TABLE_COLUMNS_UNAVAILABLE');
    }
    const sql = buildLinkedTableSql({ tableName: approvedTable, codeColumn, labelColumn });
    const rows = await queryRows(context, source, sql, paging);
    return { rows, schema };
  };

  const getLookup = async (context, rawSource, input = {}, options = {}) => {
    const source = text(rawSource).toLowerCase();
    if (!LOOKUP_SOURCE_SET.has(source)) {
      throw createHttpError(404, 'Lookup source is not allowed.', 'LOOKUP_SOURCE_NOT_ALLOWED');
    }
    const paging = normalizeLookupInput(input);
    let rows;
    let currentSchemaVersion = '';

    if (['udf-valid-values', 'udf-linked-table', 'udo'].includes(source)) {
      const dynamic = await getDynamicOptions(context, source, paging, options.schema);
      rows = dynamic.rows;
      currentSchemaVersion = dynamic.schema.schemaVersion;
    } else if (source === 'sac-codes') {
      rows = await getSacOptions(context, paging);
    } else {
      const sql = source === 'uom-codes' && paging.itemCode
        ? ITEM_UOM_LOOKUP_SQL
        : STANDARD_LOOKUP_SQL[source];
      if (!sql) {
        throw createHttpError(404, 'Lookup source is not implemented.', 'LOOKUP_SOURCE_NOT_IMPLEMENTED');
      }
      rows = await queryRows(context, source, sql, paging, paging.itemCode ? { itemCode: paging.itemCode } : {});
    }

    return {
      success: true,
      companyId: Number(context.companyId),
      companyDb: text(context.companyDb),
      ...pageOptions({
        source,
        rows,
        page: paging.page,
        limit: paging.limit,
        schemaVersion: currentSchemaVersion,
      }),
    };
  };

  const validateLookupValue = async ({ trustedContext, context, schema, field, value, record } = {}) => {
    const normalizedValue = text(value);
    if (!normalizedValue || !field) return { valid: false };
    const inline = Array.isArray(field.options) ? field.options : [];
    if (inline.length) {
      return { valid: inline.some((option) => String(option?.value ?? option) === normalizedValue) };
    }
    const source = text(field.lookup?.source || field.lookupSource);
    if (!LOOKUP_SOURCE_SET.has(source)) return { valid: false };
    const itemCode = source === 'uom-codes' ? text(record?.values?.itemNo) : '';
    if (source === 'uom-codes' && Array.isArray(field.lookup?.dependsOn) && field.lookup.dependsOn.length && !itemCode) {
      return { valid: false };
    }
    const result = await getLookup(trustedContext || context, source, {
      q: normalizedValue,
      page: 1,
      limit: LOOKUP_PAGING.maximumLimit,
      ...(itemCode ? { itemCode } : {}),
      ...(String(source).startsWith('udf-') || source === 'udo'
        ? { fieldId: field.id, schemaVersion: schema?.schemaVersion }
        : {}),
    }, { schema });
    return { valid: result.items.some((option) => option.value === normalizedValue) };
  };

  return { getLookup, validateLookupValue };
};

const defaultService = createNewSalesOrderLookupService();

module.exports = defaultService;
module.exports.ITEM_UOM_LOOKUP_SQL = ITEM_UOM_LOOKUP_SQL;
module.exports.STANDARD_LOOKUP_SQL = STANDARD_LOOKUP_SQL;
module.exports.buildLinkedTableSql = buildLinkedTableSql;
module.exports.createNewSalesOrderLookupService = createNewSalesOrderLookupService;
module.exports.findSchemaField = findSchemaField;
module.exports.normalizeLookupInput = normalizeLookupInput;
module.exports.pageOptions = pageOptions;

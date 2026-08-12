'use strict';

const authDbService = require('../../services/authDbService');
const readOnlyDbService = require('./newSalesOrderReadOnlyDbService');
const {
  SALES_DOCUMENTS,
  SALES_ORDER_DOCUMENT,
  resolveSalesDocument,
} = require('./newSalesOrderConstants');

const PHYSICAL_COLUMNS_SQL = `
  SELECT
    COLUMN_NAME AS columnName,
    DATA_TYPE AS dataType,
    CHARACTER_MAXIMUM_LENGTH AS maxLength,
    NUMERIC_PRECISION AS numericPrecision,
    NUMERIC_SCALE AS numericScale,
    IS_NULLABLE AS isNullable,
    ORDINAL_POSITION AS ordinalPosition
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = @tableName
  ORDER BY ORDINAL_POSITION
`;

const TABLE_EXISTS_SQL = `
  SELECT TABLE_NAME AS tableName
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = @tableName
`;

const UFD1_VALUES_SQL = `
  SELECT
    TableID AS tableId,
    FieldID AS fieldId,
    IndexID AS indexId,
    FldValue AS value,
    Descr AS label
  FROM UFD1
  WHERE TableID = @tableName
  ORDER BY FieldID, IndexID
`;

const LAYOUT_SQL = `
  SELECT
    tableName,
    columnUid,
    fieldName,
    columnTitle,
    visible,
    editable,
    columnOrder,
    width,
    dataType,
    isUdf,
    source,
    updatedAt
  FROM sap_form_layout_columns
  WHERE companyDb = @companyDb
    AND userCode = @userCode
    AND documentType = @documentType
    AND formType = @formType
    AND matrixId = @matrixId
  ORDER BY columnOrder, id
`;

const text = (value) => String(value ?? '').trim();

const rowValue = (row, ...keys) => {
  if (!row || typeof row !== 'object') return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    const match = Object.keys(row).find((candidate) => candidate.toLowerCase() === String(key).toLowerCase());
    if (match) return row[match];
  }
  return undefined;
};

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizePhysicalColumn = (row) => ({
  columnName: text(rowValue(row, 'columnName', 'COLUMN_NAME')),
  databaseType: text(rowValue(row, 'dataType', 'DATA_TYPE')).toLowerCase(),
  maxLength: numberOrNull(rowValue(row, 'maxLength', 'CHARACTER_MAXIMUM_LENGTH')),
  precision: numberOrNull(rowValue(row, 'numericPrecision', 'NUMERIC_PRECISION')),
  scale: numberOrNull(rowValue(row, 'numericScale', 'NUMERIC_SCALE')),
  nullable: text(rowValue(row, 'isNullable', 'IS_NULLABLE')).toUpperCase() === 'YES',
  ordinal: numberOrNull(rowValue(row, 'ordinalPosition', 'ORDINAL_POSITION')) || 0,
});

const assertKnownDocumentTable = (tableName) => {
  const normalized = text(tableName).toUpperCase();
  const allowedTables = Object.values(SALES_DOCUMENTS)
    .flatMap((document) => [document.headerTable, document.lineTable]);
  if (!allowedTables.includes(normalized)) {
    const error = new Error('Only allowlisted sales-document metadata tables are available.');
    error.statusCode = 400;
    error.code = 'UNSUPPORTED_DOCUMENT_TABLE';
    throw error;
  }
  return normalized;
};

const normalizeSapIdentifier = (value, label = 'SAP table') => {
  const normalized = text(value);
  if (!/^@?[A-Za-z0-9_]{1,127}$/.test(normalized)) {
    const error = new Error(`${label} is not an approved SAP identifier.`);
    error.statusCode = 400;
    error.code = 'UNAPPROVED_SAP_IDENTIFIER';
    throw error;
  }
  return normalized;
};

const buildCufdSql = (columnNames) => {
  const columns = new Map([...columnNames].map((name) => [String(name).toUpperCase(), String(name)]));
  const select = (name, alias, fallback = "''") => {
    const actual = columns.get(name.toUpperCase());
    return actual ? `T0.[${actual}] AS [${alias}]` : `${fallback} AS [${alias}]`;
  };

  return `
    SELECT
      ${select('TableID', 'tableId')},
      ${select('FieldID', 'fieldId', 'NULL')},
      ${select('AliasID', 'aliasId')},
      ${select('Descr', 'label')},
      ${select('TypeID', 'typeId')},
      ${select('SubType', 'subType')},
      ${select('EditSize', 'editSize', 'NULL')},
      ${select('NotNull', 'notNull')},
      ${select('Mandatory', 'mandatory')},
      ${select('Editable', 'editable')},
      ${select('LinkedTable', 'linkedTable')},
      ${select('RelUDO', 'relUDO')},
      ${select('Dflt', 'defaultValue', 'NULL')}
    FROM CUFD T0
    WHERE T0.[${columns.get('TABLEID') || 'TableID'}] = @tableName
    ORDER BY T0.[${columns.get('FIELDID') || 'FieldID'}]
  `;
};

const normalizeUdfKey = (aliasId) => {
  const alias = text(aliasId).replace(/[^A-Za-z0-9_]/g, '');
  if (!alias) return '';
  return alias.toUpperCase().startsWith('U_') ? alias : `U_${alias.replace(/^_+/, '')}`;
};

const createNewSalesOrderMetadataRepository = ({
  readOnlyDb = readOnlyDbService,
  authDb = authDbService,
} = {}) => {
  if (!readOnlyDb || typeof readOnlyDb.select !== 'function') {
    throw new TypeError('A New Sales Order read-only database service is required.');
  }

  const getTableColumns = async (context, tableName, { documentTableOnly = false } = {}) => {
    const normalizedTable = documentTableOnly
      ? assertKnownDocumentTable(tableName)
      : normalizeSapIdentifier(tableName);
    const rows = await readOnlyDb.select({
      context,
      queryId: `metadata.columns.${normalizedTable}`,
      sql: PHYSICAL_COLUMNS_SQL,
      params: { tableName: normalizedTable },
    });
    return rows.map(normalizePhysicalColumn).filter((column) => column.columnName);
  };

  const tableExists = async (context, tableName) => {
    const normalizedTable = normalizeSapIdentifier(tableName);
    const rows = await readOnlyDb.select({
      context,
      queryId: `metadata.table-exists.${normalizedTable}`,
      sql: TABLE_EXISTS_SQL,
      params: { tableName: normalizedTable },
    });
    return rows.length > 0;
  };

  const getUdfDefinitions = async (context, tableName, cufdColumnNames) => {
    const normalizedTable = assertKnownDocumentTable(tableName);
    const udfRows = await readOnlyDb.select({
      context,
      queryId: `metadata.cufd.${normalizedTable}`,
      sql: buildCufdSql(cufdColumnNames),
      params: { tableName: normalizedTable },
    });
    const valueRows = await readOnlyDb.select({
      context,
      queryId: `metadata.ufd1.${normalizedTable}`,
      sql: UFD1_VALUES_SQL,
      params: { tableName: normalizedTable },
    });

    const valuesByField = new Map();
    for (const row of valueRows) {
      const fieldId = numberOrNull(rowValue(row, 'fieldId', 'FieldID'));
      const value = rowValue(row, 'value', 'FldValue');
      if (fieldId === null || value === null || value === undefined || text(value) === '') continue;
      if (!valuesByField.has(fieldId)) valuesByField.set(fieldId, []);
      valuesByField.get(fieldId).push({
        value: String(value),
        label: text(rowValue(row, 'label', 'Descr')) || String(value),
      });
    }

    return udfRows.map((row) => {
      const fieldId = numberOrNull(rowValue(row, 'fieldId'));
      const sapField = normalizeUdfKey(rowValue(row, 'aliasId'));
      return {
        tableName: normalizedTable,
        fieldId,
        aliasId: text(rowValue(row, 'aliasId')),
        sapField,
        label: text(rowValue(row, 'label')) || sapField,
        typeId: text(rowValue(row, 'typeId')),
        subType: text(rowValue(row, 'subType')),
        maxLength: numberOrNull(rowValue(row, 'editSize')),
        required: [rowValue(row, 'notNull'), rowValue(row, 'mandatory')]
          .some((value) => text(value).toUpperCase() === 'Y'),
        readOnly: text(rowValue(row, 'editable')).toUpperCase() === 'N',
        linkedTable: text(rowValue(row, 'linkedTable')) || null,
        relUDO: text(rowValue(row, 'relUDO')) || null,
        defaultValue: rowValue(row, 'defaultValue') ?? null,
        options: valuesByField.get(fieldId) || [],
      };
    }).filter((field) => field.sapField);
  };

  const getLayoutRows = async (context, rawDocument = SALES_ORDER_DOCUMENT) => {
    const document = typeof rawDocument === 'string' ? resolveSalesDocument(rawDocument) : rawDocument;
    if (!authDb || typeof authDb.queryRows !== 'function') return [];
    return authDb.queryRows(LAYOUT_SQL, {
      companyDb: context.companyDb,
      userCode: context.userCode,
      documentType: document.documentType,
      formType: document.formType,
      matrixId: document.matrixId,
    });
  };

  const getDocumentMetadata = async (context, rawDocument = SALES_ORDER_DOCUMENT) => {
    const document = typeof rawDocument === 'string' ? resolveSalesDocument(rawDocument) : rawDocument;
    const [dialect, headerColumns, lineColumns, cufdColumns, layoutRows] = await Promise.all([
      readOnlyDb.getDialect(context),
      getTableColumns(context, document.headerTable, { documentTableOnly: true }),
      getTableColumns(context, document.lineTable, { documentTableOnly: true }),
      getTableColumns(context, 'CUFD'),
      getLayoutRows(context, document),
    ]);
    const cufdColumnNames = new Set(cufdColumns.map((column) => column.columnName));
    const [headerUdfs, lineUdfs] = await Promise.all([
      getUdfDefinitions(context, document.headerTable, cufdColumnNames),
      getUdfDefinitions(context, document.lineTable, cufdColumnNames),
    ]);

    return {
      dialect,
      physical: {
        [document.headerTable]: headerColumns,
        [document.lineTable]: lineColumns,
      },
      udfs: {
        [document.headerTable]: headerUdfs,
        [document.lineTable]: lineUdfs,
      },
      layout: layoutRows,
    };
  };

  const getSalesOrderMetadata = (context) => getDocumentMetadata(context, SALES_ORDER_DOCUMENT);

  const resolveUdoTable = async (context, udoCode) => {
    const normalizedCode = text(udoCode);
    if (!normalizedCode || normalizedCode.length > 20) return null;
    const rows = await readOnlyDb.select({
      context,
      queryId: 'metadata.oudo.resolve-table',
      sql: `
        SELECT TOP 1 TableName AS tableName
        FROM OUDO
        WHERE Code = @udoCode
        ORDER BY Code
      `,
      params: { udoCode: normalizedCode },
    });
    const rawTable = text(rowValue(rows[0], 'tableName', 'TableName'));
    if (!rawTable) return null;
    return normalizeSapIdentifier(rawTable.startsWith('@') ? rawTable : `@${rawTable}`, 'UDO table');
  };

  return {
    getDocumentMetadata,
    getLayoutRows,
    getSalesOrderMetadata,
    getTableColumns,
    getUdfDefinitions,
    resolveUdoTable,
    tableExists,
  };
};

const defaultRepository = createNewSalesOrderMetadataRepository();

module.exports = defaultRepository;
module.exports.LAYOUT_SQL = LAYOUT_SQL;
module.exports.PHYSICAL_COLUMNS_SQL = PHYSICAL_COLUMNS_SQL;
module.exports.TABLE_EXISTS_SQL = TABLE_EXISTS_SQL;
module.exports.UFD1_VALUES_SQL = UFD1_VALUES_SQL;
module.exports.assertKnownDocumentTable = assertKnownDocumentTable;
module.exports.buildCufdSql = buildCufdSql;
module.exports.createNewSalesOrderMetadataRepository = createNewSalesOrderMetadataRepository;
module.exports.normalizePhysicalColumn = normalizePhysicalColumn;
module.exports.normalizeSapIdentifier = normalizeSapIdentifier;
module.exports.normalizeUdfKey = normalizeUdfKey;
module.exports.rowValue = rowValue;

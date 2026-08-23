'use strict';

const crypto = require('crypto');
const metadataRepository = require('./newSalesOrderMetadataRepository');
const {
  LOOKUP_SOURCES,
  SALES_ORDER_DOCUMENT,
  SALES_ORDER_HEADER_STANDARD_FIELDS,
  SALES_ORDER_LINE_STANDARD_FIELDS,
  SCHEMA_FORMAT_VERSION,
  resolveSalesDocument,
} = require('./newSalesOrderConstants');
const { mapFieldType } = require('./newSalesOrderTypeMapper');
const { rowValue } = require('./newSalesOrderMetadataRepository');

const text = (value) => String(value ?? '').trim();
const upper = (value) => text(value).toUpperCase();
const compactToken = (value) => upper(value).replace(/[^A-Z0-9]/g, '');

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const booleanFlag = (value, fallback) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = upper(value);
  if (['1', 'TRUE', 'TYES', 'Y', 'YES'].includes(normalized)) return true;
  if (['0', 'FALSE', 'N', 'NO', 'TNO'].includes(normalized)) return false;
  return fallback;
};

const clampWidth = (value, fallback = 120) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(600, Math.max(60, Math.round(number)));
};

const mapLayoutDataType = (value) => {
  const normalized = text(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (['yesno', 'boolean', 'checkbox', 'bit'].includes(normalized)) {
    return { type: 'checkbox', renderer: 'checkbox' };
  }
  return mapFieldType({ databaseType: value }, {});
};

const fieldTokens = (...values) => {
  const tokens = new Set();
  values.flat(Infinity).forEach((value) => {
    const exact = upper(value);
    const compact = compactToken(value);
    if (exact) tokens.add(exact);
    if (compact) tokens.add(compact);
  });
  return [...tokens];
};

const createTokenIndex = (rows, tokenFactory) => {
  const index = new Map();
  for (const row of rows || []) {
    for (const token of tokenFactory(row)) {
      if (!index.has(token)) index.set(token, row);
    }
  }
  return index;
};

const findByTokens = (index, tokens) => {
  for (const token of tokens) {
    if (index.has(token)) return index.get(token);
  }
  return null;
};

const normalizeLayoutRow = (row) => ({
  tableName: upper(rowValue(row, 'tableName')),
  columnUid: text(rowValue(row, 'columnUid')),
  fieldName: text(rowValue(row, 'fieldName')),
  label: text(rowValue(row, 'columnTitle')),
  visible: booleanFlag(rowValue(row, 'visible'), true),
  editable: booleanFlag(rowValue(row, 'editable'), true),
  order: numberOrNull(rowValue(row, 'columnOrder')),
  width: numberOrNull(rowValue(row, 'width')),
  dataType: text(rowValue(row, 'dataType')),
  isUdf: booleanFlag(rowValue(row, 'isUdf'), false),
  source: text(rowValue(row, 'source')),
  updatedAt: text(rowValue(row, 'updatedAt')),
});

const buildLookup = ({ fieldId, semantic, udf }) => {
  let source = text(semantic?.lookupSource);
  if (text(udf?.linkedTable)) source = 'udf-linked-table';
  else if (text(udf?.relUDO)) source = 'udo';
  else if (Array.isArray(udf?.options) && udf.options.length) source = 'udf-valid-values';
  if (!source) return null;

  return {
    source,
    ...(source.startsWith('udf-') || source === 'udo' ? { fieldId } : {}),
    ...(Array.isArray(semantic?.lookupDependsOn) && semantic.lookupDependsOn.length
      ? { dependsOn: [...semantic.lookupDependsOn] }
      : {}),
  };
};

const normalizeField = ({ tableName, physical, udf, semantic, layout, fallbackOrder }) => {
  const databaseField = text(physical?.columnName || semantic?.databaseField || udf?.sapField);
  const sapField = text(udf?.sapField || semantic?.sapField || databaseField);
  const storage = text(semantic?.storage) || (udf || upper(databaseField).startsWith('U_') ? 'udf' : 'standard');
  const id = `${tableName}.${databaseField || sapField}`;
  const mappedType = mapFieldType({
    databaseType: physical?.databaseType,
    maxLength: udf?.maxLength ?? physical?.maxLength,
    precision: physical?.precision,
    scale: physical?.scale,
    typeId: udf?.typeId,
    subType: udf?.subType,
    options: udf?.options,
    linkedTable: udf?.linkedTable,
    relUDO: udf?.relUDO,
  }, semantic || {});
  const readOnly = Boolean(semantic?.readOnly || udf?.readOnly
    || ['calculated', 'display-only', 'display_only'].includes(storage.toLowerCase()));
  const editable = !readOnly && (layout ? layout.editable !== false : true);
  const lookup = buildLookup({ fieldId: id, semantic, udf });
  const maxLength = numberOrNull(udf?.maxLength ?? physical?.maxLength);

  return {
    id,
    stateKey: text(udf?.sapField || semantic?.stateKey || sapField),
    sapField,
    databaseField,
    tableName,
    label: text(layout?.label || udf?.label || semantic?.label || sapField || databaseField),
    type: mappedType.type,
    renderer: mappedType.renderer,
    storage,
    visible: layout ? layout.visible !== false : semantic?.visible !== false,
    editable,
    readOnly,
    required: Boolean(semantic?.required || udf?.required),
    order: numberOrNull(layout?.order) ?? numberOrNull(semantic?.order) ?? fallbackOrder,
    width: clampWidth(layout?.width, semantic?.width || (mappedType.type === 'textarea' ? 240 : 120)),
    precision: mappedType.precision ?? null,
    scale: mappedType.scale ?? null,
    minimum: mappedType.minimum ?? null,
    maximum: mappedType.maximum ?? null,
    step: mappedType.step ?? null,
    maxLength,
    defaultValue: udf?.defaultValue ?? semantic?.defaultValue ?? null,
    options: mappedType.options,
    lookup,
    lookupSource: lookup?.source || null,
    linkedTable: text(udf?.linkedTable) || null,
    relUDO: text(udf?.relUDO) || null,
    databaseType: text(physical?.databaseType) || null,
    sapTypeId: text(udf?.typeId) || null,
    sapSubType: text(udf?.subType) || null,
    tooltip: text(semantic?.tooltip || udf?.label || layout?.label) || null,
  };
};

const buildTableFields = ({
  tableName,
  physicalColumns = [],
  udfDefinitions = [],
  layoutRows = [],
  standardRegistry = {},
}) => {
  const physicalIndex = createTokenIndex(physicalColumns, (column) => fieldTokens(column.columnName));
  const udfIndex = createTokenIndex(udfDefinitions, (field) => fieldTokens(field.sapField, field.aliasId));
  const normalizedLayout = layoutRows
    .map(normalizeLayoutRow)
    .filter((row) => !row.tableName || row.tableName === tableName);
  const hasSapLayout = normalizedLayout.length > 0;
  const layoutIndex = createTokenIndex(normalizedLayout, (row) => fieldTokens(row.fieldName, row.columnUid, row.label));
  const fields = [];
  const usedDatabaseFields = new Set();

  for (const [registryKey, semantic] of Object.entries(standardRegistry)) {
    const tokens = fieldTokens(
      registryKey,
      semantic.databaseField,
      semantic.sapField,
      semantic.stateKey,
      semantic.aliases,
    );
    const physical = findByTokens(physicalIndex, tokens);
    if (!physical) continue;
    const layout = findByTokens(layoutIndex, tokens);
    fields.push(normalizeField({
      tableName,
      physical,
      semantic: hasSapLayout && !layout ? { ...semantic, visible: false } : semantic,
      layout,
      fallbackOrder: fields.length + 1,
    }));
    usedDatabaseFields.add(upper(physical.columnName));
  }

  for (const physical of physicalColumns) {
    if (!upper(physical.columnName).startsWith('U_') || usedDatabaseFields.has(upper(physical.columnName))) continue;
    const udf = findByTokens(udfIndex, fieldTokens(physical.columnName));
    const layout = findByTokens(layoutIndex, fieldTokens(physical.columnName, udf?.aliasId));
    fields.push(normalizeField({
      tableName,
      physical,
      udf: udf || {
        sapField: physical.columnName,
        label: physical.columnName,
        options: [],
        defaultValue: null,
      },
      semantic: hasSapLayout && !layout ? { visible: false } : {},
      layout,
      fallbackOrder: 1000 + (physical.ordinal || fields.length),
    }));
    usedDatabaseFields.add(upper(physical.columnName));
  }

  // Imported SAP layout rows may contain standard fields outside the small
  // semantic registry. They are exposed read-only because their Service Layer
  // property cannot be inferred safely.
  for (const layout of normalizedLayout) {
    const physical = findByTokens(physicalIndex, fieldTokens(layout.fieldName, layout.columnUid, layout.label));
    if (!physical) {
      const layoutField = text(layout.fieldName || layout.columnUid || layout.label);
      if (!layoutField) continue;
      // SAP form layouts can retain deleted or company-specific UDF columns.
      // A UDF is live only when the current company table physically contains it.
      if (layout.isUdf || upper(layoutField).startsWith('U_')) continue;
      const id = `${tableName}.LAYOUT_${layoutField.replace(/[^A-Za-z0-9_]+/g, '_')}`;
      const mappedLayoutType = mapLayoutDataType(layout.dataType);
      fields.push({
        id,
        stateKey: layoutField,
        sapField: layoutField,
        databaseField: layoutField,
        tableName,
        label: layout.label || layoutField,
        type: mappedLayoutType.type || 'text',
        renderer: mappedLayoutType.renderer || 'text',
        storage: 'display-only',
        visible: layout.visible !== false,
        editable: false,
        readOnly: true,
        required: false,
        order: numberOrNull(layout.order) ?? 2000 + fields.length,
        width: clampWidth(layout.width, 120),
        precision: null,
        scale: null,
        minimum: null,
        maximum: null,
        step: null,
        maxLength: null,
        defaultValue: null,
        options: [],
        lookup: null,
        lookupSource: null,
        linkedTable: null,
        relUDO: null,
        databaseType: layout.dataType || null,
        sapTypeId: null,
        sapSubType: null,
        tooltip: layout.label || layoutField,
      });
      continue;
    }
    if (usedDatabaseFields.has(upper(physical.columnName))) continue;
    fields.push(normalizeField({
      tableName,
      physical,
      semantic: {
        stateKey: physical.columnName,
        sapField: physical.columnName,
        databaseField: physical.columnName,
        label: layout.label || physical.columnName,
        storage: 'display-only',
        readOnly: true,
      },
      layout,
      fallbackOrder: 2000 + (physical.ordinal || fields.length),
    }));
    usedDatabaseFields.add(upper(physical.columnName));
  }

  return fields.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
};

const canonicalSchemaVersionInput = (schema) => ({
  format: SCHEMA_FORMAT_VERSION,
  companyId: schema.companyId,
  companyDb: schema.companyDb,
  userCode: schema.userCode,
  documentType: schema.documentType,
  objectType: schema.objectType,
  dialect: schema.dialect,
  headerFields: schema.headerFields,
  lineFields: schema.lineFields,
});

const generateSchemaVersion = (schema) => {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalSchemaVersionInput(schema)))
    .digest('hex')
    .slice(0, 24);
  return `${SCHEMA_FORMAT_VERSION}-${hash}`;
};

const buildDocumentSchema = ({ context, metadata, rawDocument = SALES_ORDER_DOCUMENT }) => {
  const document = typeof rawDocument === 'string' ? resolveSalesDocument(rawDocument) : rawDocument;
  const layoutRows = Array.isArray(metadata?.layout) ? metadata.layout : [];
  const base = {
    success: true,
    documentType: document.documentType,
    objectType: document.objectType,
    companyId: Number(context.companyId),
    companyDb: text(context.companyDb),
    companyName: text(context.companyName),
    userCode: text(context.userCode),
    dialect: text(metadata?.dialect || context.dbDialect).toLowerCase() === 'hana' ? 'hana' : 'sqlserver',
    headerTable: document.headerTable,
    lineTable: document.lineTable,
    schemaFormatVersion: SCHEMA_FORMAT_VERSION,
    headerFields: buildTableFields({
      tableName: document.headerTable,
      physicalColumns: metadata?.physical?.[document.headerTable] || [],
      udfDefinitions: metadata?.udfs?.[document.headerTable] || [],
      layoutRows,
      standardRegistry: SALES_ORDER_HEADER_STANDARD_FIELDS,
    }),
    lineFields: buildTableFields({
      tableName: document.lineTable,
      physicalColumns: metadata?.physical?.[document.lineTable] || [],
      udfDefinitions: metadata?.udfs?.[document.lineTable] || [],
      layoutRows,
      standardRegistry: SALES_ORDER_LINE_STANDARD_FIELDS,
    }),
    lookupSources: [...LOOKUP_SOURCES],
  };

  return { ...base, schemaVersion: generateSchemaVersion(base) };
};

const buildSalesOrderSchema = (options) => buildDocumentSchema({ ...options, rawDocument: SALES_ORDER_DOCUMENT });

const createNewSalesOrderSchemaService = ({ repository = metadataRepository } = {}) => {
  if (!repository || (typeof repository.getDocumentMetadata !== 'function'
    && typeof repository.getSalesOrderMetadata !== 'function')) {
    throw new TypeError('A New Sales Order metadata repository is required.');
  }

  const getSchema = async (context, documentType = SALES_ORDER_DOCUMENT.documentType) => {
    const document = resolveSalesDocument(documentType);
    const metadata = typeof repository.getDocumentMetadata === 'function'
      ? await repository.getDocumentMetadata(context, document)
      : await repository.getSalesOrderMetadata(context);
    return buildDocumentSchema({ context, metadata, rawDocument: document });
  };

  return { getCurrentSchema: getSchema, getSchema };
};

const defaultService = createNewSalesOrderSchemaService();

module.exports = defaultService;
module.exports.buildDocumentSchema = buildDocumentSchema;
module.exports.buildSalesOrderSchema = buildSalesOrderSchema;
module.exports.buildTableFields = buildTableFields;
module.exports.createNewSalesOrderSchemaService = createNewSalesOrderSchemaService;
module.exports.generateSchemaVersion = generateSchemaVersion;
module.exports.normalizeLayoutRow = normalizeLayoutRow;

import {
  buildSalesOrderMatrixColumnsFromLayout,
  buildSalesOrderMatrixColumnsFromSchema,
  buildSalesOrderRowUdfDefinitionsFromSchema,
  getSapStandardSalesMatrixColumns,
  mapLiveSalesOrderMatrixToLayout,
} from '../modules/sales-order/documentLayout';
import { normalizeSalesDocumentSchema } from './salesDocumentSchema';

const normalizeCompanyValue = (value) => String(value ?? '').trim().toLowerCase();

export const getSalesDocumentCompanyScopeKey = ({ companyId = '', companyDb = '' } = {}) => (
  `${String(companyId ?? '').trim()}::${normalizeCompanyValue(companyDb)}`
);

const normalizeFieldName = (value) => (
  String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '')
);

const getPhysicalFieldNames = (field = {}) => (
  [field.sapField, field.databaseField, field.stateKey]
    .map(normalizeFieldName)
    .filter(Boolean)
);

const isUdfFieldName = (value) => normalizeFieldName(value).startsWith('U_');

const getLayoutFieldNames = (column = {}) => (
  [column.fieldName, column.columnUid, column.sapField, column.databaseField]
    .map(normalizeFieldName)
    .filter(Boolean)
);

export const isSalesDocumentSchemaForCompany = (
  schema,
  { companyId = '', companyDb = '' } = {},
) => {
  if (!schema) return false;

  const schemaCompanyId = schema.companyId;
  if (
    schemaCompanyId !== undefined
    && schemaCompanyId !== null
    && String(schemaCompanyId) !== String(companyId)
  ) {
    return false;
  }

  const schemaCompanyDb = normalizeCompanyValue(schema.companyDb);
  const activeCompanyDb = normalizeCompanyValue(companyDb);
  return !schemaCompanyDb || !activeCompanyDb || schemaCompanyDb === activeCompanyDb;
};

// SAP layout metadata can outlive a UDF or can be cached for another company.
// Standard fields are safe to retain, but a UDF is rendered only when the
// current-company physical schema confirms its exact database field name.
export const filterLayoutToCurrentSchema = (layoutColumns = [], schemaLineFields = []) => {
  const confirmedUdfs = new Set(
    (schemaLineFields || [])
      .flatMap(getPhysicalFieldNames)
      .filter(isUdfFieldName),
  );

  return (layoutColumns || []).filter((column) => {
    const fieldNames = getLayoutFieldNames(column);
    const isUdf = Boolean(column?.isUdf) || fieldNames.some(isUdfFieldName);
    if (!isUdf) return true;
    return fieldNames.some((fieldName) => confirmedUdfs.has(fieldName));
  });
};

export const stripSalesDocumentTopLevelUdfs = (record = {}) => (
  Object.entries(record || {}).reduce((clean, [key, value]) => {
    if (!isUdfFieldName(key)) clean[key] = value;
    return clean;
  }, {})
);

export const buildSalesDocumentLiveFields = ({
  schema,
  documentType,
  objectType,
  headerTable,
  lineTable,
  companyId,
  companyDb,
  layoutResponse,
  referenceMatrixColumns = [],
  referenceSapForm = {},
  includeLineNumber = true,
} = {}) => {
  const schemaMatchesCompany = isSalesDocumentSchemaForCompany(schema, { companyId, companyDb });
  const normalizedSchema = schemaMatchesCompany
    ? normalizeSalesDocumentSchema(schema, documentType)
    : null;
  const schemaHeaderFields = normalizedSchema?.headerFields || [];
  const schemaLineFields = normalizedSchema?.lineFields || [];
  const headerUdfFields = buildSalesOrderRowUdfDefinitionsFromSchema(schemaHeaderFields, { lineTable: headerTable });
  const rowUdfFields = buildSalesOrderRowUdfDefinitionsFromSchema(schemaLineFields, { lineTable });
  const sapStandardColumns = getSapStandardSalesMatrixColumns();
  const schemaMatrixColumns = buildSalesOrderMatrixColumnsFromSchema({
    schemaLineFields,
    liveMatrixColumns: Array.isArray(referenceMatrixColumns) && referenceMatrixColumns.length
      ? referenceMatrixColumns
      : sapStandardColumns,
    rowUdfFields,
    lineTable,
  });

  const layout = layoutResponse?.data || layoutResponse || {};
  const layoutSource = String(layout.source || '').trim().toLowerCase();
  const importedLayoutColumns = layoutSource && layoutSource !== 'fallback'
    ? filterLayoutToCurrentSchema(layout.columns || [], schemaLineFields)
    : [];
  const hasSapMatrixPreferences = Number(referenceSapForm?.preferenceRows || 0) > 0;
  const liveReferenceLayout = hasSapMatrixPreferences
    ? filterLayoutToCurrentSchema(
        mapLiveSalesOrderMatrixToLayout(referenceMatrixColumns),
        schemaLineFields,
      )
    : [];
  const effectiveLayoutColumns = importedLayoutColumns.length
    ? importedLayoutColumns
    : liveReferenceLayout;
  const verifiedColumns = schemaMatrixColumns.length ? schemaMatrixColumns : sapStandardColumns;
  const matrixColumns = effectiveLayoutColumns.length
    ? buildSalesOrderMatrixColumnsFromLayout({
        layoutColumns: effectiveLayoutColumns,
        liveMatrixColumns: verifiedColumns,
        rowUdfFields,
        includeLineNumber,
      })
    : schemaMatrixColumns.length
      ? buildSalesOrderMatrixColumnsFromLayout({
          layoutColumns: [],
          liveMatrixColumns: schemaMatrixColumns,
          rowUdfFields,
          includeLineNumber,
        })
      : buildSalesOrderMatrixColumnsFromLayout({
          layoutColumns: [],
          liveMatrixColumns: sapStandardColumns,
          rowUdfFields: [],
          includeLineNumber,
        });

  return {
    documentType,
    objectType: String(objectType || normalizedSchema?.objectType || ''),
    schemaMatchesCompany,
    liveSchema: normalizedSchema,
    headerUdfFields,
    rowUdfFields,
    matrixColumns,
    sourceMatrixColumns: Array.isArray(referenceMatrixColumns) ? referenceMatrixColumns : [],
    importedLayout: layout,
    liveAvailable: Boolean(normalizedSchema && schemaLineFields.length),
    usedSapLayout: Boolean(effectiveLayoutColumns.length),
  };
};

const normalizeLookupOptions = (response = {}) => (
  (response.items || response.options || []).map((option) => ({
    ...(typeof option === 'object' ? option : {}),
    value: String(typeof option === 'object' ? option?.value ?? '' : option ?? ''),
    label: String(
      typeof option === 'object'
        ? option?.label ?? option?.description ?? option?.value ?? ''
        : option ?? '',
    ),
    description: String(typeof option === 'object' ? option?.description ?? '' : ''),
  }))
);

export const loadSalesDocumentFieldLookupOptions = async ({
  fetchLookup,
  source,
  field = {},
  line = {},
  documentType,
  schemaVersion = '',
  limit = 100,
} = {}) => {
  if (typeof fetchLookup !== 'function') return [];

  const normalizedSource = String(source || '').trim().toLowerCase();
  const schemaLookupSource = String(field.lookup?.source || '').trim().toLowerCase();
  const lookupSource = normalizedSource.startsWith('udf:')
    ? (schemaLookupSource || (field.lookupTable || field.linkedTable ? 'udf-linked-table' : ''))
    : normalizedSource;
  if (!lookupSource) return Array.isArray(field.options) ? field.options : [];

  const fieldId = field.lookup?.fieldId
    || field.schemaFieldId
    || field.id
    || (field.tableId && field.key ? `${field.tableId}.${field.key}` : '');
  const response = await fetchLookup(lookupSource, {
    limit,
    fieldId,
    schemaVersion,
    itemCode: line.itemNo || line.ItemCode || '',
    documentType,
  });

  return normalizeLookupOptions(response);
};

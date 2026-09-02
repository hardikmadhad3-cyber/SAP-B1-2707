import { buildSalesOrderRowUdfDefinitionsFromSchema } from '../modules/sales-order/documentLayout';
import { filterLayoutToCurrentSchema, isSalesDocumentSchemaForCompany } from './salesDocumentLiveFields';
import { normalizeSalesDocumentSchema } from './salesDocumentSchema';

const token = (value) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/^U_/, '')
  .replace(/[^A-Z0-9]+/g, '');

const SERVICE_FIELD_KEYS = Object.freeze({
  LINENUM: '__lineNumber',
  DESCRIPTION: 'description',
  ITEMDESCRIPTION: 'description',
  DSCRIPTION: 'description',
  GLACCOUNT: 'glAccount',
  ACCOUNT: 'glAccount',
  ACCOUNTCODE: 'glAccount',
  ACCTCODE: 'glAccount',
  QUANTITY: 'sQty',
  SQTY: 'sQty',
  UNITPRICE: 'unitPrice',
  PRICE: 'unitPrice',
  DISCOUNTPERCENT: 'discountPercent',
  DISCPRCNT: 'discountPercent',
  TAXCODE: 'taxCode',
  VATGROUP: 'taxCode',
  COSTINGCODE: 'distRule',
  DISTRIBUTIONRULE: 'distRule',
  OCRCODE: 'distRule',
  COSTINGCODE2: 'distRule2',
  OCRCODE2: 'distRule2',
  COSTINGCODE3: 'distRule3',
  OCRCODE3: 'distRule3',
  COSTINGCODE4: 'distRule4',
  OCRCODE4: 'distRule4',
  COSTINGCODE5: 'distRule5',
  OCRCODE5: 'distRule5',
  PROJECTCODE: 'projectCode',
  PROJECT: 'projectCode',
  WTLIABLE: 'wtaxLiable',
  WTAXLIABLE: 'wtaxLiable',
  SACENTRY: 'sac',
  SAC: 'sac',
  LOCATIONCODE: 'loc',
  LOCCODE: 'loc',
  LOCATION: 'loc',
  AGREEMENTNO: 'blanketAgreementNo',
  AGRNO: 'blanketAgreementNo',
  LINETOTAL: 'totalLC',
  TOTALFRGN: 'totalDocumentCurrency',
  ROWTOTALFC: 'totalDocumentCurrency',
  TAXAMOUNT: 'taxAmountLC',
  VATSUM: 'taxAmountLC',
});

const WRITABLE_SERVICE_KEYS = new Set([
  'description',
  'glAccount',
  'sQty',
  'unitPrice',
  'discountPercent',
  'taxCode',
  'distRule',
  'distRule2',
  'distRule3',
  'distRule4',
  'distRule5',
  'projectCode',
  'wtaxLiable',
  'sac',
  'loc',
  'blanketAgreementNo',
]);

const ITEM_ONLY_SERVICE_TOKENS = new Set([
  'ITEMCODE',
  'WAREHOUSECODE',
  'WHSCODE',
  'UOMCODE',
  'UOMENTRY',
  'BARCODE',
  'NUMPERMSR',
  'INVENTORYQUANTITY',
  'USEBASEUNITS',
]);

export const SAP_STANDARD_SERVICE_MATRIX_COLUMNS = Object.freeze([
  Object.freeze({ key: 'description', fieldName: 'Dscription', sapField: 'ItemDescription', label: 'Description', width: 240, visible: true, requiredVisible: true, source: 'sap-standard-service-fallback' }),
  Object.freeze({ key: 'glAccount', fieldName: 'AcctCode', sapField: 'AccountCode', label: 'G/L Account', width: 145, visible: true, requiredVisible: true, lookup: 'account', source: 'sap-standard-service-fallback' }),
  Object.freeze({ key: 'unitPrice', fieldName: 'Price', sapField: 'UnitPrice', label: 'Unit Price', width: 120, visible: true, numeric: true, source: 'sap-standard-service-fallback' }),
  Object.freeze({ key: 'discountPercent', fieldName: 'DiscPrcnt', sapField: 'DiscountPercent', label: 'Discount %', width: 105, visible: true, numeric: true, source: 'sap-standard-service-fallback' }),
  Object.freeze({ key: 'taxCode', fieldName: 'VatGroup', sapField: 'TaxCode', label: 'Tax Code', width: 120, visible: true, lookup: 'tax', source: 'sap-standard-service-fallback' }),
  Object.freeze({ key: 'distRule', fieldName: 'OcrCode', sapField: 'CostingCode', label: 'Distribution Rule', width: 145, visible: true, lookup: 'distRule', source: 'sap-standard-service-fallback' }),
  Object.freeze({ key: 'wtaxLiable', fieldName: 'WTLiable', sapField: 'WTLiable', label: 'WTax Liable', width: 105, visible: true, lookup: 'yesNo', source: 'sap-standard-service-fallback' }),
  Object.freeze({ key: 'sac', fieldName: 'SacEntry', sapField: 'SACEntry', label: 'SAC', width: 110, visible: true, lookup: 'sac', source: 'sap-standard-service-fallback' }),
  Object.freeze({ key: 'loc', fieldName: 'LocCode', sapField: 'LocationCode', label: 'Loc.', width: 115, visible: true, lookup: 'location', source: 'sap-standard-service-fallback' }),
  Object.freeze({ key: 'totalLC', fieldName: 'LineTotal', sapField: 'LineTotal', label: 'Total (LC)', width: 120, visible: true, numeric: true, readOnly: true, source: 'sap-standard-service-fallback' }),
  Object.freeze({ key: 'taxAmountLC', fieldName: 'VatSum', sapField: 'TaxAmount', label: 'Tax Amount (LC)', width: 130, visible: true, numeric: true, readOnly: true, source: 'sap-standard-service-fallback' }),
]);

export const getSapStandardServiceMatrixColumns = () => (
  SAP_STANDARD_SERVICE_MATRIX_COLUMNS.map((column, index) => ({
    ...column,
    order: index + 1,
    columnOrder: index + 1,
    minWidth: column.width,
    active: !column.readOnly,
  }))
);

const isUdf = (field = {}) => (
  String(field.storage || '').toLowerCase() === 'udf'
  || String(field.sapField || field.databaseField || '').toUpperCase().startsWith('U_')
);

const resolveServiceKey = (field = {}) => {
  const candidates = [
    field.stateKey,
    field.sapField,
    field.databaseField,
    field.label,
  ];
  for (const candidate of candidates) {
    const key = SERVICE_FIELD_KEYS[token(candidate)];
    if (key) return key;
  }
  return '';
};

const inputType = (field = {}) => {
  const normalized = String(field.type || field.renderer || '').toLowerCase();
  if (['number', 'integer'].includes(normalized)) return 'number';
  if (normalized === 'date') return 'date';
  if (['checkbox', 'boolean'].includes(normalized)) return 'checkbox';
  return 'text';
};

const fieldTokens = (field = {}) => new Set([
  field.sapField,
  field.databaseField,
  field.stateKey,
  field.label,
].map(token).filter(Boolean));

const layoutTokens = (column = {}) => [
  column.fieldName,
  column.columnUid,
  column.columnTitle,
  column.label,
].map(token).filter(Boolean);

const findLayout = (field, layoutColumns) => {
  const tokens = fieldTokens(field);
  return layoutColumns.find((column) => layoutTokens(column).some((value) => tokens.has(value)));
};

const buildStandardColumn = (field, index, layout) => {
  const key = resolveServiceKey(field);
  const writable = WRITABLE_SERVICE_KEYS.has(key);
  const unsupportedKey = `sapLayout_${String(field.databaseField || field.sapField || index + 1).replace(/[^A-Za-z0-9_]+/g, '_')}`;
  const width = Number(layout?.width || field.width) || 125;
  const readOnly = !writable || field.readOnly || field.editable === false || layout?.editable === false;
  return {
    key: key || unsupportedKey,
    valueKey: key || unsupportedKey,
    rendererKey: key || unsupportedKey,
    fieldName: field.databaseField || field.sapField || '',
    sapField: field.sapField || field.databaseField || '',
    label: layout?.columnTitle || layout?.label || field.label || field.sapField,
    width,
    minWidth: width,
    order: Number(layout?.columnOrder ?? layout?.order ?? field.order) || index + 1,
    columnOrder: Number(layout?.columnOrder ?? layout?.order ?? field.order) || index + 1,
    visible: layout ? layout.visible !== false : field.visible !== false,
    active: !readOnly && (layout ? layout.editable !== false : field.editable !== false),
    readOnly,
    numeric: inputType(field) === 'number',
    type: inputType(field),
    lookupSource: field.lookup?.source || field.lookupSource || undefined,
    lookup: field.lookup,
    options: field.options || [],
    schemaFieldId: field.id,
    sapControlled: true,
    schemaDriven: true,
    displayOnly: !writable,
    requiredVisible: key === 'description' || key === 'glAccount',
    source: 'service-live-schema',
  };
};

export const buildServiceDocumentLiveFields = ({
  schema,
  documentType,
  headerTable,
  lineTable,
  companyId,
  companyDb,
  layoutResponse,
} = {}) => {
  const schemaMatchesCompany = isSalesDocumentSchemaForCompany(schema, { companyId, companyDb });
  const normalizedSchema = schemaMatchesCompany
    ? normalizeSalesDocumentSchema(schema, documentType)
    : null;
  const headerFields = normalizedSchema?.headerFields || [];
  const lineFields = normalizedSchema?.lineFields || [];
  const layout = layoutResponse?.data || layoutResponse || {};
  const hasLayout = String(layout.source || '').toLowerCase() !== 'fallback'
    && Array.isArray(layout.columns)
    && layout.columns.length > 0;
  const layoutColumns = hasLayout
    ? filterLayoutToCurrentSchema(layout.columns, lineFields)
    : [];
  const headerUdfFields = buildSalesOrderRowUdfDefinitionsFromSchema(headerFields, { lineTable: headerTable })
    .map((field) => ({ ...field, schemaDriven: true }));
  const rowUdfFields = buildSalesOrderRowUdfDefinitionsFromSchema(lineFields, { lineTable })
    .map((field, index) => {
      const udfLayout = findLayout(field, layoutColumns);
      const width = Number(udfLayout?.width || field.minWidth || field.width) || 125;
      return {
        ...field,
        label: udfLayout?.columnTitle || udfLayout?.label || field.label,
        visible: Boolean(udfLayout && udfLayout.visible !== false),
        active: Boolean(
          udfLayout
          && udfLayout.editable !== false
          && field.editable !== false
          && !field.readOnly
        ),
        readOnly: Boolean(field.readOnly || field.editable === false || udfLayout?.editable === false),
        order: Number(udfLayout?.columnOrder ?? udfLayout?.order ?? field.order) || 1000 + index,
        columnOrder: Number(udfLayout?.columnOrder ?? udfLayout?.order ?? field.order) || 1000 + index,
        minWidth: width,
        width,
        schemaDriven: true,
        sapControlled: Boolean(udfLayout),
      };
    });

  const standardFields = lineFields.filter((field) => (
    !isUdf(field)
    && ![field.stateKey, field.sapField, field.databaseField, field.label]
      .some((value) => ITEM_ONLY_SERVICE_TOKENS.has(token(value)))
  ));
  // A physical service line table contains many internal/item-mode columns.
  // Only fields present in the selected SAP user's matrix layout are eligible
  // for the live matrix. Without a usable layout, use the curated SAP service
  // fallback instead of exposing every physical column.
  const schemaColumns = (hasLayout ? standardFields : [])
    .map((field, index) => ({
      field,
      layout: findLayout(field, layoutColumns),
      index,
    }))
    .filter(({ layout }) => Boolean(layout))
    .map(({ field, layout: fieldLayout, index }) => buildStandardColumn(field, index, fieldLayout))
    .filter((column) => column.key !== '__lineNumber')
    .sort((left, right) => left.order - right.order);
  const matrixColumns = schemaColumns.length
    ? schemaColumns
    : getSapStandardServiceMatrixColumns();

  return {
    documentType,
    schemaMatchesCompany,
    liveSchema: normalizedSchema,
    headerUdfFields,
    rowUdfFields,
    matrixColumns,
    importedLayout: layout,
    liveAvailable: Boolean(normalizedSchema && lineFields.length),
    usedSapLayout: hasLayout,
  };
};

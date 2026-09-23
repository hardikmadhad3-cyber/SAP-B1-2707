const SAP_STANDARD_PURCHASE_MATRIX_KEYS = new Set([
  'itemNo',
  'itemDescription',
  'quantity',
  'openQty',
  'deliveryDate',
  'requiredDate',
  'quotedDate',
  'requiredQty',
  'uomCode',
  'uomName',
  'unitPrice',
  'stdDiscount',
  'discountPercent',
  'taxCode',
  'wtaxLiable',
  'total',
  'totalLC',
  'totalDocumentCurrency',
  'whse',
  'warehouseCode',
  'binLocationAllocation',
  'glAccount',
  'glAccountName',
  'itemCost',
  'distRule',
  'distRule2',
  'distRule3',
  'distRule4',
  'distRule5',
  'projectCode',
  'uomCode',
  'countryOfOrigin',
  'loc',
  'withoutQtyPosting',
  'blanketAgreementNo',
  'hsnCode',
  'sac',
  'sacCode',
  'costSheet',
  'containerType',
]);

export const filterSafePurchaseMatrixColumns = (columns = []) => (
  (Array.isArray(columns) ? columns : []).filter((column) => (
    column?.key && SAP_STANDARD_PURCHASE_MATRIX_KEYS.has(column.key)
  ))
);

const PURCHASE_QUOTATION_FIELD_KEYS = Object.freeze({
  PQTREQDATE: 'requiredDate',
  REQDATE: 'requiredDate',
  PQTREQQTY: 'requiredQty',
  REQQTY: 'requiredQty',
  SHIPDATE: 'quotedDate',
});

const normalizePhysicalField = (column = {}) => String(
  column.fieldName || column.sapField || column.databaseField || '',
).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');

export const normalizePurchaseQuotationMatrixColumns = (columns = []) => (
  (Array.isArray(columns) ? columns : []).map((column) => {
    if (column?.isUdf) return column;
    const key = PURCHASE_QUOTATION_FIELD_KEYS[normalizePhysicalField(column)];
    return key ? { ...column, key, valueKey: key, rendererKey: key } : column;
  }).filter((column, index, all) => (
    column?.key && all.findIndex((candidate) => candidate?.key === column.key) === index
  ))
);

export { SAP_STANDARD_PURCHASE_MATRIX_KEYS };

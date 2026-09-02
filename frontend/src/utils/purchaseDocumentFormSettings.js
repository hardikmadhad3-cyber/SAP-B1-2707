const SAP_STANDARD_PURCHASE_MATRIX_KEYS = new Set([
  'itemNo',
  'itemDescription',
  'quantity',
  'openQty',
  'deliveryDate',
  'requiredDate',
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
]);

export const filterSafePurchaseMatrixColumns = (columns = []) => (
  (Array.isArray(columns) ? columns : []).filter((column) => (
    column?.key && SAP_STANDARD_PURCHASE_MATRIX_KEYS.has(column.key)
  ))
);

export { SAP_STANDARD_PURCHASE_MATRIX_KEYS };

import { BASE_MATRIX_COLUMNS as AP_INVOICE_COLUMNS } from '../config/APInvoiceForm';
import { BASE_MATRIX_COLUMNS as AP_CREDIT_MEMO_COLUMNS } from '../config/APCreditMemoForm';
import { BASE_MATRIX_COLUMNS as GRPO_COLUMNS } from '../config/grpoForm';
import { BASE_MATRIX_COLUMNS as PURCHASE_ORDER_COLUMNS } from '../config/purchaseOrderForm';
import { BASE_MATRIX_COLUMNS as PURCHASE_QUOTATION_COLUMNS } from '../config/purchaseQuotationForm';
import {
  FORM_SETTINGS_STORAGE_KEY as PURCHASE_REQUEST_STORAGE_KEY,
} from '../config/purchaseRequestForm';
import {
  FORM_SETTINGS_STORAGE_KEY as PURCHASE_ORDER_STORAGE_KEY,
} from '../config/purchaseOrderForm';
import { normalizePurchaseQuotationMatrixColumns } from './purchaseDocumentFormSettings';

const PSEUDO_UDF_KEYS = new Set([
  'buyerQuality',
  'sellerQuality',
  'buyerPrice',
  'sellerPrice',
  'packingType',
  'grossWt',
  'totalPackage',
]);

test('all Purchase fallbacks expose only the curated SAP item-document fields', () => {
  for (const columns of [
    PURCHASE_QUOTATION_COLUMNS,
    PURCHASE_ORDER_COLUMNS,
    GRPO_COLUMNS,
    AP_INVOICE_COLUMNS,
    AP_CREDIT_MEMO_COLUMNS,
  ]) {
    expect(columns.length).toBeGreaterThan(0);
    expect(columns.some((column) => PSEUDO_UDF_KEYS.has(column.key))).toBe(false);
    expect(columns.some((column) => column.key === 'itemNo')).toBe(true);
    expect(columns.some((column) => column.key === 'itemDescription')).toBe(true);
  }
});

test('Purchase Request preferences cannot reuse Purchase Order storage', () => {
  expect(PURCHASE_REQUEST_STORAGE_KEY).not.toBe(PURCHASE_ORDER_STORAGE_KEY);
});

test('maps physical SAP quotation dates and quantities to quotation renderers', () => {
  const result = normalizePurchaseQuotationMatrixColumns([
    { key: 'sap_PQTReqDate', fieldName: 'PQTReqDate' },
    { key: 'deliveryDate', fieldName: 'ShipDate' },
    { key: 'sap_PQTReqQty', fieldName: 'PQTReqQty' },
    { key: 'quantity', fieldName: 'Quantity' },
    { key: 'udf:U_ShipDate', fieldName: 'U_ShipDate', isUdf: true },
  ]);
  expect(result.map((column) => column.key)).toEqual([
    'requiredDate', 'quotedDate', 'requiredQty', 'quantity', 'udf:U_ShipDate',
  ]);
});

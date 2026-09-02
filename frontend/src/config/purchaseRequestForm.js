import {
  BASE_MATRIX_COLUMNS,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createDefaultFormSettings,
  createUdfState,
  readSavedFormSettings as readPurchaseOrderFormSettings,
} from './purchaseOrderForm';

export {
  BASE_MATRIX_COLUMNS,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createDefaultFormSettings,
  createUdfState,
};

export const FORM_SETTINGS_STORAGE_KEY = 'sapb1.purchaseRequest.formSettings.v1';

export const readSavedFormSettings = (
  headerUdfs = HEADER_UDF_DEFINITIONS,
  rowUdfs = ROW_UDF_DEFINITIONS,
  matrixColumns = BASE_MATRIX_COLUMNS,
  storageKey = FORM_SETTINGS_STORAGE_KEY,
) => readPurchaseOrderFormSettings(
  headerUdfs,
  rowUdfs,
  matrixColumns,
  storageKey || FORM_SETTINGS_STORAGE_KEY,
);

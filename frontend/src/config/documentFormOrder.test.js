jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/formSettingsApi', () => ({ fetchFormSettings: jest.fn(), saveFormSettings: jest.fn() }));

import { readSavedFormSettings as quotation } from './salesQuotationForm';
import { readSavedFormSettings as order } from './salesOrderForm';
import { readSavedFormSettings as delivery } from './deliveryForm';
import { readSavedFormSettings as arInvoice } from './arInvoiceForm';
import { readSavedFormSettings as arCredit } from './arCreditMemoForm';
import { readSavedFormSettings as purchase } from './purchaseOrderForm';
import { readSavedFormSettings as grpo } from './grpoForm';
import { readSavedFormSettings as apInvoice } from './APInvoiceForm';
import { readSavedFormSettings as apCredit } from './APCreditMemoForm';
import { applyPublishedQueryLayoutToSettings } from '../utils/formSettingsStorage';
import { getOrderedVisibleMatrixColumns } from '../utils/formSettingsColumns';

beforeEach(() => window.localStorage.clear());

test.each([
  ['Sales Quotation', quotation], ['Sales Order', order], ['Delivery', delivery],
  ['A/R Invoice', arInvoice], ['A/R Credit Memo', arCredit], ['Purchase Order', purchase],
  ['GRPO', grpo], ['A/P Invoice', apInvoice], ['A/P Credit Memo', apCredit],
])('%s preserves saved standard/UDF order across schema changes', (_page, read) => {
  const key = 'company-a-settings';
  window.localStorage.setItem(key, JSON.stringify({
    matrixColumns: { quantity: { visible: true, order: 1 }, itemNo: { visible: true, order: 3 }, obsolete: { order: 0 } },
    rowUdfs: { U_Current: { visible: true, order: 2, active: true }, U_Removed: { order: 0 } },
  }));
  const matrix = [{ key: 'itemNo', order: 1 }, { key: 'quantity', order: 2 }, { key: 'newField', order: 0 }];
  const udfs = [{ key: 'U_Current', order: 3, active: false, sapControlled: true }];
  const settings = read([], udfs, matrix, key);
  expect(getOrderedVisibleMatrixColumns([...matrix, ...udfs], settings).map((column) => column.key))
    .toEqual(['quantity', 'U_Current', 'itemNo', 'newField']);
  expect(settings.matrixColumns.obsolete).toBeUndefined();
  expect(settings.rowUdfs.U_Removed).toBeUndefined();
  expect(settings.rowUdfs.U_Current.active).toBe(false);
  const companyB = read([], [{ key: 'U_CompanyB', order: 2 }], matrix, 'company-b-settings');
  expect(companyB.rowUdfs.U_Current).toBeUndefined();
  const published = applyPublishedQueryLayoutToSettings(companyB, {
    isPublished: true, version: 7,
    columns: [{ key: 'Quantity' }, { key: 'U_CompanyB' }, { key: 'Item_No' }],
  }, [[], [{ key: 'U_CompanyB' }], matrix]);
  expect(getOrderedVisibleMatrixColumns([...matrix, { key: 'U_CompanyB' }], published).map((column) => column.key))
    .toEqual(['quantity', 'U_CompanyB', 'itemNo']);
});

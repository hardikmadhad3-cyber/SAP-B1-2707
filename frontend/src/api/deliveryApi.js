import apiClient from './client';

// ─────────── Reference Data ───────────
const fetchDeliveryReferenceData = (companyId) =>
  apiClient.get('/delivery/reference-data', {
    params: { company_id: companyId },
  });

// ─────────── Customer ───────────
const fetchDeliveryCustomerDetails = (customerCode) =>
  apiClient.get(`/delivery/customers/${encodeURIComponent(customerCode)}`);

const saveDeliverySalesEmployeesSetup = (employees = []) =>
  apiClient.post('/delivery/sales-employees/setup', { employees });

// ─────────── Documents ───────────
const fetchDeliveries = (params = {}) =>
  apiClient.get('/delivery/list', { params });

const fetchDeliveryCustomerOptions = (params = {}) =>
  apiClient.get('/delivery/customers/search', { params });

const fetchDeliveryByDocEntry = (docEntry) =>
  apiClient.get(`/delivery/${encodeURIComponent(docEntry)}`);

// ─────────── Submit / Update ───────────
const submitDelivery = (payload) =>
  apiClient.post('/delivery', payload);

const updateDelivery = (docEntry, payload) =>
  apiClient.patch(`/delivery/${docEntry}`, payload);

// ─────────── Series ───────────
const fetchDocumentSeries = (date = '', options = {}) =>
  apiClient.get('/delivery/series', {
    params: {
      ...(date ? { date } : {}),
      ...options,
    },
  });

const fetchNextNumber = (series, { date = '', branch = '' } = {}) =>
  apiClient.get(`/delivery/series/${series}/next-number`, { params: { date, branch } });

// ─────────── GST / Location ───────────
const fetchStateFromWarehouse = (whsCode) =>
  apiClient.get(`/delivery/warehouse-state/${encodeURIComponent(whsCode)}`);

const fetchCompanyState = () =>
  apiClient.get('/delivery/company-state');

// ─────────── Copy From Sales Order ───────────
const fetchOpenSalesOrders = (customerCode = null) =>
  apiClient.get('/delivery/open-sales-orders', {
    params: customerCode ? { customerCode } : {},
  });

const fetchSalesOrderForCopy = (docEntry) =>
  apiClient.get(`/delivery/sales-order/${encodeURIComponent(docEntry)}/copy`);

// ─────────── Copy From Sales Quotation ───────────
const fetchOpenSalesQuotationsForDelivery = (customerCode = null) =>
  apiClient.get('/sales-quotation/open', {
    params: customerCode ? { customerCode } : {},
  });

const fetchSalesQuotationForDeliveryCopy = (docEntry) =>
  apiClient.get(`/sales-quotation/${encodeURIComponent(docEntry)}/copy`);

// ─────────── Copy From Returns (AR Credit Memo) ───────────
const fetchOpenArReserveInvoicesForDelivery = (customerCode = null) =>
  apiClient.get('/delivery/open-ar-reserve-invoices', {
    params: customerCode ? { customerCode } : {},
  });

const fetchArReserveInvoiceForDeliveryCopy = (docEntry) =>
  apiClient.get(`/delivery/ar-reserve-invoice/${encodeURIComponent(docEntry)}/copy`);

// ─────────── Copy From Blanket Agreement ───────────

// ─────────── Copy To Credit Memo ───────────
const fetchDeliveryForCopyToCreditMemo = (docEntry) =>
  apiClient.get(`/delivery/delivery/${encodeURIComponent(docEntry)}/copy-to-credit-memo`);

// ─────────── Batch / Item Management ───────────
const fetchBatchesByItem = (itemCode, whsCode) =>
  apiClient.get('/delivery/batches', {
    params: { itemCode, whsCode },
  });

const fetchSerialsByItem = (itemCode, whsCode) =>
  apiClient.get('/delivery/serials', { params: { itemCode, whsCode } });

const fetchBinsByItem = (itemCode, whsCode) =>
  apiClient.get('/delivery/bins', { params: { itemCode, whsCode } });

const fetchItemManagementType = (itemCode) =>
  apiClient.get(`/delivery/item-management/${encodeURIComponent(itemCode)}`);

const fetchFreightCharges = (docEntry) =>
  apiClient.get('/delivery/freight-charges', { params: { docEntry } });

const fetchItemsForModal = (whsCode = '') =>
  apiClient.get('/delivery/items-modal', {
    params: whsCode ? { whsCode } : {},
  });

const createDeliveryLookupValue = (field, value, description = '') =>
  apiClient.post('/delivery/lookup-values', { field, value, description });

const fetchUomConversionFactor = (itemCode, uomCode) =>
  apiClient.get('/delivery/uom-conversion', {
    params: { itemCode, uomCode },
  });

// ─────────── Validation ───────────
const validateDeliveryDocument = (payload) =>
  apiClient.post('/delivery/validate', payload);

// ─────────── EXPORTS ───────────
export {
  fetchDeliveryReferenceData,
  fetchDeliveryByDocEntry,
  fetchDeliveries,
  fetchDeliveryCustomerOptions,
  fetchDeliveryCustomerDetails,
  saveDeliverySalesEmployeesSetup,
  submitDelivery,
  updateDelivery,
  fetchDocumentSeries,
  fetchItemsForModal,
  fetchUomConversionFactor,
  fetchNextNumber,
  fetchStateFromWarehouse,
  fetchCompanyState,
  fetchOpenSalesOrders,
  fetchSalesOrderForCopy,
  fetchOpenSalesQuotationsForDelivery,
  fetchSalesQuotationForDeliveryCopy,
  fetchOpenArReserveInvoicesForDelivery,
  fetchArReserveInvoiceForDeliveryCopy,
  fetchDeliveryForCopyToCreditMemo,
  fetchBatchesByItem,
  fetchSerialsByItem,
  fetchBinsByItem,
  fetchItemManagementType,
  fetchFreightCharges,
  validateDeliveryDocument,
  createDeliveryLookupValue,
};

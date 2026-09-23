const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { buildDocumentAdditionalExpenses } = require('../services/freightPayloadUtils');
const { buildDocumentConfirmationPayload, updateDocumentConfirmationOnly } = require('../services/documentConfirmationUtils');

function loadPayloadHandlers() {
 const source = fs.readFileSync(require.resolve('../services/salesQuotationService'), 'utf8');
 const start = source.indexOf('const submitSalesQuotation =');
 const end = source.indexOf('const getDocumentSeries =', start);
 const requests = [];
 const context = {
  console: { log() {}, error() {}, warn() {} },
  getReferenceData: async () => ({}), getCustomerDetails: async () => ({}),
  normalizeSubmittedAddressHeader: header => header,
  convertSalesEmployeeToCode: async () => null, convertOwnerToCode: async () => null,
  getHeaderDiscountPercent: header => Number(header.discount || 0),
  buildDocumentAdditionalExpenses, buildDocumentLines: async lines => lines,
  resolveSubmittedBranchId: () => undefined, validateSubmittedBranch() {},
  buildDocumentSeriesPayload: () => ({}), buildDocumentRoundingPayload: () => ({}),
  buildDocumentConfirmationPayload,
  updateDocumentConfirmationOnly,
  buildMarketingDocumentAddressPayload: () => ({}), applySapDocumentCurrency() {},
  applySalesQuotationHeaderUdfs: async () => {},
  sapService: { request: async request => { requests.push(request); return { DocEntry: 1, DocNum: 100 }; } },
 };
 assert.ok(start >= 0 && end > start);
 const handlers = vm.runInNewContext(source.slice(start, end) + '\n({ submitSalesQuotation, updateSalesQuotation });', context);
 return { handlers, requests };
}

test('quotation POST and PATCH include reference and expense rows, including reference clears', async () => {
 const { handlers, requests } = loadPayloadHandlers();
 const payload = {
  header: { vendor: 'C001', customerRefNo: 'CUSTOMER-123', freight: '100' },
  lines: [{ ItemCode: 'I001' }],
  freightCharges: [{ expnsCode: 1, netAmount: 100, taxCode: '12-GST' }],
 };
 await handlers.submitSalesQuotation(payload);
 await handlers.updateSalesQuotation(1, payload);
 for (const request of requests) {
  assert.equal(request.data.NumAtCard, 'CUSTOMER-123');
  assert.deepEqual(request.data.DocumentAdditionalExpenses, [{ ExpenseCode: 1, LineTotal: 100, TaxCode: '12-GST' }]);
 }
 assert.equal(requests[0].method, 'post');
 assert.equal(requests[1].method, 'patch');
 await handlers.updateSalesQuotation(1, { ...payload, header: { ...payload.header, customerRefNo: '', salesContractNo: 'OLD' } });
 assert.equal(requests[2].data.NumAtCard, '');
 await handlers.submitSalesQuotation({ ...payload, header: { vendor: 'C001', salesContractNo: 'LEGACY' } });
 assert.equal(requests[3].data.NumAtCard, 'LEGACY');
});

test('quotation create and update preserve SAP defaults and honor explicit confirmation', async () => {
 const { handlers, requests } = loadPayloadHandlers();
 for (const confirmed of [undefined, true, false]) {
  const payload = { header: { vendor: 'C001', confirmed }, lines: [{ ItemCode: 'I001' }] };
  await handlers.submitSalesQuotation(payload);
  await handlers.updateSalesQuotation(1, payload);
  for (const request of requests.slice(-2)) {
   if (confirmed === undefined) assert.equal('Confirmed' in request.data, false);
   else assert.equal(request.data.Confirmed, confirmed ? 'tYES' : 'tNO');
   assert.equal('AuthorizationStatus' in request.data, false);
  }
 }
});


test('quotation Copy To forwards freight rows through Sales Order route adapter', async () => {
 const path = require('node:path');
 const quotationSource = fs.readFileSync(path.join(__dirname, '../../frontend/src/modules/sales-quotation/SalesQuotation.jsx'), 'utf8');
 const start = quotationSource.indexOf('  const handleCopyTo = async');
 const end = quotationSource.indexOf('  const handleDuplicate =', start);
 let request;
 const freightCharges = [{ expnsCode: 1, netAmount: 100, taxCode: '12-GST' }];
 const header = { customerRefNo: 'CUSTOMER-123', freight: '100', docNo: '10008' };
 const handler = vm.runInNewContext(quotationSource.slice(start, end) + '\nhandleCopyTo;', {
  copyToDocument: async value => { request = value; }, currentDocEntry: 8,
  header, lines: [{ itemNo: 'I001', quantity: '120' }], headerUdfs: { U_Test: 'kept' },
  freightModal: { freightCharges }, location: { pathname: '/sales-quotation' },
  navigate() {}, upsertTask() {}, removeTask() {}, closeDocumentDropdowns() {},
  pageState: { loading: false }, setPageState() {},
 });
 await handler('sales-order');
 assert.equal(request.sourceSnapshot.freightCharges, freightCharges);
 assert.equal(request.sourceSnapshot.header.customerRefNo, 'CUSTOMER-123');
 const orderSource = fs.readFileSync(path.join(__dirname, '../../frontend/src/modules/sales-order/SalesOrder.jsx'), 'utf8');
 const routeStart = orderSource.indexOf('const routedCopyFrom =');
 const adapterStart = orderSource.indexOf('handleCopyFrom({', routeStart);
 const adapterEnd = orderSource.indexOf('}, copyFrom.type);', adapterStart) + '}, copyFrom.type);'.length;
 let received;
 vm.runInNewContext(orderSource.slice(adapterStart, adapterEnd), {
  copyFrom: { ...request.sourceSnapshot, type: 'salesQuotation', docEntry: 8 },
  handleCopyFrom: value => { received = value; },
 });
 assert.equal(received.freightCharges, freightCharges);
 assert.equal(received.header.customerRefNo, 'CUSTOMER-123');
 assert.equal(received.header_udfs.U_Test, 'kept');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildDocumentAdditionalExpenses } = require('../services/freightPayloadUtils');
const read = file => fs.readFileSync(path.join(__dirname, '../../frontend/src', file), 'utf8');

function loadCopyHandler(file) {
 const api = read('api/copyFromApi.js');
 const unwrap = api.slice(api.indexOf('export const unwrapCopyFromDocument'), api.indexOf('const normalizeBranchValue')).replace('export ', '');
 const utils = read('components/freight/freightUtils.js').replace(/export /g, '');
 const page = read(file);
 const start = page.indexOf('  const handleCopyFrom =');
 const end = page.indexOf('\n  };', start) + 6;
 const state = { header: { vendor: 'C001', freight: '150' }, freight: { freightCharges: [{ expnsCode: 1, netAmount: 150, taxCode: 'OLD-GST' }] } };
 const noop = () => {};
 const context = {
  console: {log:noop}, setSeriesRevision:noop, effectiveTaxCodes:[{ Code:'12-GST', Rate:12 }],
  setFreightModal: value => { state.freight = value; },
  setHeader: update => { state.header = update(state.header); },
  header: state.header, normaliseDocumentHeader: value => value,
  BASE_TYPE: {salesOrder:17, delivery:15, arInvoice:13}, normalizeBranchSelection: value => value || '',
  normalizeWarehouse: () => '', getBranchFromWarehouseCode: () => '', today: () => '2026-09-17',
  refData: {}, INIT_HEADER: {}, fmtDec: value => String(value), numDec:{freight:2},
  setSeriesReloadToken:noop, mergeUdfValues:() => ({}), normalizeUdfState:() => ({}),
  headerUdfDefinitions:[], rowUdfDefinitions:[], setHeaderUdfs:noop, createLine:() => ({}),
  setLines:noop, refreshBatchAvailabilityForLines:noop, setPageState:noop,
  DEFAULT_WAREHOUSE_CODE: '',
 };
 const handler = vm.runInNewContext(unwrap + utils + page.slice(start, end) + '\nhandleCopyFrom;', context);
 return { handler, state };
}
for (const page of ['modules/ar-invoice/ARInvoicePage.jsx', 'modules/ar-CreditMemo/ARCreditMemo.jsx']) {
 test(page + ': copying a source without freight clears earlier quotation charges', () => {
  const {handler,state} = loadCopyHandler(page);
  handler({ header: {vendor:'C001', Freight:0}, lines:[] }, 'salesOrder');
  assert.equal(state.header.freight, '0');
  assert.equal(state.freight.freightCharges.length, 0);
  assert.equal(buildDocumentAdditionalExpenses(state.freight.freightCharges).length, 0);
 });
 test(page + ': copying freight preserves the source tax code in the SAP payload', () => {
  const {handler,state} = loadCopyHandler(page);
  handler({ header: {vendor:'C001'}, lines:[], freightCharges:[{ ExpnsCode:2, LineTotal:100, TaxCode:'12-GST' }, { ExpnsCode:3, LineTotal:0 }] }, 'delivery');
  assert.equal(state.header.freight, '100');
  assert.deepEqual(buildDocumentAdditionalExpenses(state.freight.freightCharges), [{ExpenseCode:2, LineTotal:100, TaxCode:'12-GST'}]);
 });
}

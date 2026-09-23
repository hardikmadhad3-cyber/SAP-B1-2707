'use strict';
const { resolveMarketingDocumentSeries } = require('./documentSeriesDbUtils');
const { getManualDocumentNumber } = require('./documentSeriesPayloadUtils');
const { getRequestContext } = require('./requestContextService');
const endpoints = { Orders: '17', Quotations: '23', DeliveryNotes: '15', Returns: '16', Invoices: '13', CreditNotes: '14',
  PurchaseOrders: '22', PurchaseQuotations: '540000006', PurchaseRequests: '1470000113', PurchaseDeliveryNotes: '20',
  PurchaseReturns: '21', PurchaseInvoices: '18', PurchaseCreditNotes: '19',
  ProductionOrders: '202', InventoryGenExits: '60', InventoryGenEntries: '59' };
const invalid = (message) => Object.assign(new Error(message), { statusCode: 400, code: 'SAP_DOCUMENT_SERIES' });
const validateMarketingSeriesWrite = async (config, { db, resolve = resolveMarketingDocumentSeries } = {}) => {
  if (String(config.method || '').toUpperCase() !== 'POST') return;
  const endpoint = String(config.url || '').replace(/^\//, '').split('?')[0];
  const objectCode = endpoints[endpoint];
  if (!objectCode) return; // Updates/cancellations retain the original document identity.
  const payload = config.data || {};
  const header = getRequestContext()?.req?.body?.header || {};
  const result = await resolve({ db: db || require('./dbService'), objectCode, purpose: 'posting', targetDate: payload.DocDate,
    branch: payload.BPL_IDAssignedToInvoice ?? payload.BPLId ?? '',
    docSubType: payload.DocumentSubType,
    transactionType: payload.GSTTransactionType || header.GSTTransactionType || header.transactionType });
  if (result.country === 'IN' && ['13','14','18','19'].includes(objectCode)) {
    const gstTypes = { GA: 'gsttrantyp_GSTTaxInvoice', GD: 'gsttrantyp_GSTDebitMemo', '--': 'gsttrantyp_BillOfSupply' };
    if (gstTypes[result.docSubType]) payload.GSTTransactionType = gstTypes[result.docSubType];
  }
  const manual = Number(payload.Series) === -1;
  if (manual) {
    if (!result.manualAllowed) throw invalid(result.reason || 'Your SAP user cannot use manual document numbering.');
    getManualDocumentNumber({ nextNumber: payload.DocNum });
    payload.HandWritten = 'tYES';
    return;
  }
  const selected = result.series.find(row => Number(row.Series) === Number(payload.Series));
  if (!selected) throw invalid(result.reason || 'Select an eligible numbering series before adding this document.');
  if (payload.HandWritten === 'tYES') throw invalid('Automatic numbering cannot be handwritten.');
  // SAP owns number allocation. Do not send a preview as the final document number.
  delete payload.DocNum;

};
module.exports = { validateMarketingSeriesWrite, endpoints };

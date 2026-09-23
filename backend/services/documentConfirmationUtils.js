'use strict';

// Confirmation is independent of SAP's approval workflow. An absent choice
// must leave the active company's SAP default (or saved value on PATCH) intact.
const buildDocumentConfirmationPayload = (header = {}) => {
  const value = header.confirmed ?? header.Confirmed;
  if (value === undefined || value === null || value === '') return {};
  const normalized = String(value).trim().toUpperCase();
  if (['TRUE', 'Y', 'YES', '1', 'TYES'].includes(normalized)) return { Confirmed: 'tYES' };
  if (['FALSE', 'N', 'NO', '0', 'TNO'].includes(normalized)) return { Confirmed: 'tNO' };
  throw Object.assign(new Error('Invalid document confirmation value.'), { statusCode: 400 });
};

const resolveDocumentConfirmationStatus = (status, confirmed) => (
  String(status || '').toLowerCase() === 'open'
    && ['N', 'TNO', 'FALSE'].includes(String(confirmed).trim().toUpperCase())
    ? 'Unapproved' : status
);

module.exports = { buildDocumentConfirmationPayload, resolveDocumentConfirmationStatus };

const updateDocumentConfirmationOnly = async (docEntry, payload, entity, sapService) => {
  if (payload?.confirmation_only !== true) return null;
  const fail = () => { throw Object.assign(new Error('Confirmation-only updates must contain only a confirmation choice.'), { statusCode: 400 }); };
  const entities = new Set(['DeliveryNotes', 'Orders', 'Quotations', 'Invoices', 'CreditNotes',
    'PurchaseOrders', 'PurchaseQuotations', 'PurchaseRequests', 'PurchaseDeliveryNotes', 'PurchaseInvoices', 'PurchaseCreditNotes']);
  if (!entities.has(entity) || !/^\d+$/.test(String(docEntry)) || Number(docEntry) <= 0) fail();
  if (Object.keys(payload).some(key => !['company_id', 'confirmation_only', 'header'].includes(key))) fail();
  if (!payload.header || Object.keys(payload.header).some(key => key !== 'confirmed')) fail();
  const data = buildDocumentConfirmationPayload(payload.header);
  if (!data.Confirmed) fail();
  await sapService.request({ method: 'PATCH', url: `/${entity}(${docEntry})`, data });
  return { success: true, message: 'Document confirmation updated successfully.', doc_entry: Number(docEntry) };
};

module.exports.updateDocumentConfirmationOnly = updateDocumentConfirmationOnly;

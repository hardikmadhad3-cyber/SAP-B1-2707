'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AP_INVOICE_BASE_DOCUMENTS,
  resolveApInvoiceBaseDocument,
} = require('../services/apInvoiceDbService');

test('an A/P Invoice can be drawn from a Goods Receipt PO or a Purchase Order', () => {
  assert.deepEqual(
    Object.keys(AP_INVOICE_BASE_DOCUMENTS).map(Number).sort((a, b) => a - b),
    [20, 22],
  );

  const grpo = resolveApInvoiceBaseDocument(20);
  assert.equal(grpo.label, 'Goods Receipt PO');
  assert.equal(grpo.headerTable, 'OPDN');
  assert.equal(grpo.lineTable, 'PDN1');

  const purchaseOrder = resolveApInvoiceBaseDocument(22);
  assert.equal(purchaseOrder.label, 'Purchase Order');
  assert.equal(purchaseOrder.headerTable, 'OPOR');
  assert.equal(purchaseOrder.lineTable, 'POR1');
});

test('only a Purchase Order source still allocates batches on the invoice', () => {
  // Goods against a receipt are already in stock, so the invoice must not
  // re-allocate them. Invoicing an order directly is what receives the stock.
  assert.equal(resolveApInvoiceBaseDocument(20).allowsBatchAllocation, false);
  assert.equal(resolveApInvoiceBaseDocument(22).allowsBatchAllocation, true);
});

test('a base type SAP does not allow into an A/P Invoice is rejected', () => {
  // A Sales Order, Delivery or A/R Invoice must never become an A/P Invoice base.
  for (const baseType of [13, 15, 17, 18, 23, 0, -1]) {
    assert.equal(resolveApInvoiceBaseDocument(baseType), null, `base type ${baseType}`);
  }
  assert.equal(resolveApInvoiceBaseDocument(undefined), null);
  assert.equal(resolveApInvoiceBaseDocument('not a number'), null);
});

test('a numeric string base type resolves, since request payloads carry strings', () => {
  assert.equal(resolveApInvoiceBaseDocument('22').label, 'Purchase Order');
  assert.equal(resolveApInvoiceBaseDocument('20').label, 'Goods Receipt PO');
});

test('the A/P Invoice route exposes a Purchase Order copy endpoint', () => {
  const controller = require('../controllers/apInvoiceController');
  const service = require('../services/apInvoiceService');
  assert.equal(typeof controller.getPurchaseOrderForCopy, 'function');
  assert.equal(typeof service.getPurchaseOrderForCopy, 'function');
  assert.equal(typeof service.getBaseDocumentForCopy, 'function');
  // The Goods Receipt PO entry point stays in place for existing callers.
  assert.equal(typeof controller.getGRPOForCopy, 'function');
  assert.equal(typeof service.getGRPOForCopy, 'function');
});

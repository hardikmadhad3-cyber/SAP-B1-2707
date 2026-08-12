const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

const requireNumericDocEntry = (req, res, next) => {
  if (/^\d+$/.test(String(req.params.docEntry || '').trim())) return next();
  return res.status(404).json({ detail: 'Delivery document was not found.' });
};

// ⚠️ IMPORTANT: Specific routes MUST come before dynamic routes like /:docEntry

// Items modal (must be before /:docEntry)
router.get('/items-modal', deliveryController.getItemsForModal);

// UoM conversion factor (must be before /:docEntry)
router.get('/uom-conversion', deliveryController.getUomConversionFactor);

// Reference data
router.get('/reference-data', deliveryController.getReferenceData);

// Customer details
router.get('/customers/search', deliveryController.getCustomerFilterOptions);
router.get('/customers/:customerCode', deliveryController.getCustomerDetails);

// Sales employees setup
router.post('/sales-employees/setup', deliveryController.saveSalesEmployeesSetup);

// Document series
router.get('/series', deliveryController.getDocumentSeries);
router.get('/series/:series/next-number', deliveryController.getNextNumber);

// State from warehouse
router.get('/warehouse-state/:whsCode', deliveryController.getStateFromWarehouse);
router.get('/warehouse/:whsCode/state', deliveryController.getStateFromWarehouse);

// Sales orders (for copy from)
router.get('/open-sales-orders', deliveryController.getOpenSalesOrders);
router.get('/sales-order/:docEntry/copy', requireNumericDocEntry, deliveryController.getSalesOrderForCopy);
router.get('/sales-orders/open', deliveryController.getOpenSalesOrders);
router.get('/sales-orders/:docEntry/copy', requireNumericDocEntry, deliveryController.getSalesOrderForCopy);
router.get('/open-ar-reserve-invoices', deliveryController.getOpenArReserveInvoices);
router.get('/ar-reserve-invoice/:docEntry/copy', requireNumericDocEntry, deliveryController.getArReserveInvoiceForCopy);

// Delivery for copy to credit memo (must be before /:docEntry)
router.get('/delivery/:docEntry/copy-to-credit-memo', requireNumericDocEntry, deliveryController.getDeliveryForCopyToCreditMemo);

// Batches
router.get('/batches', deliveryController.getBatchesByItem);
router.get('/serials', deliveryController.getAvailableSerials);
router.get('/bins', deliveryController.getAvailableBins);

// Freight charges
router.get('/freight-charges', deliveryController.getFreightCharges);

// Lookup values
router.post('/lookup-values', deliveryController.createLookupValue);

// Validation
router.post('/validate', deliveryController.validateDelivery);

// Delivery list
router.get('/list', deliveryController.getDeliveries);
router.get('/', deliveryController.getDeliveries);

// Get single delivery (must be last GET route)
router.get('/:docEntry', requireNumericDocEntry, deliveryController.getDeliveryByDocEntry);

// Submit new delivery
router.post('/', deliveryController.submitDelivery);

// Update existing delivery
router.patch('/:docEntry', requireNumericDocEntry, deliveryController.updateDelivery);

module.exports = router;

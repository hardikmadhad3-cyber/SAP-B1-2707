const express = require('express');
const qcController = require('../controllers/qcController');

const router = express.Router();

router.get('/forms', qcController.listForms);

router.get('/addons', qcController.listAddons);
router.post('/addons', qcController.createAddon);
router.patch('/addons/:id', qcController.updateAddon);
router.delete('/addons/:id', qcController.deleteAddon);

router.get('/mappings', qcController.listMappings);
router.post('/mappings', qcController.createMapping);
router.patch('/mappings/:id', qcController.updateMapping);
router.delete('/mappings/:id', qcController.deleteMapping);

router.get('/parameters', qcController.listParameters);
router.post('/parameters', qcController.createParameter);
router.patch('/parameters/:id', qcController.updateParameter);
router.delete('/parameters/:id', qcController.deleteParameter);

router.get('/workflows', qcController.listWorkflows);
router.post('/workflows', qcController.createWorkflow);
router.patch('/workflows/:id', qcController.updateWorkflow);
router.delete('/workflows/:id', qcController.deleteWorkflow);

router.get('/transactions', qcController.listTransactions);
router.post('/transactions', qcController.createTransaction);
router.patch('/transactions/:id', qcController.updateTransaction);
router.delete('/transactions/:id', qcController.deleteTransaction);

router.get('/inward/vendors', qcController.listInwardPendingVendors);
router.get('/inward/documents', qcController.listInwardPendingDocuments);
router.get('/inward/items', qcController.listInwardPendingItems);
router.get('/inward/parameters', qcController.listInwardItemParameters);
router.get('/inward/batches', qcController.listInwardItemBatches);
router.post('/inward/save', qcController.saveInwardQcInspection);

router.get('/outward/customers', qcController.listOutwardPendingCustomers);
router.get('/outward/documents', qcController.listOutwardPendingDocuments);
router.get('/outward/items', qcController.listOutwardPendingItems);
router.get('/outward/parameters', qcController.listOutwardItemParameters);
router.get('/outward/batches', qcController.listOutwardItemBatches);
router.post('/outward/save', qcController.saveOutwardQcInspection);

router.get('/item-parameter-mappings', qcController.listItemParameterMappings);
router.post('/item-parameter-mappings', qcController.createItemParameterMapping);
router.post('/item-parameter-mappings/save', qcController.saveItemParameterMappingHeader);
router.patch('/item-parameter-mappings/:id', qcController.updateItemParameterMapping);
router.delete('/item-parameter-mappings/:id', qcController.deleteItemParameterMapping);

router.get('/instruments', qcController.listInstruments);
router.post('/instruments', qcController.createInstrument);
router.patch('/instruments/:id', qcController.updateInstrument);
router.delete('/instruments/:id', qcController.deleteInstrument);

module.exports = router;

const express = require('express');
const adminPanelController = require('../controllers/adminPanelController');
const generalSettingsController = require('../controllers/generalSettingsController');
const { requireAdminPanelAccess } = require('../middleware/adminPanelAccess');
const fieldConfigController = require('../controllers/adminSalesDocumentFieldConfigController');

const router = express.Router();

router.use(requireAdminPanelAccess);

router.get('/entities', adminPanelController.listEntities);
router.get('/form-settings/bootstrap', adminPanelController.getCompanyFormSettingsBootstrap);
router.post('/form-settings/preview', adminPanelController.previewCompanyFormQuery);
router.put('/form-settings', adminPanelController.publishCompanyFormQuery);
router.delete('/form-settings', adminPanelController.unpublishCompanyFormQuery);
router.post('/form-settings/copy-sales-purchase', adminPanelController.copySalesPurchaseLayouts);
router.put('/legacy-form-settings', adminPanelController.saveCompanyFormSettings);
router.get('/field-configuration/bootstrap', fieldConfigController.getBootstrap);
router.put('/field-configuration', fieldConfigController.saveConfiguration);
router.post('/field-configuration/custom-lookups/preview', fieldConfigController.previewCustomLookup);
router.post('/field-configuration/custom-lookups', fieldConfigController.saveCustomLookup);
router.get('/general-settings/bootstrap', generalSettingsController.getAdminBootstrap);
router.get('/general-settings/options', generalSettingsController.getAdminOptions);
router.get('/general-settings', generalSettingsController.getAdminSettings);
router.put('/general-settings', generalSettingsController.saveAdminSettings);
router.get('/:entityKey/bootstrap', adminPanelController.getEntityBootstrap);
router.post('/:entityKey', adminPanelController.createRecord);
router.put('/:entityKey/:recordId', adminPanelController.updateRecord);
router.delete('/:entityKey/:recordId', adminPanelController.deleteRecord);

module.exports = router;

const express = require('express');
const formSettingsController = require('../controllers/formSettingsController');

const router = express.Router();

router.get('/:formKey', formSettingsController.getFormSettings);
router.put('/:formKey', formSettingsController.saveFormSettings);
router.post('/:formKey/query', formSettingsController.runCompanyFormQuery);

module.exports = router;

const formSettingsService = require('../services/formSettingsService');
const companyFormQueryService = require('../services/companyFormQueryService');

const getFormSettings = async (req, res, next) => {
  try {
    const result = await formSettingsService.getFormSettings(req.auth, req.params.formKey);
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const saveFormSettings = async (req, res, next) => {
  try {
    const result = await formSettingsService.saveFormSettings(
      req.auth,
      req.params.formKey,
      req.body?.settings,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const runCompanyFormQuery = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.json(await companyFormQueryService.runPublished(
      req.auth,
      req.params.formKey,
      req.body?.context || {},
    ));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFormSettings,
  saveFormSettings,
  runCompanyFormQuery,
};

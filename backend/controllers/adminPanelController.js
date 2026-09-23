const adminPanelService = require('../services/adminPanelService');
const formSettingsService = require('../services/formSettingsService');
const companyFormQueryService = require('../services/companyFormQueryService');

const listEntities = async (_req, res, next) => {
  try {
    const entities = await adminPanelService.getEntityList();
    res.json({ entities });
  } catch (error) {
    next(error);
  }
};

const getEntityBootstrap = async (req, res, next) => {
  try {
    const payload = await adminPanelService.getEntityBootstrap(req.params.entityKey);
    res.json(payload);
  } catch (error) {
    next(error);
  }
};

const createRecord = async (req, res, next) => {
  try {
    const payload = await adminPanelService.createRecord(req.params.entityKey, req.body || {}, req.auth);
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
};

const updateRecord = async (req, res, next) => {
  try {
    const payload = await adminPanelService.updateRecord(
      req.params.entityKey,
      req.params.recordId,
      req.body || {},
      req.auth,
    );
    res.json(payload);
  } catch (error) {
    next(error);
  }
};

const deleteRecord = async (req, res, next) => {
  try {
    const payload = await adminPanelService.deleteRecord(req.params.entityKey, req.params.recordId);
    res.json(payload);
  } catch (error) {
    next(error);
  }
};

const getCompanyFormSettingsBootstrap = async (req, res, next) => {
  try {
    const payload = await formSettingsService.getCompanyFormSettingsBootstrap(
      req.query?.companyId,
      req.query?.formKey,
    );
    const queryLayout = req.query?.companyId && req.query?.formKey
      ? await companyFormQueryService.getAdminLayout(req.query.companyId, req.query.formKey)
      : null;
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.json({ ...payload, queryLayout });
  } catch (error) {
    next(error);
  }
};

const saveCompanyFormSettings = async (req, res, next) => {
  try {
    const payload = await formSettingsService.saveCompanyFormSettings(req.auth, req.body || {});
    res.json(payload);
  } catch (error) {
    next(error);
  }
};

const previewCompanyFormQuery = async (req, res, next) => {
  try {
    res.json(await companyFormQueryService.preview(req.auth, req.body || {}));
  } catch (error) {
    next(error);
  }
};

const publishCompanyFormQuery = async (req, res, next) => {
  try {
    res.json(await companyFormQueryService.publish(req.auth, req.body || {}));
  } catch (error) {
    next(error);
  }
};

const unpublishCompanyFormQuery = async (req, res, next) => {
  try {
    res.json(await companyFormQueryService.unpublish(req.auth, req.body || {}));
  } catch (error) {
    next(error);
  }
};

const copySalesPurchaseLayouts = async (req, res, next) => {
  try {
    res.json(await companyFormQueryService.copySalesPurchaseLayouts(req.auth, req.body || {}));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listEntities,
  getEntityBootstrap,
  createRecord,
  updateRecord,
  deleteRecord,
  getCompanyFormSettingsBootstrap,
  saveCompanyFormSettings,
  previewCompanyFormQuery,
  publishCompanyFormQuery,
  unpublishCompanyFormQuery,
  copySalesPurchaseLayouts,
};

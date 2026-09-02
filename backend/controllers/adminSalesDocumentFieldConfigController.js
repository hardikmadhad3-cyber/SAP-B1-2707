'use strict';

const authDbService = require('../services/authDbService');
const { setCompanyContextOverride } = require('../services/requestContextService');
const fieldConfigService = require('../modules/salesDocumentSchema/salesDocumentFieldConfigService');
const customLookupService = require('../modules/salesDocumentSchema/salesDocumentCustomLookupService');
const { createHttpError } = require('../modules/newSalesOrder/newSalesOrderContextService');

const resolveScope = async (req) => {
  const companies = await authDbService.getActiveCompanies();
  const requestedId = Number(req.query?.companyId ?? req.body?.companyId);
  const company = Number.isInteger(requestedId) && requestedId > 0
    ? companies.find((item) => Number(item.CompanyId) === requestedId)
    : companies[0];
  if (!company) throw createHttpError(404, 'No active company is available.', 'ADMIN_COMPANY_NOT_FOUND');
  const userId = Number(req.auth?.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw createHttpError(401, 'A valid Admin user is required.', 'INVALID_ADMIN_USER');
  }
  setCompanyContextOverride(company);
  return {
    companies,
    context: {
      userId,
      companyId: Number(company.CompanyId),
      companyDb: String(company.DbName || '').trim(),
      companyName: String(company.CompanyName || '').trim(),
      userCode: String(req.auth?.username || `admin-${userId}`),
      dbDialect: String(company.DbDialect || '').toLowerCase() === 'hana' ? 'hana' : 'sqlserver',
    },
  };
};

const companyOptions = (companies) => companies.map((company) => ({
  companyId: Number(company.CompanyId),
  companyName: String(company.CompanyName || '').trim(),
  dbName: String(company.DbName || '').trim(),
  dialect: String(company.DbDialect || '').toLowerCase() === 'hana' ? 'hana' : 'sqlserver',
}));

const getBootstrap = async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    const configuration = await fieldConfigService.getConfiguration(scope.context, req.query?.documentType);
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.json({ ...configuration, companies: companyOptions(scope.companies) });
  } catch (error) { next(error); }
};

const saveConfiguration = async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    const { companyId: _companyId, ...body } = req.body || {};
    const configuration = await fieldConfigService.saveConfiguration(scope.context, body);
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.json({ ...configuration, companies: companyOptions(scope.companies) });
  } catch (error) { next(error); }
};

const previewCustomLookup = async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    const { companyId: _companyId, ...body } = req.body || {};
    res.json(await customLookupService.preview(scope.context, body));
  } catch (error) { next(error); }
};

const saveCustomLookup = async (req, res, next) => {
  try {
    const scope = await resolveScope(req);
    const { companyId: _companyId, ...body } = req.body || {};
    res.json(await customLookupService.save(scope.context, body));
  } catch (error) { next(error); }
};

module.exports = { getBootstrap, previewCustomLookup, saveConfiguration, saveCustomLookup };

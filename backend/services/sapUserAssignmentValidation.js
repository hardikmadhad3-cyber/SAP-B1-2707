'use strict';
const { runWithRequestContext, setCompanyContextOverride } = require('./requestContextService');
const { createSeriesReader } = require('./documentSeriesDbUtils');
const { isTrue, text } = require('./documentSeriesPolicy');
const invalid = message => Object.assign(new Error(message), { statusCode: 400, code: 'SAP_USER_ASSIGNMENT' });

// Validate the explicitly configured identity in the target company's database.
// A blank override uses the selected company SAP account, as configured by the administrator.
const validateSapUserAssignment = async (assignment, dependencies = {}) => {
  const override = text(assignment.SapUserCode);
  const companyId = Number(assignment.CompanyId);
  if (!Number.isSafeInteger(companyId) || companyId <= 0) throw invalid('Select a valid company for the SAP user assignment.');
  const registry = dependencies.registry || require('./authDbService');
  const company = await registry.queryOne('SELECT * FROM Companies WHERE CompanyId = @companyId', { companyId });
  if (!company) throw invalid('The selected company does not exist.');
  const code = override || text(company.SapUsername);
  if (!code) throw invalid('Configure a SAP username in the selected company or enter a SAP User Code override.');
  await runWithRequestContext({}, async () => {
    setCompanyContextOverride(company);
    const { read } = await (dependencies.reader || createSeriesReader)(dependencies.db || require('./dbService'));
    const rows = await read('OUSR', ['USER_CODE', ['Locked', "'N'"]], { USER_CODE: code });
    const user = rows.find(row => text(row.USER_CODE) === code);
    if (!user) throw invalid('SAP User Code does not exist in the selected company. Use its exact SAP login code.');
    if (isTrue(user.Locked)) throw invalid('The selected SAP user is locked in this company.');
  });
  return override || null;
};
module.exports = { validateSapUserAssignment };

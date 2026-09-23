'use strict';
const { text, isTrue } = require('./documentSeriesPolicy');
const { getActiveCompanyConfig } = require('./companyConfigService');
const fail = (message) => Object.assign(new Error(message), { statusCode: 422, code: 'SAP_SERIES_USER_CONFIGURATION' });

// SAP system permission identifiers are supplied by the installed SDK's
// permission catalogue; never infer permission identifiers from series names.
const loadDocumentSeriesAccess = async ({ read, scope, configLoader = getActiveCompanyConfig, permissionReader } = {}) => {
  const config = await configLoader();
  const userCode = text(config.userMapping?.sapUserCode) || text(config.userMapping?.companySapUserCode);
  if (!userCode) throw fail('Configure the SAP username in this company before loading document series.');
  const users = await read('OUSR', ['USERID', 'USER_CODE', 'SUPERUSER', ['Locked', "'N'"]], { USER_CODE: userCode });
  const user = users.find((row) => text(row.USER_CODE) === userCode);
  if (!user || isTrue(user.Locked)) throw fail('The configured SAP user does not exist or is locked in this company.');
  const superuser = isTrue(user.SUPERUSER);
  if (superuser) return { userId: user.USERID, userCode, superuser, manualAllowed: true, canUseGroup: async () => true };
  const permissions = await (permissionReader || require('./sapSeriesPermissions').readSeriesPermissions)({ read, scope, user });
  return { userId: user.USERID, userCode, superuser, manualAllowed: permissions.manualAllowed,
    canUseGroup: async (group) => permissions.groups.has(Number(group)) };
};
module.exports = { loadDocumentSeriesAccess };

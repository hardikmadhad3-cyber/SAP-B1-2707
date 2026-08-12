'use strict';

const authDbService = require('../../services/authDbService');
const { FORBIDDEN_SCOPE_KEYS } = require('./newSalesOrderConstants');

const createHttpError = (statusCode, message, code, details) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  if (details !== undefined) error.details = details;
  return error;
};

const normalizePositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const normalizeText = (value) => String(value ?? '').trim();

const ownKeysLower = (value) => new Map(
  Object.keys(value && typeof value === 'object' ? value : {})
    .map((key) => [key.toLowerCase(), key]),
);

const assertNoBrowserScopeOverride = (req = {}) => {
  const forbidden = new Set(FORBIDDEN_SCOPE_KEYS.map((key) => key.toLowerCase()));
  const locations = [
    ['query', req.query],
    ['body', req.body],
  ];

  for (const [location, value] of locations) {
    const keys = ownKeysLower(value);
    const found = [...forbidden].find((key) => keys.has(key));
    if (found) {
      const suppliedKey = keys.get(found);
      throw createHttpError(
        400,
        `${suppliedKey} is not accepted. The company is resolved from the authenticated session.`,
        'COMPANY_SCOPE_OVERRIDE_REJECTED',
        { location, key: suppliedKey },
      );
    }
  }

  const forbiddenHeaders = [
    'x-company-id',
    'x-company-db',
    'x-database-name',
    'x-sap-company-db',
    'x-user-code',
  ];
  const header = forbiddenHeaders.find((name) => normalizeText(req.headers?.[name]));
  if (header) {
    throw createHttpError(
      400,
      `${header} is not accepted. The company is resolved from the authenticated session.`,
      'COMPANY_SCOPE_OVERRIDE_REJECTED',
      { location: 'headers', key: header },
    );
  }
};

const createNewSalesOrderContextService = ({ authDb = authDbService } = {}) => {
  if (!authDb || typeof authDb.getAssignedCompanyForUser !== 'function') {
    throw new TypeError('An auth database service with getAssignedCompanyForUser is required.');
  }

  const resolve = async (req = {}) => {
    assertNoBrowserScopeOverride(req);

    const auth = req.auth || {};
    const userId = normalizePositiveInteger(auth.userId);
    const companyId = normalizePositiveInteger(auth.companyId);
    if (auth.tokenType !== 'access' || !userId || !companyId) {
      throw createHttpError(401, 'A valid selected-company session is required.', 'INVALID_COMPANY_SESSION');
    }

    const companyPromise = authDb.getAssignedCompanyForUser(userId, companyId);
    const rolePromise = typeof authDb.getUserRoleForCompany === 'function'
      ? authDb.getUserRoleForCompany(userId, companyId)
      : Promise.resolve({ RoleId: auth.roleId || null });
    const userPromise = normalizeText(auth.username) || typeof authDb.queryOne !== 'function'
      ? Promise.resolve(normalizeText(auth.username) ? { Username: auth.username } : null)
      : authDb.queryOne(`
          SELECT Username
          FROM Users
          WHERE UserId = @userId
        `, { userId });

    const [company, role, user] = await Promise.all([companyPromise, rolePromise, userPromise]);
    if (!company) {
      throw createHttpError(403, 'The selected company is not assigned to this user.', 'COMPANY_NOT_ASSIGNED');
    }
    if (!role) {
      throw createHttpError(403, 'No active role is assigned for the selected company.', 'COMPANY_ROLE_NOT_ASSIGNED');
    }

    const tokenRoleId = normalizePositiveInteger(auth.roleId);
    const currentRoleId = normalizePositiveInteger(role.RoleId ?? role.roleId);
    if (tokenRoleId && currentRoleId && tokenRoleId !== currentRoleId) {
      throw createHttpError(403, 'The selected-company session is stale. Select the company again.', 'STALE_COMPANY_SESSION');
    }

    const companyDb = normalizeText(company.DbName);
    if (!companyDb) {
      throw createHttpError(503, 'The selected company has no database configured.', 'COMPANY_DATABASE_NOT_CONFIGURED');
    }

    const username = normalizeText(user?.Username || auth.username);
    const userCode = normalizeText(company.SapUsername) || username;
    if (!userCode) {
      throw createHttpError(503, 'The selected company has no authenticated SAP user mapping.', 'SAP_USER_NOT_CONFIGURED');
    }

    return Object.freeze({
      userId,
      companyId,
      roleId: currentRoleId || tokenRoleId || null,
      companyDb,
      companyName: normalizeText(company.CompanyName),
      userCode,
      username,
      dbDialect: normalizeText(company.DbDialect).toLowerCase() === 'hana' ? 'hana' : 'sqlserver',
    });
  };

  const middleware = async (req, _res, next) => {
    try {
      req.newSalesOrderContext = await resolve(req);
      next();
    } catch (error) {
      next(error);
    }
  };

  return { middleware, resolve };
};

const defaultService = createNewSalesOrderContextService();

module.exports = defaultService;
module.exports.assertNoBrowserScopeOverride = assertNoBrowserScopeOverride;
module.exports.createHttpError = createHttpError;
module.exports.createNewSalesOrderContextService = createNewSalesOrderContextService;

const authDbService = require('./authDbService');
const companyFormQueryService = require('./companyFormQueryService');

let ensureTablePromise = null;

const ensureTable = async () => {
  if (!ensureTablePromise) {
    ensureTablePromise = authDbService.ensureSchema().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
};

const validateAuth = (auth = {}) => {
  const userId = Number(auth.userId);
  const companyId = Number(auth.companyId);

  if (!Number.isInteger(userId) || !Number.isInteger(companyId)) {
    const error = new Error('A valid user and company session is required.');
    error.statusCode = 401;
    throw error;
  }

  return { userId, companyId };
};

const normalizeFormKey = (formKey) => {
  const value = String(formKey || '').trim();
  if (!value || value.length > 150) {
    const error = new Error('A valid form key is required.');
    error.statusCode = 400;
    throw error;
  }

  return value;
};

const parseSettings = (settingsJson) => {
  try {
    const parsed = JSON.parse(settingsJson || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const validateCompanyId = (companyId) => {
  const value = Number(companyId);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error('A valid company is required.');
    error.statusCode = 400;
    throw error;
  }
  return value;
};

const getFormSettings = async (auth, formKey) => {
  const { userId, companyId } = validateAuth(auth);
  const normalizedFormKey = normalizeFormKey(formKey);

  await ensureTable();

  const [userRow, queryLayout] = await Promise.all([
    authDbService.queryOne(`
    SELECT SettingsJson
    FROM dbo.UserFormSettings
    WHERE UserId = @userId
      AND CompanyId = @companyId
      AND FormKey = @formKey
    `, { userId, companyId, formKey: normalizedFormKey }),
    companyFormQueryService.getPublishedLayout(auth, normalizedFormKey),
  ]);

  return {
    formKey: normalizedFormKey,
    userId,
    companyId,
    source: userRow ? 'user' : 'none',
    settings: userRow ? parseSettings(userRow.SettingsJson) : null,
    queryLayout,
  };
};

const saveFormSettings = async (auth, formKey, settings) => {
  const { userId, companyId } = validateAuth(auth);
  const normalizedFormKey = normalizeFormKey(formKey);

  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    const error = new Error('settings must be an object.');
    error.statusCode = 400;
    throw error;
  }

  const settingsJson = JSON.stringify(settings);
  await ensureTable();

  await authDbService.query(`
    INSERT INTO UserFormSettings (UserId, CompanyId, FormKey, SettingsJson, CreatedAt, UpdatedAt)
    VALUES (@userId, @companyId, @formKey, @settingsJson, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(UserId, CompanyId, FormKey) DO UPDATE SET
      SettingsJson = excluded.SettingsJson,
      UpdatedAt = CURRENT_TIMESTAMP
  `, {
    userId,
    companyId,
    formKey: normalizedFormKey,
    settingsJson,
  });

  return {
    formKey: normalizedFormKey,
    userId,
    companyId,
    source: 'user',
    settings,
  };
};

const getCompanyFormSettingsBootstrap = async (companyId, formKey) => {
  await ensureTable();
  const companies = await authDbService.queryRows(`
    SELECT CompanyId AS companyId, CompanyName AS companyName, DbName AS dbName
    FROM dbo.Companies
    WHERE IsActive = 1
    ORDER BY CompanyName ASC, CompanyId ASC
  `);

  const normalizedCompanyId = companyId === undefined || companyId === null || companyId === ''
    ? null
    : validateCompanyId(companyId);
  const normalizedFormKey = formKey ? normalizeFormKey(formKey) : null;
  if (!normalizedCompanyId || !normalizedFormKey) {
    return { companies, companySettings: null, userSettings: [] };
  }

  // Legacy company/user column layouts remain stored for rollback, but the
  // SQL-driven admin page no longer reads or publishes them.
  return { companies, companySettings: null, userSettings: [] };
};

const saveCompanyFormSettings = async (auth, payload = {}) => {
  const companyId = validateCompanyId(payload.companyId);
  const formKey = normalizeFormKey(payload.formKey);
  const settings = payload.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    const error = new Error('settings must be an object.');
    error.statusCode = 400;
    throw error;
  }

  await ensureTable();
  const company = await authDbService.queryOne(`
    SELECT CompanyId FROM dbo.Companies WHERE CompanyId = @companyId AND IsActive = 1
  `, { companyId });
  if (!company) {
    const error = new Error('The selected company is not active.');
    error.statusCode = 404;
    throw error;
  }

  const createdByUserId = Number.isInteger(Number(auth?.userId)) && Number(auth.userId) > 0
    ? Number(auth.userId)
    : null;
  const settingsJson = JSON.stringify(settings);
  await authDbService.query(`
    INSERT INTO CompanyFormSettings
      (CompanyId, FormKey, SettingsJson, CreatedByUserId, CreatedAt, UpdatedAt)
    VALUES
      (@companyId, @formKey, @settingsJson, @createdByUserId, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(CompanyId, FormKey) DO UPDATE SET
      SettingsJson = excluded.SettingsJson,
      CreatedByUserId = excluded.CreatedByUserId,
      UpdatedAt = CURRENT_TIMESTAMP
  `, { companyId, formKey, settingsJson, createdByUserId });

  return { companyId, formKey, settings, source: 'company' };
};

module.exports = {
  getFormSettings,
  saveFormSettings,
  getCompanyFormSettingsBootstrap,
  saveCompanyFormSettings,
};

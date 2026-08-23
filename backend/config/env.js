const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const readOrCreateJwtSecret = () => {
  const configuredSecret = String(process.env.JWT_SECRET || '').trim();
  if (configuredSecret) return configuredSecret;

  const secretPath = path.resolve(__dirname, '../data/.jwt-secret');

  try {
    const storedSecret = fs.readFileSync(secretPath, 'utf8').trim();
    if (storedSecret) return storedSecret;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  const generatedSecret = crypto.randomBytes(64).toString('hex');

  try {
    fs.writeFileSync(secretPath, `${generatedSecret}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    return generatedSecret;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const storedSecret = fs.readFileSync(secretPath, 'utf8').trim();
    if (!storedSecret) throw new Error('Generated JWT secret file is empty.');
    return storedSecret;
  }
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

module.exports = {
  port: Number(process.env.PORT || 5001),
  jwtSecret: readOrCreateJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  pendingJwtExpiresIn: process.env.PENDING_JWT_EXPIRES_IN || '15m',
  setupAdminUsername: process.env.SETUP_ADMIN_USERNAME || 'manager',
  setupAdminPassword: process.env.SETUP_ADMIN_PASSWORD || '',
  verboseRequestLogs: parseBoolean(process.env.VERBOSE_REQUEST_LOGS, false),
  verboseSapLogs: parseBoolean(process.env.VERBOSE_SAP_LOGS, false),
  newSalesOrderAllowSapWrites: parseBoolean(process.env.NEW_SALES_ORDER_ALLOW_SAP_WRITES, false),
  newSalesOrderUseDummySave: parseBoolean(process.env.NEW_SALES_ORDER_USE_DUMMY_SAVE, false),
  authDbProvider: process.env.AUTH_DB_PROVIDER || 'sqlite',
  authSqlitePath: process.env.AUTH_SQLITE_PATH || './data/henny_auth.sqlite',
  sapBaseUrl: process.env.SAP_BASE_URL || '',
  sapUsername: process.env.SAP_USERNAME || '',
  sapPassword: process.env.SAP_PASSWORD || '',
  sapCompanyDb: process.env.SAP_COMPANY_DB || '',
  sapRejectUnauthorized: parseBoolean(process.env.SAP_REJECT_UNAUTHORIZED, false),
  reportServiceBaseUrl: process.env.SAP_REPORT_SERVICE_BASE_URL || '',
  reportServiceDefaultDocCode: process.env.SAP_REPORT_SERVICE_DEFAULT_DOC_CODE || 'RDR20010',
  reportServiceDefaultSchema: process.env.SAP_REPORT_SERVICE_DEFAULT_SCHEMA || '',
  reportServiceTimeoutMs: Number(process.env.SAP_REPORT_SERVICE_TIMEOUT_MS || 60000),
  reportServiceRejectUnauthorized: parseBoolean(process.env.SAP_REPORT_SERVICE_REJECT_UNAUTHORIZED, false),
  reportServiceUsername: process.env.SAP_REPORT_SERVICE_USERNAME || process.env.SAP_USERNAME || '',
  reportServicePassword: process.env.SAP_REPORT_SERVICE_PASSWORD || process.env.SAP_PASSWORD || '',
  reportServiceCompanyDb: process.env.SAP_REPORT_SERVICE_COMPANY_DB || process.env.SAP_COMPANY_DB || '',
  reportServiceDbInstance: process.env.SAP_REPORT_SERVICE_DB_INSTANCE || '',
  incomingPaymentCashAccount: process.env.INCOMING_PAYMENT_CASH_ACCOUNT || '',
  outgoingPaymentCashAccount: process.env.OUTGOING_PAYMENT_CASH_ACCOUNT || '',
  // Direct SQL Server
  dbDialect:   process.env.DB_DIALECT   || 'sqlserver',
  dbServer:    process.env.DB_SERVER    || '',
  dbInstance:  process.env.DB_INSTANCE  || '',
  dbPort:      Number(process.env.DB_PORT || 0),
  dbName:      process.env.DB_NAME      || '',
  authDbName:  process.env.AUTH_DB_NAME || 'henny_master',
  dbUser:      process.env.DB_USER      || '',
  dbPassword:  process.env.DB_PASSWORD  || '',
  dbEncrypt:   parseBoolean(process.env.DB_ENCRYPT,   false),
  dbTrustCert: parseBoolean(process.env.DB_TRUST_CERT, true),
  // Comma-separated list of extra allowed CORS origins, e.g. http://125.18.226.46:5005
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

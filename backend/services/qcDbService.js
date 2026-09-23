const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { getRequestContext } = require('./requestContextService');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(BACKEND_ROOT, 'db', 'qc-schema.sqlite.sql');

const databases = new Map();
const schemasReady = new Set();

const columnExists = (database, tableName, columnName) => {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.some((row) => String(row.name || '').toLowerCase() === String(columnName || '').toLowerCase());
};

const ensureColumn = (database, tableName, columnName, columnDefinition) => {
  if (!columnExists(database, tableName, columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
};

const runMigrations = (database) => {
  ensureColumn(database, 'qc_item_parameter_mappings', 'item_name', 'TEXT');
  ensureColumn(database, 'qc_transactions', 'source_doc_entry', 'INTEGER');
  ensureColumn(database, 'qc_transactions', 'source_line_num', 'INTEGER');
};

const resolveCompanyId = () => {
  const req = getRequestContext()?.req;
  const companyId = Number(req?.auth?.companyId || req?.whatsappCompanyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new Error('A valid company session is required for Quality Control data.');
  }
  return companyId;
};

const resolveSqlitePath = (companyId = resolveCompanyId()) => {
  const configuredPath = process.env.QC_SQLITE_PATH || './data/qc_addons.sqlite';
  const parsed = path.parse(configuredPath);
  const companyPath = configuredPath.includes('{companyId}')
    ? configuredPath.replaceAll('{companyId}', String(companyId))
    : path.join(parsed.dir, `${parsed.name}.company-${companyId}${parsed.ext || '.sqlite'}`);
  return path.isAbsolute(companyPath)
    ? companyPath
    : path.resolve(BACKEND_ROOT, companyPath);
};

const getDb = () => {
  const dbPath = resolveSqlitePath();
  if (databases.has(dbPath)) return databases.get(dbPath);

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, '');
  }

  const database = new DatabaseSync(dbPath);
  database.exec('PRAGMA foreign_keys = ON;');
  databases.set(dbPath, database);
  return database;
};

const ensureSchema = () => {
  const dbPath = resolveSqlitePath();
  if (schemasReady.has(dbPath)) return;

  const database = getDb();
  database.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  runMigrations(database);
  schemasReady.add(dbPath);
  console.log(`[QC_DB] SQLite connected to ${dbPath}`);
};

const toDbValue = (value) => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
};

const normalizeParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).map(([key, value]) => [key, toDbValue(value)]));

const normalizeRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]),
  );
};

const queryRows = (sqlText, params = {}) => {
  ensureSchema();
  const rows = getDb().prepare(sqlText).all(normalizeParams(params));
  return rows.map(normalizeRow);
};

const queryOne = (sqlText, params = {}) => {
  ensureSchema();
  const row = getDb().prepare(sqlText).get(normalizeParams(params));
  return normalizeRow(row);
};

const execute = (sqlText, params = {}) => {
  ensureSchema();
  const result = getDb().prepare(sqlText).run(normalizeParams(params));
  return {
    changes: Number(result.changes || 0),
    lastInsertRowid: Number(result.lastInsertRowid || 0),
  };
};

module.exports = {
  queryRows,
  queryOne,
  execute,
  resolveSqlitePath,
};

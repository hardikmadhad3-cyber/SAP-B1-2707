'use strict';

const READ_ONLY_START = /^(?:SELECT|WITH)\b/i;
const FORBIDDEN_SQL_TOKEN = /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|MERGE|UPSERT|REPLACE|EXEC(?:UTE)?|CALL|DO|GRANT|REVOKE|COMMIT|ROLLBACK|SAVEPOINT|INTO\s+(?:TABLE\s+)?[A-Za-z_@#\[])\b/i;

const stripSqlLiterals = (sqlText) => {
  let output = '';
  let quote = '';

  for (let index = 0; index < sqlText.length; index += 1) {
    const char = sqlText[index];
    if (quote) {
      if (char === quote) {
        if (sqlText[index + 1] === quote) {
          output += '  ';
          index += 1;
          continue;
        }
        quote = '';
      }
      output += ' ';
      continue;
    }

    if (char === "'") {
      quote = char;
      output += ' ';
      continue;
    }
    output += char;
  }

  return output;
};

const assertStaticReadOnlySql = (sqlText) => {
  const sql = String(sqlText || '').trim();
  if (!sql) throw new TypeError('A static SQL SELECT statement is required.');
  if (sql.includes('--') || sql.includes('/*') || sql.includes('*/')) {
    throw new Error('SQL comments are not allowed in New Sales Order read-only queries.');
  }

  const withoutLiterals = stripSqlLiterals(sql).trim();
  const withoutTrailingTerminator = withoutLiterals.replace(/;\s*$/, '');
  if (!READ_ONLY_START.test(withoutTrailingTerminator)) {
    throw new Error('Only SELECT or WITH queries are allowed for New Sales Order.');
  }
  if (withoutTrailingTerminator.includes(';')) {
    throw new Error('Multiple SQL statements are not allowed for New Sales Order.');
  }
  if (FORBIDDEN_SQL_TOKEN.test(withoutTrailingTerminator)) {
    throw new Error('A write-capable SQL token was blocked for New Sales Order.');
  }

  return sql;
};

const assertCompanyContext = (context = {}) => {
  if (!Number.isInteger(Number(context.userId)) || Number(context.userId) <= 0
      || !Number.isInteger(Number(context.companyId)) || Number(context.companyId) <= 0
      || !String(context.companyDb || '').trim()) {
    const error = new Error('A validated authenticated company context is required for SAP database reads.');
    error.statusCode = 401;
    error.code = 'INVALID_COMPANY_CONTEXT';
    throw error;
  }
};

const normalizeRecordset = (result) => {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.recordset)) return result.recordset;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
};

const createNewSalesOrderReadOnlyDbService = ({ database: suppliedDatabase } = {}) => {
  if (suppliedDatabase && typeof suppliedDatabase.query !== 'function') {
    throw new TypeError('A database query service is required.');
  }

  // Loading @sap/hana-client starts native helper activity in some runtimes.
  // Keep it lazy so metadata/unit tests with injected adapters never initialize
  // a real SAP database driver merely by importing this isolated module.
  let database = suppliedDatabase || null;
  const getDatabase = () => {
    if (!database) database = require('../../services/dbService');
    return database;
  };

  const assertBoundToCompany = async (context) => {
    assertCompanyContext(context);
    const activeDatabase = getDatabase();
    if (typeof activeDatabase.resolveDatabaseName !== 'function') return;

    // No database override is passed here. The shared service must resolve the
    // connection from the request's authenticated AsyncLocalStorage context.
    const resolved = String(await activeDatabase.resolveDatabaseName() || '').trim();
    if (!resolved || resolved.toUpperCase() !== String(context.companyDb).trim().toUpperCase()) {
      const error = new Error('The SAP database connection does not match the authenticated company.');
      error.statusCode = 403;
      error.code = 'COMPANY_DATABASE_MISMATCH';
      throw error;
    }
  };

  const select = async ({ context, queryId, sql, params = {} } = {}) => {
    await assertBoundToCompany(context);
    const statement = assertStaticReadOnlySql(sql);
    if (!String(queryId || '').trim()) {
      throw new TypeError('A static queryId is required for audited New Sales Order reads.');
    }
    const result = await getDatabase().query(statement, params);
    return normalizeRecordset(result);
  };

  const getDialect = async (context) => {
    await assertBoundToCompany(context);
    const activeDatabase = getDatabase();
    if (typeof activeDatabase.getDialect !== 'function') {
      return String(context.dbDialect || '').toLowerCase() === 'hana' ? 'hana' : 'sqlserver';
    }
    const dialect = String(await activeDatabase.getDialect() || '').trim().toLowerCase();
    return dialect === 'hana' ? 'hana' : 'sqlserver';
  };

  return { getDialect, select };
};

const defaultService = createNewSalesOrderReadOnlyDbService();

module.exports = defaultService;
module.exports.assertCompanyContext = assertCompanyContext;
module.exports.assertStaticReadOnlySql = assertStaticReadOnlySql;
module.exports.createNewSalesOrderReadOnlyDbService = createNewSalesOrderReadOnlyDbService;
module.exports.stripSqlLiterals = stripSqlLiterals;

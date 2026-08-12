const { DatabaseSync } = require('node:sqlite');

const normalizeRow = (row) => row && Object.fromEntries(
  Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]),
);

const createSqliteAuthDbTestAdapter = (schemaSql) => {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  if (schemaSql) database.exec(schemaSql);

  const query = async (sqlText, params = {}) => {
    const statement = database.prepare(sqlText);
    if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(sqlText)) {
      return {
        recordset: statement.all(params).map(normalizeRow),
        rowsAffected: [0],
        lastInsertId: 0,
      };
    }
    const result = statement.run(params);
    return {
      recordset: [],
      rowsAffected: [Number(result.changes || 0)],
      lastInsertId: Number(result.lastInsertRowid || 0),
    };
  };

  const queryRows = async (sqlText, params = {}) => (await query(sqlText, params)).recordset;
  const queryOne = async (sqlText, params = {}) => (await queryRows(sqlText, params))[0] || null;
  const transaction = async (callback) => {
    database.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = await callback({ query, queryRows, queryOne });
      database.exec('COMMIT;');
      return result;
    } catch (error) {
      database.exec('ROLLBACK;');
      throw error;
    }
  };

  return {
    authDb: { query, queryRows, queryOne, transaction },
    close: () => database.close(),
    database,
  };
};

module.exports = { createSqliteAuthDbTestAdapter };

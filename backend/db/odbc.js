const dbService = require('../services/dbService');

const query = async (sql, params = {}, options = {}) => dbService.query(sql, params, options);

module.exports = {
  getDialect: dbService.getDialect,
  query,
  resolveDatabaseName: dbService.resolveDatabaseName,
  resolveSqlConnectionConfig: dbService.resolveSqlConnectionConfig,
};

const db = require('./dbService');
const { getOrSetContextValue } = require('./requestContextService');

// Metadata belongs to one connection and one request. A later request must see
// schema changes, and companies sharing a schema name must never share results.
const loadMetadata = async (kind, tableName, options = {}) => {
  const table = String(tableName || '').trim().toUpperCase();
  if (!table) return [];
  const connection = await db.resolveSqlConnectionConfig(options);
  const key = JSON.stringify([
    connection.dialect, connection.server, connection.port, connection.instanceName,
    connection.database, connection.user, kind, table,
  ]);
  const cache = getOrSetContextValue('reportMetadata', () => new Map());
  if (!cache.has(key)) {
    const promise = db.query(
      kind === 'columns'
        ? 'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName ORDER BY ORDINAL_POSITION'
        : 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName',
      { tableName: table }, options,
    ).then((result) => result.recordset || result || []);
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
  }
  return cache.get(key);
};

const getReportTableColumns = async (tableName, options = {}) => {
  const rows = await loadMetadata('columns', tableName, options);
  return new Set(rows.map((row) => String(row.COLUMN_NAME || '').trim().toUpperCase()));
};

const reportTableExists = async (tableName, options = {}) =>
  (await loadMetadata('tables', tableName, options)).length > 0;

module.exports = { getReportTableColumns, reportTableExists };

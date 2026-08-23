'use strict';

const SQL_DIALECTS = Object.freeze({
  HANA: 'hana',
  SQL_SERVER: 'sqlserver',
});

const normalizeSqlDialect = (value) => (
  String(value || '').trim().toLowerCase() === SQL_DIALECTS.HANA
    ? SQL_DIALECTS.HANA
    : SQL_DIALECTS.SQL_SERVER
);

const normalizeIdentifier = (value) => {
  const identifier = String(value || '').trim();
  if (!/^@?[A-Za-z0-9_]{1,127}$/.test(identifier)) {
    throw new TypeError('An approved SAP identifier is required.');
  }
  return identifier;
};

const quoteIdentifier = (value, dialect = SQL_DIALECTS.SQL_SERVER) => {
  const identifier = normalizeIdentifier(value);
  return normalizeSqlDialect(dialect) === SQL_DIALECTS.HANA
    ? `"${identifier}"`
    : `[${identifier}]`;
};

const columnReference = (tableAlias, columnName, dialect) => (
  `${normalizeIdentifier(tableAlias)}.${quoteIdentifier(columnName, dialect)}`
);

const aliased = (expression, alias, dialect) => (
  `${expression} AS ${quoteIdentifier(alias, dialect)}`
);

const paginationClause = (dialect = SQL_DIALECTS.SQL_SERVER, {
  offsetParameter = 'offset',
  limitParameter = 'fetchLimit',
} = {}) => (
  normalizeSqlDialect(dialect) === SQL_DIALECTS.HANA
    ? `LIMIT @${normalizeIdentifier(limitParameter)} OFFSET @${normalizeIdentifier(offsetParameter)}`
    : `OFFSET @${normalizeIdentifier(offsetParameter)} ROWS FETCH NEXT @${normalizeIdentifier(limitParameter)} ROWS ONLY`
);

const selectFirstClause = (dialect = SQL_DIALECTS.SQL_SERVER, limit = 1) => {
  const normalizedLimit = Number(limit);
  if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1) {
    throw new TypeError('A positive static SELECT limit is required.');
  }
  return normalizeSqlDialect(dialect) === SQL_DIALECTS.HANA
    ? { prefix: 'SELECT', suffix: `LIMIT ${normalizedLimit}` }
    : { prefix: `SELECT TOP ${normalizedLimit}`, suffix: '' };
};

module.exports = {
  SQL_DIALECTS,
  aliased,
  columnReference,
  normalizeIdentifier,
  normalizeSqlDialect,
  paginationClause,
  quoteIdentifier,
  selectFirstClause,
};

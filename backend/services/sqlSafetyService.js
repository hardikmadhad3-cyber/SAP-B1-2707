/**
 * SELECT-only SQL validation for Query Manager / Query Generator.
 * No SQL parser dependency exists in this project, so validation uses a
 * strict denylist + structural checks against a comment/string-stripped
 * copy of the text — the original text (minus a stray trailing `;`) is
 * what actually executes, wrapped in a row-cap subquery.
 */

const MAX_ROW_CAP = 5000;
const DEFAULT_ROW_CAP = 500;
const QUERY_TIMEOUT_MS = 15000;

const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE',
  'EXEC', 'EXECUTE', 'MERGE', 'GRANT', 'REVOKE', 'DENY',
  'sp_', 'xp_',
  'BACKUP', 'RESTORE', 'SHUTDOWN', 'OPENROWSET', 'OPENQUERY', 'OPENDATASOURCE',
  'INTO', 'GO',
];

class SqlSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SqlSafetyError';
    this.statusCode = 400;
  }
}

const stripSqlComments = (sqlText) =>
  String(sqlText || '')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

const blankStringLiterals = (sqlText) =>
  sqlText.replace(/'(?:[^']|'')*'/g, (match) => `'${' '.repeat(Math.max(match.length - 2, 0))}'`);

const scanText = (sqlText) => blankStringLiterals(stripSqlComments(sqlText));

const assertSingleStatement = (scanned, originalTrimmed) => {
  const withoutTrailingSemicolon = scanned.replace(/;\s*$/, '');
  if (withoutTrailingSemicolon.includes(';')) {
    throw new SqlSafetyError('Only a single SELECT statement is allowed (no semicolons).');
  }
  return originalTrimmed.replace(/;\s*$/, '');
};

const assertStartsWithSelect = (scanned) => {
  if (!/^\s*(SELECT|WITH)\b/i.test(scanned)) {
    throw new SqlSafetyError('Only SELECT statements (optionally starting with WITH) are allowed.');
  }
};

const assertNoForbiddenKeywords = (scanned) => {
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const pattern = keyword.endsWith('_')
      ? new RegExp(`\\b${keyword}`, 'i')
      : new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(scanned)) {
      throw new SqlSafetyError(`Statement contains a disallowed keyword: ${keyword.replace('_', '')}.`);
    }
  }
};

// Finds the last top-level (paren-depth 0) ORDER BY clause, if any.
const extractTopLevelOrderBy = (scanned, original) => {
  let depth = 0;
  let matchIndex = -1;
  const orderByPattern = /\bORDER\s+BY\b/gi;
  let match;

  while ((match = orderByPattern.exec(scanned)) !== null) {
    const before = scanned.slice(0, match.index);
    depth = (before.match(/\(/g) || []).length - (before.match(/\)/g) || []).length;
    if (depth === 0) {
      matchIndex = match.index;
    }
  }

  if (matchIndex === -1) {
    return { inner: original, orderByClause: null };
  }

  const clauseText = original.slice(matchIndex).trim();
  const innerText = original.slice(0, matchIndex).trim();

  const itemsText = clauseText.replace(/^ORDER\s+BY\s*/i, '');
  const items = itemsText.split(',').map((item) => item.trim());
  // A leading `alias.` qualifier (e.g. "T0.DocDate") is stripped: once the query is
  // wrapped in a derived table, only the unqualified output column name is visible,
  // and SQL Server names an unaliased passthrough column after its source column anyway.
  const qualifierPattern = /^[A-Za-z_][A-Za-z0-9_]*\.(?=[[\]"A-Za-z_])/;
  const validItemPattern = /^(\[[^\]]+\]|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*|\d+)(\s+(ASC|DESC))?$/i;

  const rewrittenItems = items.map((item) => {
    const unqualified = item.replace(qualifierPattern, '');
    if (!validItemPattern.test(unqualified)) {
      throw new SqlSafetyError(
        'ORDER BY must reference plain output column names or ordinals (e.g. "ItemName DESC" or "T0.ItemName DESC"), not computed expressions.',
      );
    }
    return unqualified;
  });

  return { inner: innerText, orderByClause: `ORDER BY ${rewrittenItems.join(', ')}` };
};

const clampRowLimit = (requestedLimit, fallbackLimit) => {
  const candidate = Number(requestedLimit) || Number(fallbackLimit) || DEFAULT_ROW_CAP;
  return Math.max(1, Math.min(Math.trunc(candidate), MAX_ROW_CAP));
};

/**
 * Validates untrusted SQL text and returns a safe-to-execute statement.
 * @param {string} sqlText - the raw, user-authored SQL.
 * @param {{ rowLimit?: number }} [opts]
 * @returns {{ safeSql: string, appliedLimit: number }}
 */
const validateAndPrepare = (sqlText, opts = {}) => {
  const original = String(sqlText || '').trim();
  if (!original) {
    throw new SqlSafetyError('SQL text is required.');
  }

  const scanned = scanText(original);
  assertStartsWithSelect(scanned);
  assertNoForbiddenKeywords(scanned);
  const trimmedOriginal = assertSingleStatement(scanned, original);

  const { inner, orderByClause } = extractTopLevelOrderBy(scanText(trimmedOriginal), trimmedOriginal);

  const appliedLimit = clampRowLimit(opts.rowLimit, DEFAULT_ROW_CAP);
  const orderBySuffix = orderByClause ? ` ${orderByClause}` : '';
  const dialect = String(opts.dialect || 'sqlserver').trim().toLowerCase();
  const safeSql = dialect === 'hana'
    ? `SELECT * FROM (\n${inner}\n) AS QM_SAFE_WRAP${orderBySuffix} LIMIT @safetyRowCap`
    : `SELECT TOP (@safetyRowCap) * FROM (\n${inner}\n) AS QM_SAFE_WRAP${orderBySuffix}`;

  return { safeSql, appliedLimit };
};

module.exports = {
  validateAndPrepare,
  DEFAULT_ROW_CAP,
  MAX_ROW_CAP,
  QUERY_TIMEOUT_MS,
  SqlSafetyError,
};

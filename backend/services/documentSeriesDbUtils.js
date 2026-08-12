const metadataCache = new Map();

const safeRows = async (promise) => {
  try {
    const result = await promise;
    return result.recordset || [];
  } catch (_error) {
    return [];
  }
};

const normalizeDateText = (value) => {
  if (!value) return new Date().toISOString().split('T')[0];
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0];
};

const normalizeText = (value) => String(value || '').trim().toUpperCase();

const getTableFieldMetadata = async (db, tableName) => {
  const normalizedTableName = String(tableName || '').trim();
  if (!normalizedTableName) return {};

  let databaseName = 'default';
  try {
    databaseName = String(await db.resolveDatabaseName() || 'default');
  } catch (_error) {
    databaseName = 'default';
  }

  const cacheKey = `${databaseName}:${normalizedTableName}`;
  if (!metadataCache.has(cacheKey)) {
    metadataCache.set(cacheKey, safeRows(db.query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
      ORDER BY ORDINAL_POSITION
    `, { tableName: normalizedTableName })).then((rows) => rows.reduce((acc, row) => {
      const columnName = String(row.COLUMN_NAME || '').trim();
      if (columnName) acc[columnName] = String(row.DATA_TYPE || '').trim().toLowerCase();
      return acc;
    }, {})));
  }

  return metadataCache.get(cacheKey);
};

const getTableFieldName = (metadata, columnName) => {
  const normalizedColumnName = String(columnName || '').trim().toLowerCase();
  if (!metadata || !normalizedColumnName) return '';
  return Object.keys(metadata).find((fieldName) => fieldName.toLowerCase() === normalizedColumnName) || '';
};

const hasTableField = (metadata, columnName) => Boolean(getTableFieldName(metadata, columnName));

const sqlAlias = (alias) => `[${String(alias || '').replace(/]/g, ']]')}]`;

const sqlColumnRef = (metadata, tableAlias, columnName) => {
  const physicalName = getTableFieldName(metadata, columnName);
  return physicalName ? `${tableAlias}.${sqlAlias(physicalName)}` : '';
};

const optionalColumn = (metadata, tableAlias, columnName, alias, fallback = 'NULL') => (
  sqlColumnRef(metadata, tableAlias, columnName)
    ? `${sqlColumnRef(metadata, tableAlias, columnName)} AS ${sqlAlias(alias)}`
    : `${fallback} AS ${sqlAlias(alias)}`
);

const buildYearTokens = (dateText) => {
  const date = new Date(`${normalizeDateText(dateText)}T00:00:00`);
  const year = Number.isFinite(date.getFullYear()) ? date.getFullYear() : new Date().getFullYear();
  const candidates = [year - 1, year, year + 1];
  const tokens = [];

  candidates.forEach((candidateYear) => {
    const nextYear = candidateYear + 1;
    tokens.push(
      String(candidateYear),
      `${candidateYear}-${nextYear}`,
      `${candidateYear}/${nextYear}`,
      `${String(candidateYear).slice(-2)}-${String(nextYear).slice(-2)}`,
      `${String(candidateYear).slice(-2)}/${String(nextYear).slice(-2)}`,
      `FY${candidateYear}`,
      `FY${String(candidateYear).slice(-2)}`,
    );
  });

  return tokens.map(normalizeText);
};

const getSeriesDateScore = (row, targetDate) => {
  const tokens = buildYearTokens(targetDate);
  const haystack = normalizeText([
    row.SeriesName,
    row.DisplayName,
    row.RawSeriesName,
    row.BeginStr,
    row.EndStr,
    row.Indicator,
    row.FinancialYear,
  ].filter(Boolean).join(' '));

  let score = 0;
  tokens.forEach((token) => {
    if (token && haystack.includes(token)) score += 1;
  });
  return score;
};

const dedupeSeriesRows = (rows = []) => {
  const bySeries = new Map();
  rows.forEach((row) => {
    const key = String(row?.Series ?? '').trim();
    if (!key || bySeries.has(key)) return;
    bySeries.set(key, row);
  });
  return Array.from(bySeries.values());
};

const keepSapVisibleSeries = (rows = [], targetDate) => {
  const candidates = dedupeSeriesRows(rows);
  if (candidates.length <= 1) return candidates;

  const currentPeriodRows = candidates.filter((row) => row.IsCurrentPeriod || row.isCurrentPeriod);
  if (currentPeriodRows.length) return currentPeriodRows;

  const defaultRows = candidates.filter((row) => row.IsDefault || row.isDefault);
  if (defaultRows.length) {
    const defaultIndicators = new Set(defaultRows
      .map((row) => normalizeText(row.Indicator || row.FinancialYear))
      .filter(Boolean));

    if (defaultIndicators.size) {
      return candidates.filter((row) => defaultIndicators.has(
        normalizeText(row.Indicator || row.FinancialYear),
      ));
    }

    return defaultRows;
  }

  const ranked = [...candidates].sort((left, right) => {
    const leftScore = getSeriesDateScore(left, targetDate);
    const rightScore = getSeriesDateScore(right, targetDate);
    if (rightScore !== leftScore) return rightScore - leftScore;
    return String(left.SeriesName || left.Series || '').localeCompare(String(right.SeriesName || right.Series || ''));
  });

  if (!ranked.length) return [];

  const bestScore = getSeriesDateScore(ranked[0], targetDate);
  if (bestScore <= 0) return [ranked[0]];

  const bestIndicator = normalizeText(ranked[0].Indicator || ranked[0].FinancialYear);
  return bestIndicator
    ? candidates.filter((row) => normalizeText(row.Indicator || row.FinancialYear) === bestIndicator)
    : ranked.filter((row) => getSeriesDateScore(row, targetDate) === bestScore);
};

const getMarketingDocumentSeries = async ({
  db,
  objectCode,
  targetDate = null,
  branch = '',
  docSubType = '',
  collapseToSapVisible = true,
} = {}) => {
  const normalizedObjectCode = String(objectCode || '').trim();
  if (!db || !normalizedObjectCode) return [];

  const effectiveTargetDate = normalizeDateText(targetDate);
  const [seriesMetadata, numberingMetadata] = await Promise.all([
    getTableFieldMetadata(db, 'NNM1'),
    getTableFieldMetadata(db, 'ONNM'),
  ]);

  const defaultSeriesColumn = hasTableField(numberingMetadata, 'DfltSeries')
    ? getTableFieldName(numberingMetadata, 'DfltSeries')
    : hasTableField(numberingMetadata, 'DfltSerie')
      ? getTableFieldName(numberingMetadata, 'DfltSerie')
      : '';
  const defaultSeriesJoin = defaultSeriesColumn
    ? `LEFT JOIN ONNM T2 ON T2.ObjectCode = T0.ObjectCode AND T2.${sqlAlias(defaultSeriesColumn)} = T0.Series`
    : '';
  const defaultSeriesSelect = defaultSeriesColumn
    ? `CASE WHEN T2.${sqlAlias(defaultSeriesColumn)} IS NOT NULL THEN 1 ELSE 0 END`
    : '0';

  const beginStrRef = sqlColumnRef(seriesMetadata, 'T0', 'BeginStr');
  const lastNumRef = sqlColumnRef(seriesMetadata, 'T0', 'LastNum');
  const seriesLabelSelect = beginStrRef
    ? `COALESCE(NULLIF(LTRIM(RTRIM(CAST(${beginStrRef} AS NVARCHAR(50)))), ''), T0.SeriesName) AS SeriesLabel`
    : 'T0.SeriesName AS SeriesLabel';
  const numberRangeFilter = lastNumRef
    ? `AND (${lastNumRef} IS NULL OR ${lastNumRef} = 0 OR T0.NextNumber <= ${lastNumRef})`
    : '';

  const branchId = Number(branch);
  const hasBranchFilter = hasTableField(seriesMetadata, 'BPLId')
    && Number.isFinite(branchId)
    && String(branch || '').trim() !== '';
  const branchSeriesFilter = hasBranchFilter ? 'AND T0.BPLId = @branchId' : '';
  const globalSeriesFilter = hasBranchFilter ? 'AND (T0.BPLId IS NULL OR T0.BPLId IN (-1, 0))' : '';

  const requestedDocSubType = String(docSubType || '').trim();
  const docSubTypeRef = sqlColumnRef(seriesMetadata, 'T0', 'DocSubType');
  const docSubTypeFilter = requestedDocSubType && docSubTypeRef
    ? `AND COALESCE(NULLIF(${docSubTypeRef}, ''), '--') = @docSubType`
    : '';
  const docSubTypeSelect = optionalColumn(seriesMetadata, 'T0', 'DocSubType', 'DocSubType', "''");

  const runSeriesQuery = (withPeriod, branchFilterSql, params) => safeRows(db.query(`
    SELECT
      T0.Series,
      T0.SeriesName,
      ${seriesLabelSelect},
      ${optionalColumn(seriesMetadata, 'T0', 'BeginStr', 'BeginStr', "''")},
      ${optionalColumn(seriesMetadata, 'T0', 'EndStr', 'EndStr', "''")},
      T0.Indicator,
      T0.NextNumber,
      ${docSubTypeSelect},
      ${optionalColumn(seriesMetadata, 'T0', 'BPLId', 'BPLId', 'NULL')},
      ${defaultSeriesSelect} AS IsDefault,
      ${withPeriod ? '1' : '0'} AS IsCurrentPeriod,
      ${withPeriod ? 'T1.Name' : 'NULL'} AS FinancialYear,
      ${withPeriod ? 'T1.F_RefDate' : 'NULL'} AS FromDate,
      ${withPeriod ? 'T1.T_RefDate' : 'NULL'} AS ToDate
    FROM NNM1 T0
    ${withPeriod ? 'INNER JOIN OFPR T1 ON T0.Indicator = T1.Indicator' : ''}
    ${defaultSeriesJoin}
    WHERE T0.ObjectCode = @objectCode
      AND T0.Locked = 'N'
      ${branchFilterSql}
      ${numberRangeFilter}
      ${docSubTypeFilter}
      ${withPeriod ? 'AND CAST(@targetDate AS date) BETWEEN T1.F_RefDate AND T1.T_RefDate' : ''}
    ORDER BY IsDefault DESC, T0.SeriesName, T0.Series
  `, params));

  const datedParams = {
    objectCode: normalizedObjectCode,
    targetDate: effectiveTargetDate,
    ...(hasBranchFilter ? { branchId } : {}),
    ...(docSubTypeFilter ? { docSubType: requestedDocSubType } : {}),
  };
  const fallbackParams = {
    objectCode: normalizedObjectCode,
    ...(hasBranchFilter ? { branchId } : {}),
    ...(docSubTypeFilter ? { docSubType: requestedDocSubType } : {}),
  };

  let result = hasBranchFilter
    ? await runSeriesQuery(true, branchSeriesFilter, datedParams)
    : await runSeriesQuery(true, '', datedParams);

  if (!result.length && hasBranchFilter) {
    result = await runSeriesQuery(true, globalSeriesFilter, datedParams);
  }

  if (!result.length) {
    result = hasBranchFilter
      ? await runSeriesQuery(false, branchSeriesFilter, fallbackParams)
      : await runSeriesQuery(false, '', fallbackParams);
  }

  if (!result.length && hasBranchFilter) {
    result = await runSeriesQuery(false, globalSeriesFilter, fallbackParams);
  }

  const mapped = dedupeSeriesRows(result.map((row) => {
    const isDefault = Number(row.IsDefault || 0) === 1;
    const isCurrentPeriod = Number(row.IsCurrentPeriod || 0) === 1;
    const displayName = row.SeriesName || row.SeriesLabel || row.BeginStr || row.Series;

    return {
      Series: row.Series,
      SeriesName: displayName,
      DisplayName: displayName,
      RawSeriesName: row.SeriesName || '',
      BeginStr: row.BeginStr || '',
      EndStr: row.EndStr || '',
      NextNumber: row.NextNumber,
      Indicator: row.Indicator || '',
      DocSubType: row.DocSubType || '',
      BPLId: row.BPLId != null ? String(row.BPLId) : '',
      IsDefault: isDefault,
      isDefault,
      IsCurrentPeriod: isCurrentPeriod,
      isCurrentPeriod,
      FinancialYear: row.FinancialYear || '',
      FromDate: row.FromDate || null,
      ToDate: row.ToDate || null,
    };
  }));

  return collapseToSapVisible ? keepSapVisibleSeries(mapped, effectiveTargetDate) : mapped;
};

module.exports = {
  getMarketingDocumentSeries,
  selectSapEligibleSeries: keepSapVisibleSeries,
  _private: {
    keepSapVisibleSeries,
    dedupeSeriesRows,
    getSeriesDateScore,
  },
};

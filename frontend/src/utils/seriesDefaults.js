const normalizeText = (value) => String(value || '').trim().toUpperCase();

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(date.getTime())) return date;

  const match = String(value).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const buildYearTokens = (year) => {
  const tokens = [];

  [year - 1, year, year + 1].forEach((candidateYear) => {
    const currentYear = String(candidateYear);
    const nextYear = String(candidateYear + 1);
    const shortYear = currentYear.slice(-2);
    const nextShortYear = nextYear.slice(-2);

    tokens.push(
      currentYear,
      `${currentYear}-${nextYear}`,
      `${currentYear}/${nextYear}`,
      `${shortYear}-${nextShortYear}`,
      `${shortYear}/${nextShortYear}`,
      `FY${currentYear}`,
      `FY${shortYear}`,
    );
  });

  return tokens.map(normalizeText);
};

const getSeriesCode = (series) => (
  series?.Series ?? series?.series ?? series?.code ?? series?.SeriesCode ?? series?.seriesCode ?? ''
);

const isManualSeriesValue = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '-1' || normalized === 'manual';
};

const getSeriesLabelText = (series) => [
  series?.Indicator,
  series?.indicator,
  series?.Name,
  series?.name,
  series?.SeriesName,
  series?.seriesName,
  series?.DisplayName,
  series?.displayName,
  series?.RawSeriesName,
  series?.rawSeriesName,
  series?.BeginStr,
  series?.beginStr,
  series?.EndStr,
  series?.endStr,
  series?.FinancialYear,
  series?.financialYear,
].filter(Boolean).join(' ');

const getSeriesScore = (series, yearTokens) => {
  const indicator = normalizeText(series?.Indicator ?? series?.indicator);
  const seriesName = normalizeText(series?.SeriesName ?? series?.seriesName ?? series?.Name ?? series?.name);
  const combined = normalizeText(getSeriesLabelText(series)) || `${indicator} ${seriesName}`.trim();
  let score = 0;

  for (const token of yearTokens) {
    if (!token) continue;
    if (indicator === token) score = Math.max(score, 500);
    if (seriesName === token) score = Math.max(score, 450);
    if (indicator.includes(token)) score = Math.max(score, 400);
    if (seriesName.includes(token)) score = Math.max(score, 350);
    if (combined.includes(token)) score = Math.max(score, 300);
  }

  return score;
};

const isSeriesMarkedDefault = (series) => {
  const raw = series?.IsDefault ?? series?.isDefault ?? series?.DefaultSeries ?? series?.DfltSeries;
  if (typeof raw === 'number') return raw === 1;
  const normalized = normalizeText(raw);
  return normalized === '1' || normalized === 'Y' || normalized === 'YES' || normalized === 'TRUE';
};

export const getDefaultSeriesForCurrentYear = (seriesList = [], now = new Date()) => {
  if (!Array.isArray(seriesList) || !seriesList.length) return null;

  const targetDate = parseDate(now) || new Date();
  const yearTokens = buildYearTokens(targetDate.getFullYear());
  const dateMatchedSeries = seriesList.filter((series) => {
    const fromDate = parseDate(series?.FromDate);
    const toDate = parseDate(series?.ToDate);
    return fromDate && toDate && targetDate >= startOfDay(fromDate) && targetDate <= endOfDay(toDate);
  });
  const defaultSeries = (dateMatchedSeries.length ? dateMatchedSeries : seriesList)
    .find(isSeriesMarkedDefault);
  if (defaultSeries) return defaultSeries;

  let bestMatch = null;
  let bestScore = -1;

  for (const series of seriesList) {
    const fromDate = parseDate(series?.FromDate);
    const toDate = parseDate(series?.ToDate);
    const isDateMatch = fromDate && toDate && targetDate >= startOfDay(fromDate) && targetDate <= endOfDay(toDate);
    const score = getSeriesScore(series, yearTokens) + (isDateMatch ? 1000 : 0);
    if (score > bestScore) {
      bestMatch = series;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestMatch : seriesList[0];
};

export const normalizeDocumentSeriesList = (seriesList = []) => {
  if (!Array.isArray(seriesList)) return [];

  const bySeries = new Map();
  seriesList.forEach((series) => {
    const key = String(getSeriesCode(series)).trim();
    if (!key || bySeries.has(key)) return;
    bySeries.set(key, series);
  });

  return Array.from(bySeries.values());
};

export const getSapVisibleDocumentSeries = (
  seriesList = [],
  { selectedSeries = '', postingDate = new Date() } = {},
) => {
  const normalizedSeries = normalizeDocumentSeriesList(seriesList);
  if (!normalizedSeries.length) return [];

  const targetDate = parseDate(postingDate) || new Date();
  const dateMatchedSeries = normalizedSeries.filter((series) => {
    const fromDate = parseDate(series?.FromDate);
    const toDate = parseDate(series?.ToDate);
    return fromDate && toDate && targetDate >= startOfDay(fromDate) && targetDate <= endOfDay(toDate);
  });
  const currentPeriodSeries = normalizedSeries.filter((series) => (
    series?.IsCurrentPeriod || series?.isCurrentPeriod
  ));
  const preferredSeries = getDefaultSeriesForCurrentYear(normalizedSeries, targetDate);
  const preferredIndicator = normalizeText(
    preferredSeries?.Indicator
      ?? preferredSeries?.indicator
      ?? preferredSeries?.FinancialYear
      ?? preferredSeries?.financialYear,
  );
  const indicatorMatchedSeries = preferredIndicator
    ? normalizedSeries.filter((series) => normalizeText(
      series?.Indicator
        ?? series?.indicator
        ?? series?.FinancialYear
        ?? series?.financialYear,
    ) === preferredIndicator)
    : [];
  const eligibleSeries = dateMatchedSeries.length
    ? dateMatchedSeries
    : currentPeriodSeries.length
      ? currentPeriodSeries
      : indicatorMatchedSeries.length
        ? indicatorMatchedSeries
        : preferredSeries
          ? [preferredSeries]
          : [normalizedSeries[0]];

  const selectedSeriesValue = String(selectedSeries || '').trim();
  if (selectedSeriesValue && !isManualSeriesValue(selectedSeriesValue)) {
    const selectedOption = normalizedSeries.find((series) => (
      String(getSeriesCode(series)).trim() === selectedSeriesValue
    ));
    if (selectedOption && !eligibleSeries.some((series) => (
      String(getSeriesCode(series)).trim() === selectedSeriesValue
    ))) return [selectedOption];
  }

  return eligibleSeries;
};

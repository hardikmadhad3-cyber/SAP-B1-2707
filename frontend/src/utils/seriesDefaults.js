const normalizeText = (value) => String(value ?? '').trim();
const isTrue = (value) => ['1', 'Y', 'YES', 'TRUE'].includes(normalizeText(value).toUpperCase());
const getSeriesCode = (row) => row?.Series ?? row?.series ?? row?.code ?? '';
export const normalizeDocumentSeriesList = (rows = []) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const key = normalizeText(getSeriesCode(row));
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
};
export const getSapVisibleDocumentSeries = (rows = [], { includeHistorical = false } = {}) => normalizeDocumentSeriesList(rows)
  .filter((row) => includeHistorical || (!row.IsLoadedDocumentSeries && row.Eligible !== false && !isTrue(row.Locked)));
const dateKey = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  }
  const match = normalizeText(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
};
// The server owns SAP eligibility. Legacy callers can additionally supply a
// posting date to honor explicit fiscal-period bounds, without guessing names.
export const getDefaultSeriesForCurrentYear = (rows = [], postingDate) => {
  const postingKey = dateKey(postingDate);
  const eligible = getSapVisibleDocumentSeries(rows).filter((row) => {
    if (Number(getSeriesCode(row)) <= 0) return false;
    const from = dateKey(row.FromDate);
    const to = dateKey(row.ToDate);
    return !postingKey || ((!from || postingKey >= from) && (!to || postingKey <= to));
  });
  const defaults = eligible.filter((row) => isTrue(row.IsDefault ?? row.isDefault));
  return defaults.length === 1 ? defaults[0] : [...eligible].sort((a,b) => Number(getSeriesCode(a)) - Number(getSeriesCode(b)))[0] || null;
};
export const pickDocumentSeries = (rows = [], selectedSeries = '') => {
  const eligible = getSapVisibleDocumentSeries(rows);
  return eligible.find((row) => normalizeText(getSeriesCode(row)) === normalizeText(selectedSeries))
    || getDefaultSeriesForCurrentYear(eligible);
};
export const canUseManualSeries = (data = {}) => data.manualAllowed === true || (data.series || []).some((row) => row.ManualAllowed === true);

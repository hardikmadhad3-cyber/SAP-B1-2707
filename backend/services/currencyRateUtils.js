const normalizeRateSettings = (source = {}) => {
  const directRateFlag = String(
    source.DirectRate ?? source.directRate ?? source.postingMethod ?? 'Y',
  ).trim().toUpperCase();
  const decimalPlaces = Number(source.RateDec ?? source.decimalPlaces);

  return {
    postingMethod: ['N', 'INDIRECT'].includes(directRateFlag) ? 'indirect' : 'direct',
    decimalPlaces: Number.isInteger(decimalPlaces) && decimalPlaces >= 0
      ? decimalPlaces
      : 6,
  };
};

const reciprocal = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? 1 / numeric : '';
};

const toSapStoredRate = (displayRate, settings = {}) => {
  const normalized = normalizeRateSettings(settings);
  const numeric = Number(displayRate);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return normalized.postingMethod === 'indirect' ? reciprocal(numeric) : numeric;
};

const fromSapStoredRate = (storedRate, settings = {}) => {
  const normalized = normalizeRateSettings(settings);
  const numeric = Number(storedRate);
  if (!Number.isFinite(numeric) || numeric <= 0) return '';
  return normalized.postingMethod === 'indirect' ? reciprocal(numeric) : numeric;
};

module.exports = {
  fromSapStoredRate,
  normalizeRateSettings,
  toSapStoredRate,
};

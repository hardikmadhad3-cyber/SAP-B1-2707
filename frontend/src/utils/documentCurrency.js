export const DEFAULT_LOCAL_CURRENCY = 'INR';

export const normalizeCurrencyMode = (value, fallback = 'BP') => {
  const normalized = String(value || '').trim().toUpperCase();
  if (['BP', 'LOCAL', 'SYSTEM', 'CUSTOM'].includes(normalized)) return normalized;
  if (normalized === 'BPCURRENCY' || normalized === 'BP_CURRENCY') return 'BP';
  if (normalized === 'LOCALCURRENCY' || normalized === 'LOCAL_CURRENCY') return 'LOCAL';
  if (normalized === 'SYSTEMCURRENCY' || normalized === 'SYSTEM_CURRENCY') return 'SYSTEM';
  return fallback;
};

export const findBusinessPartnerCurrency = (businessPartners = [], cardCode = '') => {
  const partner = businessPartners.find((bp) => String(bp.CardCode || '') === String(cardCode || ''));
  const currency = String(partner?.Currency || '').trim();
  return currency && currency !== '##' ? currency : '';
};

export const resolveDocumentCurrency = ({
  mode = 'BP',
  cardCode = '',
  businessPartners = [],
  currentCurrency = '',
  localCurrency = DEFAULT_LOCAL_CURRENCY,
  systemCurrency = '',
  fallbackLocalCurrency = DEFAULT_LOCAL_CURRENCY,
} = {}) => {
  const normalizedMode = normalizeCurrencyMode(mode);
  const resolvedLocalCurrency = String(localCurrency || '').trim()
    || String(fallbackLocalCurrency || '').trim();
  const resolvedSystemCurrency = String(systemCurrency || '').trim() || resolvedLocalCurrency;
  const bpCurrency = findBusinessPartnerCurrency(businessPartners, cardCode);
  const existingCurrency = String(currentCurrency || '').trim();

  if (normalizedMode === 'LOCAL') return resolvedLocalCurrency;
  if (normalizedMode === 'SYSTEM') return resolvedSystemCurrency;
  if (normalizedMode === 'CUSTOM') return existingCurrency || bpCurrency || resolvedLocalCurrency;
  return bpCurrency || resolvedLocalCurrency;
};

export const inferDocumentCurrencyMode = ({
  currency = '',
  cardCode = '',
  businessPartners = [],
  localCurrency = DEFAULT_LOCAL_CURRENCY,
  systemCurrency = '',
  fallbackLocalCurrency = DEFAULT_LOCAL_CURRENCY,
} = {}) => {
  const normalizedCurrency = String(currency || '').trim();
  const resolvedLocalCurrency = String(localCurrency || '').trim()
    || String(fallbackLocalCurrency || '').trim();
  const resolvedSystemCurrency = String(systemCurrency || '').trim() || resolvedLocalCurrency;
  const bpCurrency = findBusinessPartnerCurrency(businessPartners, cardCode);

  if (!normalizedCurrency) return 'BP';
  if (bpCurrency && normalizedCurrency === bpCurrency) return 'BP';
  if (normalizedCurrency === resolvedLocalCurrency) return 'LOCAL';
  if (normalizedCurrency === resolvedSystemCurrency) return 'SYSTEM';
  return 'CUSTOM';
};

const salesOrderDb = require('./salesOrderDbService');
const masterDataDb = require('./masterDataDbService');
const { applyDocumentCurrency } = require('./documentCurrencyUtils');
const {
  fromSapStoredRate,
  normalizeRateSettings,
  toSapStoredRate,
} = require('./currencyRateUtils');

const text = (value) => String(value ?? '').trim();

const getBusinessPartners = (referenceData = {}) => [
  ...(Array.isArray(referenceData.vendors) ? referenceData.vendors : []),
  ...(Array.isArray(referenceData.customers) ? referenceData.customers : []),
];

const normalizeCurrencyRows = (rows = [], localCurrency = '', systemCurrency = '') => {
  const byCode = new Map();
  const add = (currency) => {
    const code = text(currency?.CurrCode ?? currency?.Code ?? currency?.code ?? currency);
    if (!code || code === '##') return;
    const name = text(currency?.CurrName ?? currency?.Name ?? currency?.name ?? code) || code;
    const existing = byCode.get(code.toUpperCase());
    if (!existing || existing.CurrName === existing.CurrCode) {
      byCode.set(code.toUpperCase(), { CurrCode: code, CurrName: name });
    }
  };

  (Array.isArray(rows) ? rows : []).forEach(add);
  add({ CurrCode: localCurrency, CurrName: localCurrency });
  add({ CurrCode: systemCurrency, CurrName: systemCurrency });
  return [...byCode.values()].sort((left, right) => left.CurrCode.localeCompare(right.CurrCode));
};

const loadCompanyCurrencyContext = async () => {
  const [companyRows, currencyRows] = await Promise.all([
    salesOrderDb.getCompanyCurrencyInfo ? salesOrderDb.getCompanyCurrencyInfo() : Promise.resolve([]),
    salesOrderDb.getCurrencies ? salesOrderDb.getCurrencies() : Promise.resolve([]),
  ]);
  const company = companyRows?.[0] || {};
  const localCurrency = text(company.MainCurncy);
  const systemCurrency = text(company.SysCurrncy) || localCurrency;
  const rateSettings = normalizeRateSettings(company);
  const currencies = normalizeCurrencyRows(currencyRows, localCurrency, systemCurrency);

  return {
    localCurrency,
    systemCurrency,
    currencies,
    rateSettings,
  };
};

const loadDocumentCurrencyReferenceData = async (header = {}, baseData = {}) => {
  const cardCode = text(header.vendor || header.customerCode || header.CardCode);
  const basePartners = getBusinessPartners(baseData);
  const existingPartner = basePartners.find((partner) => text(partner.CardCode) === cardCode);
  const [context, exactPartner] = await Promise.all([
    loadCompanyCurrencyContext(),
    cardCode && !existingPartner && typeof masterDataDb.getBP === 'function'
      ? masterDataDb.getBP(cardCode)
      : Promise.resolve(null),
  ]);
  const data = mergeCurrencyReferenceData(baseData, context);
  if (exactPartner && !getBusinessPartners(data).some((partner) => text(partner.CardCode) === cardCode)) {
    const collection = Array.isArray(data.vendors) ? data.vendors : [];
    data.vendors = [...collection, exactPartner];
  }
  return data;
};

const mergeCurrencyReferenceData = (data = {}, context = {}) => ({
  ...data,
  local_currency: context.localCurrency || '',
  system_currency: context.systemCurrency || context.localCurrency || '',
  company_currency: context.localCurrency || '',
  currencies: context.currencies || [],
  company_currencies: {
    ...(data.company_currencies || {}),
    localCurrency: context.localCurrency || '',
    systemCurrency: context.systemCurrency || context.localCurrency || '',
    currencies: context.currencies || [],
  },
  exchange_rate_settings: {
    postingMethod: context.rateSettings?.postingMethod || 'direct',
    decimalPlaces: context.rateSettings?.decimalPlaces ?? 6,
  },
});

const findBusinessPartner = (header = {}, referenceData = {}) => {
  const cardCode = text(header.vendor || header.customerCode || header.CardCode);
  return getBusinessPartners(referenceData).find(
    (partner) => text(partner.CardCode) === cardCode,
  );
};

const resolveDocumentCurrency = (header = {}, referenceData = {}) => {
  const explicit = text(header.currency || header.DocCurrency || header.DocCur);
  if (explicit) return explicit;

  const partnerCurrency = text(findBusinessPartner(header, referenceData)?.Currency);
  if (partnerCurrency && partnerCurrency !== '##') return partnerCurrency;
  return text(referenceData.local_currency || referenceData.company_currency)
    || text(referenceData.company_currencies?.localCurrency);
};

const validateDocumentCurrency = (header = {}, referenceData = {}) => {
  const currency = resolveDocumentCurrency(header, referenceData);
  if (!currency) {
    const error = new Error('Document currency could not be resolved for the selected SAP company.');
    error.statusCode = 400;
    throw error;
  }

  const partner = findBusinessPartner(header, referenceData);
  const partnerCurrency = text(partner?.Currency);
  if (partnerCurrency && partnerCurrency !== '##' && currency.toUpperCase() !== partnerCurrency.toUpperCase()) {
    const error = new Error(
      `Business partner ${text(partner.CardCode)} uses ${partnerCurrency}; the document currency must match.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const includedPartnerCurrencies = new Set(
    (partner?.BPCurrencies || partner?.Currencies || partner?.currencies || [])
      .filter((row) => text(row?.Include ?? row?.INCLUDE ?? 'Y').toUpperCase() !== 'N')
      .map((row) => text(row?.CurrencyCode ?? row?.CurrCode ?? row?.code ?? row))
      .filter(Boolean)
      .map((code) => code.toUpperCase()),
  );
  if (partnerCurrency === '##' && includedPartnerCurrencies.size
    && !includedPartnerCurrencies.has(currency.toUpperCase())) {
    const error = new Error(
      `Currency ${currency} is not included for business partner ${text(partner.CardCode)}.`,
    );
    error.statusCode = 400;
    throw error;
  }

  const allowedCurrencies = new Map(
    (referenceData.currencies || referenceData.company_currencies?.currencies || [])
      .map((row) => text(row.CurrCode || row.Code || row.code))
      .filter(Boolean)
      .map((code) => [code.toUpperCase(), code]),
  );
  if (allowedCurrencies.size && !allowedCurrencies.has(currency.toUpperCase())) {
    const error = new Error(`Currency ${currency} is not defined in the selected SAP company.`);
    error.statusCode = 400;
    throw error;
  }

  return allowedCurrencies.get(currency.toUpperCase()) || partnerCurrency || currency;
};

const applySapDocumentCurrency = (target, header = {}, referenceData = {}) => {
  const currency = validateDocumentCurrency(header, referenceData);
  const localCurrency = text(referenceData.local_currency || referenceData.company_currency)
    || text(referenceData.company_currencies?.localCurrency);
  const rawRate = header.exchangeRate ?? header.DocRate ?? header.docRate;
  const displayRate = rawRate === '' || rawRate === null || rawRate === undefined
    ? ''
    : Number(rawRate);

  if (currency !== localCurrency && (!Number.isFinite(displayRate) || displayRate <= 0)) {
    const error = new Error(`A positive exchange rate is required for ${currency}.`);
    error.statusCode = 400;
    throw error;
  }

  return applyDocumentCurrency(target, {
    currency,
    exchangeRate: currency === localCurrency
      ? ''
      : toSapStoredRate(displayRate, referenceData.exchange_rate_settings || {}),
  });
};

const fromStoredDocumentRate = (value, referenceData = {}) => {
  if (value === '' || value === null || value === undefined) return '';
  return fromSapStoredRate(value, referenceData.exchange_rate_settings || {});
};

const normalizeCopyDocumentRate = (result, referenceData = {}) => {
  const candidates = [
    result,
    result?.header,
    result?.sales_order?.header,
    result?.sales_quotation?.header,
    result?.delivery?.header,
    result?.ar_invoice?.header,
    result?.ar_credit_memo?.header,
    result?.service_ar_invoice?.header,
    result?.service_ar_credit_memo?.header,
    result?.service_ap_invoice?.header,
    result?.service_ap_credit_memo?.header,
    result?.purchase_request?.header,
    result?.purchase_quotation?.header,
    result?.purchase_order?.header,
    result?.grpo?.header,
    result?.ap_invoice?.header,
    result?.ap_credit_memo?.header,
    result?.purchaseQuotation?.header,
    result?.purchaseOrder?.header,
    result?.goodsReceiptPO?.header,
    result?.apInvoice?.header,
    result?.apCreditMemo?.header,
  ].filter((candidate, index, all) => (
    candidate && typeof candidate === 'object' && all.indexOf(candidate) === index
  ));

  candidates.forEach((candidate) => {
    const storedRate = candidate.exchangeRate ?? candidate.DocRate ?? candidate.docRate;
    if (storedRate === '' || storedRate === null || storedRate === undefined) return;
    const displayRate = fromStoredDocumentRate(storedRate, referenceData);
    candidate.exchangeRate = displayRate === '' ? '' : String(displayRate);
  });
  return result;
};

const normalizeCopyDocumentRateForCompany = async (result) => normalizeCopyDocumentRate(
  result,
  mergeCurrencyReferenceData({}, await loadCompanyCurrencyContext()),
);

module.exports = {
  applySapDocumentCurrency,
  fromStoredDocumentRate,
  loadCompanyCurrencyContext,
  loadDocumentCurrencyReferenceData,
  mergeCurrencyReferenceData,
  normalizeCopyDocumentRate,
  normalizeCopyDocumentRateForCompany,
  normalizeCurrencyRows,
  resolveDocumentCurrency,
  validateDocumentCurrency,
};

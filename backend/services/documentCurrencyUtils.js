const normalizeDocumentCurrency = (value) => {
  const currency = String(value || '').trim();
  return currency ? currency : '';
};

const applyDocumentCurrency = (target, header = {}) => {
  const currency = normalizeDocumentCurrency(header.currency || header.DocCurrency || header.DocCur);
  if (currency) {
    target.DocCurrency = currency;
  }
  const rawRate = header.exchangeRate ?? header.DocRate ?? header.docRate;
  if (rawRate !== undefined && rawRate !== null && String(rawRate).trim() !== '') {
    const rate = Number(rawRate);
    if (Number.isFinite(rate) && rate > 0) {
      target.DocRate = rate;
    }
  }
  return target;
};

module.exports = {
  normalizeDocumentCurrency,
  applyDocumentCurrency,
};

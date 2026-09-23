'use strict';

// GST reverse-charge percentages belong to tax authorities, not code names.
const aggregatePayableTaxRates = (components = []) => {
  const rates = new Map();
  for (const component of components) {
    const code = String(component.Code || '').trim();
    if (!code) continue;
    const rate = Number(component.EfctivRate) || 0;
    const reverse = Math.max(0, Math.min(100, Number(component.ReverseChargePercent) || 0));
    rates.set(code, (rates.get(code) || 0) + rate * (1 - reverse / 100));
  }
  return rates;
};

const getDocumentTaxCodeSql = (fieldMetadata = {}, tableAlias = 'T0') => {
  const fields = Object.keys(fieldMetadata);
  const columns = ['TaxCode', 'VatGroup'].map(name => fields.find(field => field.toLowerCase() === name.toLowerCase())).filter(Boolean);
  if (!columns.length) return "''";
  const expressions = columns.map(column => "NULLIF(LTRIM(RTRIM(" + tableAlias + ".[" + column.replace(/]/g, ']]') + "])), '')");
  return `COALESCE(${expressions.join(', ')}, '')`;
};

module.exports = { aggregatePayableTaxRates, getDocumentTaxCodeSql };

const test = require('node:test');
const assert = require('node:assert/strict');
const { aggregatePayableTaxRates, getDocumentTaxCodeSql } = require('../services/documentTaxUtils');

test('tax-authority reverse charge, not tax-code names, determines payable GST', () => {
  const rates = aggregatePayableTaxRates([
    { Code: '5-RGST', EfctivRate: 2.5, ReverseChargePercent: 100 },
    { Code: '5-RGST', EfctivRate: 2.5, ReverseChargePercent: 100 },
    { Code: 'Ordinary', EfctivRate: 2.5, ReverseChargePercent: 50 },
    { Code: 'Ordinary', EfctivRate: 2.5 },
    { Code: 'Misleading-RGST', EfctivRate: 5 },
  ]);
  assert.equal(rates.get('5-RGST'), 0);
  assert.equal(rates.get('Ordinary'), 3.75);
  assert.equal(rates.get('Misleading-RGST'), 5);
});

test('Find and Copy To share physical tax columns and fall back from empty TaxCode to VatGroup', () => {
  assert.equal(getDocumentTaxCodeSql({ TaxCode: 'nvarchar', VatGroup: 'nvarchar' }),
    "COALESCE(NULLIF(LTRIM(RTRIM(T0.[TaxCode])), ''), NULLIF(LTRIM(RTRIM(T0.[VatGroup])), ''), '')");
  assert.match(getDocumentTaxCodeSql({ TAXCODE: 'nvarchar' }), /T0\.\[TAXCODE\]/);
  assert.equal(getDocumentTaxCodeSql({}), "''");
});

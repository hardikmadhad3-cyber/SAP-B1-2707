const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applySapDocumentCurrency,
  fromStoredDocumentRate,
  normalizeCopyDocumentRate,
  resolveDocumentCurrency,
  validateDocumentCurrency,
} = require('../services/salesDocumentCurrencyService');

const referenceData = {
  local_currency: 'INR',
  system_currency: 'USD',
  currencies: [
    { CurrCode: 'INR', CurrName: 'Indian Rupee' },
    { CurrCode: 'USD', CurrName: 'US Dollar' },
    { CurrCode: 'EUR', CurrName: 'Euro' },
  ],
  customers: [
    { CardCode: 'C-INR', Currency: 'INR' },
    { CardCode: 'C-ALL', Currency: '##' },
  ],
  vendors: [
    { CardCode: 'V-EUR', Currency: 'EUR' },
    {
      CardCode: 'V-ALL',
      Currency: '##',
      BPCurrencies: [{ CurrencyCode: 'USD', Include: 'Y' }],
    },
  ],
  exchange_rate_settings: { postingMethod: 'direct', decimalPlaces: 4 },
};

test('uses the fixed SAP business-partner currency when the document omits it', () => {
  assert.equal(resolveDocumentCurrency({ vendor: 'C-INR' }, referenceData), 'INR');
  assert.deepEqual(applySapDocumentCurrency({}, { vendor: 'C-INR' }, referenceData), {
    DocCurrency: 'INR',
  });
});

test('rejects a currency that conflicts with a fixed-currency business partner', () => {
  assert.throws(
    () => validateDocumentCurrency({ vendor: 'C-INR', currency: 'USD' }, referenceData),
    /must match/,
  );
});

test('applies the same fixed and included-currency rules to SAP suppliers', () => {
  assert.deepEqual(
    applySapDocumentCurrency({}, {
      vendor: 'V-EUR',
      currency: 'EUR',
      exchangeRate: 92.5,
    }, referenceData),
    { DocCurrency: 'EUR', DocRate: 92.5 },
  );
  assert.throws(
    () => validateDocumentCurrency({ vendor: 'V-EUR', currency: 'USD' }, referenceData),
    /must match/,
  );
  assert.equal(
    validateDocumentCurrency({ vendor: 'V-ALL', currency: 'USD' }, referenceData),
    'USD',
  );
  assert.throws(
    () => validateDocumentCurrency({ vendor: 'V-ALL', currency: 'EUR' }, referenceData),
    /not included/,
  );
});

test('allows a selected-company currency for an all-currencies business partner', () => {
  assert.deepEqual(
    applySapDocumentCurrency({}, {
      vendor: 'C-ALL',
      currency: 'USD',
      exchangeRate: 86.125,
    }, referenceData),
    { DocCurrency: 'USD', DocRate: 86.125 },
  );
});

test('honors SAP included currencies when an all-currencies BP provides them', () => {
  const restrictedData = {
    ...referenceData,
    customers: [{
      CardCode: 'C-ALL',
      Currency: '##',
      BPCurrencies: [
        { CurrencyCode: 'USD', Include: 'Y' },
        { CurrencyCode: 'EUR', Include: 'N' },
      ],
    }],
  };
  assert.equal(
    validateDocumentCurrency({ vendor: 'C-ALL', currency: 'usd' }, restrictedData),
    'USD',
  );
  assert.throws(
    () => validateDocumentCurrency({ vendor: 'C-ALL', currency: 'EUR' }, restrictedData),
    /not included for business partner/,
  );
});

test('rejects currencies that are not defined in the authenticated SAP company', () => {
  assert.throws(
    () => validateDocumentCurrency({ vendor: 'C-ALL', currency: 'GBP' }, referenceData),
    /not defined in the selected SAP company/,
  );
});

test('requires a positive rate for a foreign-currency document', () => {
  assert.throws(
    () => applySapDocumentCurrency({}, { vendor: 'C-ALL', currency: 'USD' }, referenceData),
    /positive exchange rate/,
  );
});

test('converts indirect UI rates to and from SAP DocRate storage', () => {
  const indirectData = {
    ...referenceData,
    exchange_rate_settings: { postingMethod: 'indirect', decimalPlaces: 6 },
  };
  assert.deepEqual(
    applySapDocumentCurrency({}, {
      vendor: 'C-ALL',
      currency: 'EUR',
      exchangeRate: 0.01,
    }, indirectData),
    { DocCurrency: 'EUR', DocRate: 100 },
  );
  assert.equal(fromStoredDocumentRate(100, indirectData), 0.01);
});

test('normalizes a copy-from header without changing SAP line rates', () => {
  const result = {
    DocRate: 100,
    DocumentLines: [{ Rate: 7 }],
  };
  normalizeCopyDocumentRate(result, {
    exchange_rate_settings: { postingMethod: 'indirect', decimalPlaces: 6 },
  });
  assert.equal(result.exchangeRate, '0.01');
  assert.equal(result.DocRate, 100);
  assert.equal(result.DocumentLines[0].Rate, 7);
});

test('normalizes stored rates inside service document read envelopes', () => {
  const result = {
    service_ap_invoice: {
      header: { currency: 'EUR', exchangeRate: '100' },
      lines: [{ unitPrice: '25' }],
    },
  };
  normalizeCopyDocumentRate(result, {
    exchange_rate_settings: { postingMethod: 'indirect', decimalPlaces: 6 },
  });
  assert.equal(result.service_ap_invoice.header.exchangeRate, '0.01');
  assert.equal(result.service_ap_invoice.lines[0].unitPrice, '25');
});

test('normalizes stored rates inside purchase document read envelopes', () => {
  const result = {
    purchase_order: {
      header: { currency: 'EUR', exchangeRate: '100' },
      lines: [{ unitPrice: '25' }],
    },
    ap_invoice: {
      header: { currency: 'EUR', exchangeRate: '100' },
    },
  };
  normalizeCopyDocumentRate(result, {
    exchange_rate_settings: { postingMethod: 'indirect', decimalPlaces: 6 },
  });
  assert.equal(result.purchase_order.header.exchangeRate, '0.01');
  assert.equal(result.ap_invoice.header.exchangeRate, '0.01');
  assert.equal(result.purchase_order.lines[0].unitPrice, '25');
});

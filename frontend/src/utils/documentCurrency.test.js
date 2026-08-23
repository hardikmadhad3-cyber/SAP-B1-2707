import {
  findBusinessPartnerCurrency,
  inferDocumentCurrencyMode,
  normalizeCurrencyMode,
  resolveDocumentCurrency,
} from './documentCurrency';

const businessPartners = [
  { CardCode: 'C-USD', Currency: 'USD' },
  { CardCode: 'C-ALL', Currency: '##' },
];

test('resolves BP currency from the selected business partner', () => {
  expect(resolveDocumentCurrency({
    mode: 'BP',
    cardCode: 'C-USD',
    businessPartners,
    localCurrency: 'INR',
  })).toBe('USD');
});

test('falls back to local currency when BP currency is all currencies marker', () => {
  expect(findBusinessPartnerCurrency(businessPartners, 'C-ALL')).toBe('');
  expect(resolveDocumentCurrency({
    mode: 'BP',
    cardCode: 'C-ALL',
    businessPartners,
    localCurrency: 'INR',
  })).toBe('INR');
});

test('can require selected-company currency data instead of assuming INR', () => {
  expect(resolveDocumentCurrency({
    mode: 'BP',
    cardCode: 'C-ALL',
    businessPartners,
    localCurrency: '',
    fallbackLocalCurrency: '',
  })).toBe('');

  expect(inferDocumentCurrencyMode({
    currency: '',
    localCurrency: '',
    fallbackLocalCurrency: '',
  })).toBe('BP');
});

test('resolves local and system currency modes', () => {
  expect(resolveDocumentCurrency({ mode: 'LOCAL', localCurrency: 'INR', systemCurrency: 'USD' })).toBe('INR');
  expect(resolveDocumentCurrency({ mode: 'SYSTEM', localCurrency: 'INR', systemCurrency: 'USD' })).toBe('USD');
});

test('normalizes legacy lowercase purchase order currency modes', () => {
  expect(normalizeCurrencyMode('bp')).toBe('BP');
  expect(normalizeCurrencyMode('local')).toBe('LOCAL');
  expect(normalizeCurrencyMode('system')).toBe('SYSTEM');
});

test('infers loaded document currency mode', () => {
  expect(inferDocumentCurrencyMode({
    currency: 'USD',
    cardCode: 'C-USD',
    businessPartners,
    localCurrency: 'INR',
    systemCurrency: 'EUR',
  })).toBe('BP');
  expect(inferDocumentCurrencyMode({ currency: 'EUR', localCurrency: 'INR', systemCurrency: 'EUR' })).toBe('SYSTEM');
  expect(inferDocumentCurrencyMode({ currency: 'GBP', localCurrency: 'INR', systemCurrency: 'EUR' })).toBe('CUSTOM');
});

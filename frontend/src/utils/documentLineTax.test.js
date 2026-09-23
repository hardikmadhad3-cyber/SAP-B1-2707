import { getDocumentLinePayableTax } from './documentLineTax';

test('delivery and invoice calculate normal and full/partial reverse-charge payable tax', () => {
  expect(getDocumentLinePayableTax({ taxableAmount: 100, tax: { Rate: 5 } })).toBe(5);
  expect(getDocumentLinePayableTax({ taxableAmount: 100, tax: { Rate: 5, PayableRate: 0 } })).toBe(0);
  expect(getDocumentLinePayableTax({ taxableAmount: 100, tax: { Rate: 5, PayableRate: 2.5 } })).toBe(2.5);
});

test('Find preserves saved gross tax and valid zero, applying configured reverse charge', () => {
  expect(getDocumentLinePayableTax({ savedTaxAmount: '19527.48', tax: { Rate: 5, PayableRate: 0 } })).toBe(0);
  expect(getDocumentLinePayableTax({ savedTaxAmount: '19', tax: { Rate: 5 } })).toBe(19);
  expect(getDocumentLinePayableTax({ savedTaxAmount: '0', taxableAmount: 100, tax: { Rate: 5 } })).toBe(0);
  expect(getDocumentLinePayableTax({ savedTaxAmount: '', taxableAmount: 100, tax: { Rate: 5 } })).toBe(5);
});

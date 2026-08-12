import { getCalculatedForRate, getLineTotalsForDisplay } from './lineTotals';

test('calculates FOR Rate like SAP B1 price after discount including tax', () => {
  expect(
    getCalculatedForRate(
      { unitPrice: '223.00', stdDiscount: '2.00', taxCode: '12-GST' },
      [{ Code: '12-GST', Rate: 12 }]
    )
  ).toBe('244.76480');
});

test('calculates Total (Doc) from SAP line total and tax code when gross total is not returned', () => {
  expect(
    getLineTotalsForDisplay(
      { LineTotal: '100.00', taxCode: 'GST18' },
      [{ Code: 'GST18', Rate: 18 }]
    )
  ).toEqual({ beforeTax: '100.00', total: '118.00' });
});

test('prefers explicit SAP gross total for Total (Doc)', () => {
  expect(
    getLineTotalsForDisplay(
      { LineTotal: '100.00', GTotal: '117.50', taxCode: 'GST18' },
      [{ Code: 'GST18', Rate: 18 }]
    )
  ).toEqual({ beforeTax: '100.00', total: '117.50' });
});

test('prefers explicit total before tax over generic total', () => {
  expect(
    getLineTotalsForDisplay({ totalBeforeTax: '95.00', total: '100.00' }, [])
  ).toEqual({ beforeTax: '95.00', total: '100.00' });
});

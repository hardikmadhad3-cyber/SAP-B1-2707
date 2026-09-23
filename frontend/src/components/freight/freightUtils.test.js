import { normalizeFreightChargeRow, summarizeFreightRows } from './freightUtils';

test('master freight defaults do not silently add document charges', () => {
 expect(normalizeFreightChargeRow({ ExpnsCode: 1, DefaultAmount: 100 }).netAmount).toBe(0);
 expect(summarizeFreightRows([{ ExpnsCode: 1, LineTotal: 0, DefaultAmount: 100 }]).totalNet).toBe(0);
});
test('copied document freight retains its amount, expense code, and tax calculation', () => {
 const summary = summarizeFreightRows([{ ExpenseCode: 2, LineTotal: 100, TaxCode: 'GST' }], [{ Code: 'GST', Rate: 12 }]);
 expect(summary.rows[0]).toMatchObject({ expnsCode: 2, taxCode: 'GST', netAmount: 100 });
 expect(summary).toMatchObject({ totalNet: 100, totalTax: 12, totalGross: 112 });
});

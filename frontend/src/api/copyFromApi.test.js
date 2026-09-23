jest.mock('./client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import { normaliseDocumentHeader, normaliseDocumentLine, unwrapCopyFromDocument } from './copyFromApi';

describe('normaliseDocumentLine', () => {
  test('preserves a TDS-liable GRPO line when copying to A/P Invoice', () => {
    const line = normaliseDocumentLine(
      { ItemCode: 'ITEM-1', WTLiable: 'Y' },
      0,
      42,
      20,
    );

    expect(line.wtaxLiable).toBe('Y');
  });

  test('normalizes Service Layer TDS yes values', () => {
    const line = normaliseDocumentLine(
      { ItemCode: 'ITEM-1', wTaxLiable: 'tYES' },
      0,
      42,
      20,
    );

    expect(line.wtaxLiable).toBe('Y');
  });

  test('preserves Delivery UoM values that A/R Invoice needs to post the base line', () => {
    const line = normaliseDocumentLine(
      { ItemCode: 'ITEM-1', UoMEntry: 7, NumPerMsr: 12, InvntryUom: 'EA' },
      0,
      42,
      15,
    );

    expect(line).toMatchObject({ uomEntry: '7', uomFactor: '12', inventoryUOM: 'EA' });
  });

  test('preserves batch metadata needed before saving a copied document', () => {
    const line = normaliseDocumentLine(
      {
        ItemCode: 'BATCH-1',
        BatchManaged: 'Y',
        SerialManaged: 'N',
        BatchNumbers: [{ BatchNumber: 'LOT-1', Quantity: 3 }],
      },
      0,
      42,
      17,
    );

    expect(line.batchManaged).toBe(true);
    expect(line.serialManaged).toBe(false);
    expect(line.batches).toEqual([{ BatchNumber: 'LOT-1', Quantity: 3 }]);
  });

  test('marks a copied tax code as source-controlled so GST defaults do not replace it', () => {
    const line = normaliseDocumentLine(
      { ItemCode: 'ITEM-TAX', TaxCode: 'GST-SOURCE' },
      0,
      55,
      22,
    );

    expect(line.taxCode).toBe('GST-SOURCE');
    expect(line.taxCodeManuallyOverridden).toBe(true);
  });
});

describe('normaliseDocumentHeader', () => {
  test('preserves Delivery logistics and accounting header fields', () => {
    const header = normaliseDocumentHeader({
      CardCode: 'C001',
      WhsCode: '01',
      ShipToCode: 'SHIP',
      PayToCode: 'BILL',
      shipToAddressComponents: { city: 'Mumbai' },
      billToAddressComponents: { city: 'Pune' },
      TrnspCode: 2,
      SlpCode: 4,
      OwnerCode: 6,
      Remarks: 'Handle with care',
    });

    expect(header).toMatchObject({
      vendor: 'C001', warehouse: '01', shipToCode: 'SHIP', billToCode: 'BILL',
      shippingType: '2', salesEmployee: '4', ownerCode: '6', remarks: 'Handle with care',
      shipToAddressComponents: { city: 'Mumbai' }, billToAddressComponents: { city: 'Pune' },
    });
  });
});


describe('copied freight source', () => {
 test('an order with no freight replaces earlier quotation freight', () => {
  const data = { freightCharges: [{ ExpnsCode: 1, LineTotal: 100 }], sales_order: { DocEntry: 42, freightCharges: [], lines: [] } };
  expect(unwrapCopyFromDocument(data).freightCharges).toEqual([]);
 });
 test('freight from a wrapped document is retained with its company tax code', () => {
  const rows = [{ ExpnsCode: 1, LineTotal: 100, TaxCode: '12-GST' }];
  expect(unwrapCopyFromDocument({ freightCharges: rows, sales_order: { DocEntry: 42, lines: [] } }).freightCharges).toEqual(rows);
 });
 test('a document without freight provides empty rows to clear previous state', () => {
  expect(unwrapCopyFromDocument({ DocEntry: 42, DocumentLines: [] }).freightCharges).toEqual([]);
 });
 test('Service Layer freight rows are supported', () => {
  const rows = [{ ExpenseCode: 1, LineTotal: 100, TaxCode: 'GST' }];
  expect(unwrapCopyFromDocument({ DocumentAdditionalExpenses: rows }).freightCharges).toEqual(rows);
 });
});

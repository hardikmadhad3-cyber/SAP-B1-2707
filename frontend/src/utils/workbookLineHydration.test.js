import { hydrateWorkbookDocumentLine } from './workbookLineHydration';

const createLine = () => ({
  itemNo: '',
  uomName: '',
  inStock: '',
  qtyInWhse: '',
  cogsDistRule: '',
  lineDeliveryDate: '',
  udf: {},
});

test('hydrates SAP matrix display fields from database and Service Layer aliases', () => {
  const line = hydrateWorkbookDocumentLine({
    line: {
      ItemCode: 'A100',
      UnitMsr: 'BOX',
      OnHand: 125.5,
      WhsQty: 18,
      COGSCostingCode: 'EXPORT',
      ShipDate: '2026-08-30',
      GTotal: 250.75,
    },
    createLine,
    normalizeUdfState: (_fields, values) => values,
  });

  expect(line).toMatchObject({
    itemNo: 'A100',
    uomName: 'BOX',
    inStock: '125.5',
    qtyInWhse: '18',
    cogsDistRule: 'EXPORT',
    lineDeliveryDate: '2026-08-30',
    grossTotal: '250.75',
  });
});

test('keeps UoM and COGS fields separate from their SAP internal and distribution values', () => {
  const line = hydrateWorkbookDocumentLine({
    line: {
      ItemCode: 'A200',
      UomEntry: 17,
      DistributionRule: 'SALES-DIM',
    },
    createLine,
    normalizeUdfState: (_fields, values) => values,
  });

  expect(line.uomCode).toBe('');
  expect(line.cogsDistRule).toBe('');
});

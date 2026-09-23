import {
  applyUomCodeSelection,
  canEditUomCode,
  canEditUomName,
  getItemDefaultUom,
} from './documentUom';

const groups = [
  {
    AbsEntry: 4,
    Name: 'Length',
    uoms: [
      { uomEntry: 7, uomCode: 'MTR', uomName: 'Meter', factor: 1 },
      { uomEntry: 8, uomCode: 'CM', uomName: 'Centimeter', factor: 100 },
    ],
  },
  {
    AbsEntry: -1,
    Name: 'Manual',
    isManual: true,
    uoms: [{ uomEntry: -1, uomCode: 'Manual', uomName: 'Manual', factor: 1 }],
  },
];

test('uses the item sales UoM entry as the grouped default', () => {
  expect(getItemDefaultUom({ UgpEntry: 4, SUoMEntry: 8 }, groups, 'sales')).toMatchObject({
    uomGroupEntry: 4,
    uomEntry: 8,
    uomCode: 'CM',
    uomName: 'Centimeter',
    uomFactor: 100,
  });
});

test('changing a grouped code updates entry, name, and factor together', () => {
  expect(applyUomCodeSelection({}, 'CM', groups[0].uoms)).toMatchObject({
    uomEntry: 8,
    uomCode: 'CM',
    uomName: 'Centimeter',
    uomFactor: 100,
  });
});

test('Manual keeps the item unit text as the editable name', () => {
  const item = { UgpEntry: -1, PurchaseUnit: 'MTR' };
  const line = getItemDefaultUom(item, groups, 'purchase');
  expect(line).toMatchObject({ uomEntry: -1, uomCode: 'Manual', uomName: 'MTR' });
  expect(canEditUomCode(line, item, groups)).toBe(false);
  expect(canEditUomName(line, item, groups)).toBe(true);
});

test('copied document lines lock both UoM fields', () => {
  const item = { UgpEntry: 4 };
  const line = { baseType: 22, baseEntry: 10, baseLine: 0, uomGroupEntry: 4 };
  expect(canEditUomCode(line, item, groups)).toBe(false);
  expect(canEditUomName(line, item, groups)).toBe(false);
});

import {
  getOrderedVisibleMatrixColumns,
  isRequiredVisibleMatrixField,
  mergeContentSettingsFields,
  reorderFormSettingPreferences,
} from './formSettingsColumns';

test('orders visible Content columns and keeps required identity fields visible', () => {
  const columns = [
    { key: 'itemNo', label: 'Item No.' },
    { key: 'description', label: 'Description' },
    { key: 'quantity', label: 'Quantity' },
    { key: '__actions', label: '' },
  ];
  const resolved = getOrderedVisibleMatrixColumns(columns, {
    matrixColumns: {
      itemNo: { visible: false, order: 3 },
      description: { visible: false, order: 1 },
      quantity: { visible: true, order: 2 },
    },
  });

  expect(resolved.map((column) => column.key)).toEqual(['quantity', 'itemNo']);
  expect(isRequiredVisibleMatrixField(columns[0], { visible: false })).toBe(true);
});

test('does not confuse SAP data-entry required fields with visibility locks', () => {
  const uomName = { key: 'uomName', label: 'UoM Name', required: true };

  expect(isRequiredVisibleMatrixField(uomName, { required: true })).toBe(false);
  expect(getOrderedVisibleMatrixColumns([uomName], {
    matrixColumns: { uomName: { visible: false, required: true, order: 1 } },
  })).toEqual([]);
  expect(getOrderedVisibleMatrixColumns([{ ...uomName, visible: false }], {
    matrixColumns: { uomName: { visible: true, required: true, order: 1 } },
  }).map((field) => field.key)).toEqual(['uomName']);
  expect(getOrderedVisibleMatrixColumns([{ ...uomName, visible: false }], {
    matrixColumns: { uomName: { visible: true, required: true, order: 1 } },
  })[0].visible).toBe(true);
});

test('normalizes one atomic order across matrix fields and row UDFs', () => {
  const initial = {
    matrixColumns: {
      itemNo: { visible: true, order: 1 },
      quantity: { visible: true, order: 2 },
    },
    rowUdfs: {
      U_Current: { visible: true, order: 3 },
    },
  };
  const reordered = reorderFormSettingPreferences(initial, [
    { key: 'U_Current', settingsGroup: 'rowUdfs' },
    { key: 'quantity', settingsGroup: 'matrixColumns' },
    { key: 'itemNo', settingsGroup: 'matrixColumns' },
    { key: 'U_Stale', settingsGroup: 'rowUdfs' },
  ]);

  expect(reordered.rowUdfs.U_Current.order).toBe(1);
  expect(reordered.matrixColumns.quantity.order).toBe(2);
  expect(reordered.matrixColumns.itemNo.order).toBe(3);
  expect(reordered.rowUdfs.U_Stale).toBeUndefined();
  expect(initial.matrixColumns.itemNo.order).toBe(1);
});

test('combines actual matrix and row-UDF fields once and removes structural controls', () => {
  const merged = mergeContentSettingsFields(
    [
      { key: 'itemNo', label: 'Item No.' },
      { key: 'U_Packing', fieldName: 'U_Packing', label: 'Packing' },
      { key: '__lineNumber', label: '#' },
      { key: '__actions', label: '' },
    ],
    [
      { key: 'U_Packing', label: 'Packing duplicate' },
      { key: 'U_Current', label: 'Current company field' },
    ],
  );

  expect(merged.map((field) => field.key)).toEqual(['itemNo', 'U_Packing', 'U_Current']);
  expect(merged[2].settingsGroup).toBe('rowUdfs');
});

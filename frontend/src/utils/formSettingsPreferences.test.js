import {
  mergeSavedFormSettings,
  updateFormSettingPreference,
} from './formSettingsPreferences';

const liveDefaults = {
  matrixColumns: {
    itemNo: {
      visible: true,
      active: true,
      order: 2,
      minWidth: 150,
      sapControlled: true,
    },
  },
  rowUdfs: {
    U_Current: {
      visible: true,
      active: false,
      order: 3,
      minWidth: 120,
      sapControlled: true,
    },
  },
  headerUdfs: {
    U_Header: {
      visible: true,
      active: true,
      order: 1,
      minWidth: 100,
      sapControlled: true,
    },
  },
};

test('merges only saved visibility for current SAP-controlled line fields', () => {
  const merged = mergeSavedFormSettings(liveDefaults, {
    matrixColumns: {
      itemNo: { visible: false, active: false, order: 999, minWidth: 999 },
      oldCompanyField: { visible: true },
    },
    rowUdfs: {
      U_Current: { visible: false, active: true, order: 999, minWidth: 999 },
      U_OtherCompany: { visible: true },
    },
    headerUdfs: {
      U_Header: { visible: false, active: false },
    },
  });

  expect(merged.matrixColumns).toEqual({
    itemNo: {
      visible: false,
      active: true,
      order: 1,
      minWidth: 150,
      sapControlled: true,
    },
  });
  expect(merged.rowUdfs.U_Current).toEqual({
    visible: false,
    active: false,
    order: 2,
    minWidth: 120,
    sapControlled: true,
  });
  expect(merged.headerUdfs.U_Header.visible).toBe(true);
  expect(merged.headerUdfs.U_Header.active).toBe(true);
  expect(merged.matrixColumns.oldCompanyField).toBeUndefined();
  expect(merged.rowUdfs.U_OtherCompany).toBeUndefined();
});

test('keeps fallback line activity authoritative while retaining non-line behavior', () => {
  const defaults = {
    matrixColumns: {
      note: {
        visible: true,
        active: true,
        order: 4,
        minWidth: 90,
        sapControlled: false,
      },
    },
    headerUdfs: {
      U_Note: {
        visible: true,
        active: true,
        order: 5,
        minWidth: 100,
        sapControlled: false,
      },
    },
  };

  expect(mergeSavedFormSettings(defaults, {
    matrixColumns: {
      note: {
        visible: false,
        active: false,
        order: 500,
        minWidth: 500,
        userOption: 'kept',
      },
    },
    headerUdfs: {
      U_Note: {
        visible: false,
        active: false,
        order: 600,
        minWidth: 600,
        userOption: 'kept',
      },
    },
  })).toEqual({
    matrixColumns: {
      note: {
        visible: false,
        active: true,
        order: 1,
        minWidth: 90,
        sapControlled: false,
      },
    },
    headerUdfs: {
      U_Note: {
        visible: false,
        active: false,
        order: 5,
        minWidth: 100,
        sapControlled: false,
        userOption: 'kept',
      },
    },
  });
});

test('keeps saved user order and appends newly discovered SAP fields', () => {
  const defaults = {
    matrixColumns: {
      itemNo: { visible: true, order: 1, sapControlled: true },
      quantity: { visible: true, order: 2, sapControlled: true },
      newSapField: { visible: true, order: 0, sapControlled: true },
    },
    rowUdfs: {},
  };
  const merged = mergeSavedFormSettings(defaults, {
    matrixColumns: {
      quantity: { visible: true, order: 1 },
      itemNo: { visible: true, order: 2 },
      staleCompanyField: { visible: true, order: 0 },
    },
  });

  expect(merged.matrixColumns.quantity.order).toBe(1);
  expect(merged.matrixColumns.itemNo.order).toBe(2);
  expect(merged.matrixColumns.newSapField.order).toBe(3);
  expect(merged.matrixColumns.staleCompanyField).toBeUndefined();
});

test('updates line order but rejects invalid order values', () => {
  const reordered = updateFormSettingPreference(
    liveDefaults,
    'matrixColumns',
    'itemNo',
    'order',
    7,
  );
  expect(reordered.matrixColumns.itemNo.order).toBe(7);
  expect(updateFormSettingPreference(
    reordered,
    'matrixColumns',
    'itemNo',
    'order',
    -1,
  )).toBe(reordered);
});

test('updates live line visibility but rejects SAP activity and unknown fields', () => {
  const hidden = updateFormSettingPreference(
    liveDefaults,
    'matrixColumns',
    'itemNo',
    'visible',
    false,
  );

  expect(hidden.matrixColumns.itemNo.visible).toBe(false);
  expect(hidden).not.toBe(liveDefaults);
  expect(updateFormSettingPreference(
    hidden,
    'matrixColumns',
    'itemNo',
    'active',
    false,
  )).toBe(hidden);
  const fallbackSettings = {
    matrixColumns: {
      fallback: { visible: true, active: true, sapControlled: false },
    },
  };
  expect(updateFormSettingPreference(
    fallbackSettings,
    'matrixColumns',
    'fallback',
    'active',
    false,
  )).toBe(fallbackSettings);
  expect(updateFormSettingPreference(
    hidden,
    'headerUdfs',
    'U_Header',
    'visible',
    false,
  )).toBe(hidden);
  expect(updateFormSettingPreference(
    hidden,
    'rowUdfs',
    'U_OtherCompany',
    'visible',
    true,
  )).toBe(hidden);
  expect(updateFormSettingPreference(
    hidden,
    'matrixColumns',
    'itemNo',
    'visible',
    'false',
  )).toBe(hidden);
});

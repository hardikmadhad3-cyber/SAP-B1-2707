import { normalizeUdfState, readSavedFormSettings } from './deliveryForm';

test('can make the current Delivery UDF definitions authoritative', () => {
  const definitions = [{ key: 'U_LiveField', defaultValue: '' }];
  const source = { U_LiveField: 'kept', U_StaleOtherCompany: 'removed' };

  expect(normalizeUdfState(definitions, source, { preserveExtra: false })).toEqual({
    U_LiveField: 'kept',
  });
  expect(normalizeUdfState([], source, { preserveExtra: false })).toEqual({});
});

test('keeps Delivery metadata authoritative except for saved line visibility', () => {
  const storageKey = 'delivery-form-settings-test';
  window.localStorage.setItem(storageKey, JSON.stringify({
    matrixColumns: {
      unitPrice: { visible: false, active: false, order: 999, minWidth: 5, sapControlled: false },
      U_OtherCompanyOnly: { visible: true, active: true },
    },
  }));

  const settings = readSavedFormSettings([], [], [{
    key: 'unitPrice',
    label: 'Unit Price',
    visible: true,
    active: true,
    order: 5,
    minWidth: 110,
    sapControlled: true,
  }], storageKey);

  expect(settings.matrixColumns).toEqual({
    unitPrice: {
      visible: false,
      active: true,
      order: 1,
      minWidth: 110,
      sapControlled: true,
    },
  });
  expect(settings.matrixColumns.U_OtherCompanyOnly).toBeUndefined();

  window.localStorage.removeItem(storageKey);
});

import {
  createServiceDocumentFormSettings,
  readServiceDocumentFormSettings,
} from './serviceDocumentFormSettingsConfig';

const matrixColumns = [
  {
    key: 'description',
    visible: true,
    active: true,
    sapControlled: true,
    columnOrder: 3,
    minWidth: 240,
  },
  {
    key: 'lineTotal',
    visible: true,
    active: false,
    readOnly: true,
    sapControlled: true,
    columnOrder: 8,
    minWidth: 130,
  },
];

const headerUdfs = [
  { key: 'U_HeaderCurrent', visible: true, active: true, sapControlled: true },
];

const rowUdfs = [
  {
    key: 'U_CurrentCompany',
    visible: true,
    active: false,
    sapControlled: true,
    columnOrder: 20,
    minWidth: 110,
  },
];

describe('service document Form Settings schema reconciliation', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('uses the selected company schema as the complete field allowlist', () => {
    const storageKey = 'service-form-settings-company-b';
    window.localStorage.setItem(storageKey, JSON.stringify({
      matrixColumns: {
        description: { visible: false, active: false, order: 999, minWidth: 999 },
        itemCode: { visible: true, active: true },
        warehouse: { visible: true, active: true },
      },
      headerUdfs: {
        U_HeaderCurrent: { visible: false },
        U_HeaderFromCompanyA: { visible: true },
      },
      rowUdfs: {
        U_CurrentCompany: { visible: false, active: true, order: 999 },
        U_RowFromCompanyA: { visible: true },
      },
    }));

    const settings = readServiceDocumentFormSettings({
      headerUdfs,
      rowUdfs,
      matrixColumns,
      storageKey,
    });

    expect(Object.keys(settings.matrixColumns)).toEqual(['description', 'lineTotal']);
    expect(settings.matrixColumns.description).toMatchObject({
      visible: false,
      active: true,
      order: 1,
      minWidth: 240,
    });
    expect(settings.matrixColumns.lineTotal.active).toBe(false);
    expect(settings.matrixColumns.itemCode).toBeUndefined();
    expect(settings.matrixColumns.warehouse).toBeUndefined();

    expect(Object.keys(settings.headerUdfs)).toEqual(['U_HeaderCurrent']);
    expect(settings.headerUdfs.U_HeaderCurrent.visible).toBe(true);
    expect(Object.keys(settings.rowUdfs)).toEqual(['U_CurrentCompany']);
    expect(settings.rowUdfs.U_CurrentCompany).toMatchObject({
      visible: false,
      active: false,
      order: 2,
      minWidth: 110,
    });
  });

  test('safe fallback exposes only declared service standard fields', () => {
    const settings = createServiceDocumentFormSettings([], [], matrixColumns);

    expect(Object.keys(settings.matrixColumns)).toEqual(['description', 'lineTotal']);
    expect(settings.headerUdfs).toEqual({});
    expect(settings.rowUdfs).toEqual({});
  });
});

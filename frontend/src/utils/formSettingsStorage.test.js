import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../auth/AuthContext';
import { fetchFormSettings, saveFormSettings } from '../api/formSettingsApi';
import {
  buildCompanyScopedFormSettingsKey,
  applyPublishedQueryLayoutToSettings,
  isFormSettingsPayloadForScope,
  useCompanyScopedFormSettings,
} from './formSettingsStorage';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/formSettingsApi', () => ({
  fetchFormSettings: jest.fn(),
  saveFormSettings: jest.fn(),
}));

const company = { companyId: 7, dbName: 'COMPANY_A', serverName: 'SAP01' };
const user = { userId: 10, username: 'manager' };

const readTestSettings = (storageKey) => {
  const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
  return {
    matrixColumns: {
      ItemCode: {
        visible: saved?.matrixColumns?.ItemCode?.visible ?? true,
        active: true,
      },
    },
    rowUdfs: {},
    headerUdfs: {},
  };
};

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
  useAuth.mockReturnValue({ company, user });
});

test('maps service aliases to real definitions rather than synthetic item fields', () => {
  const fields = ['sac', 'description', 'glAccount', 'glAccountName', 'discountPercent', 'priceAfterDisc', 'taxCode', 'wtaxLiable', 'totalLC', 'loc', 'blanketAgreementNo'];
  const aliases = ['SAC', 'Description', 'GL_Account', 'GL_Account_Name', 'Discount_Percent', 'Price_after_Disc', 'Tax_Code', 'WTax_Liable', 'Total_LC', 'Loc', 'Blanket_Agreement_No'];
  const defaults = { matrixColumns: Object.fromEntries(fields.map((key) => [key, { visible: false }])), rowUdfs: { U_PRICE: { visible: false }, U_TAXCODE: { visible: false } } };
  const layout = { isPublished: true, columns: [...aliases.map((key) => ({ key })), { key: 'TaxCode', fieldName: 'U_TAXCODE' }, { key: 'Price', fieldName: 'U_PRICE' }] };
  const settings = applyPublishedQueryLayoutToSettings(defaults, layout, [[], [{ key: 'U_PRICE' }, { key: 'U_TAXCODE' }], fields.map((key) => ({ key }))]);
  fields.forEach((key, index) => expect(settings.matrixColumns[key]).toMatchObject({ visible: true, order: index + 1 }));
  expect(settings.matrixColumns.itemDescription).toBeUndefined();
  expect(settings.matrixColumns.stdDiscount).toBeUndefined();
  expect(settings.rowUdfs.U_TAXCODE).toMatchObject({ visible: true, order: 12 });
  expect(settings.rowUdfs.U_PRICE).toMatchObject({ visible: true, order: 13 });
});

test.each([undefined, 1, 2])('service layouts follow a new publication but retain overrides for its version (%s)', async (savedVersion) => {
  const formKey = 'service-layout';
  const settings = { matrixColumns: { sac: { visible: false }, glAccount: { visible: true } }, rowUdfs: {} };
  if (savedVersion !== undefined) settings.__companyQueryLayout = { formKey, version: savedVersion };
  fetchFormSettings.mockResolvedValue({ companyId: 7, userId: 10, settings,
    queryLayout: { formKey, version: 2, isPublished: true, columns: [{ key: 'SAC' }, { key: 'GL_Account' }] } });
  const read = (key) => JSON.parse(window.localStorage.getItem(key) || JSON.stringify(settings));
  const { result } = renderHook(() => useCompanyScopedFormSettings(formKey, read,
    [[], [], [{ key: 'sac' }, { key: 'glAccount' }]], { saveMode: 'explicit', followPublishedVersion: true }));
  await waitFor(() => expect(result.current[4].loaded).toBe(true));
  expect(result.current[0].matrixColumns.sac.visible).toBe(savedVersion !== 2);
  expect(saveFormSettings).not.toHaveBeenCalled();
});

test('scopes browser Form Settings by both SAP company and signed-in user', () => {
  const userB = { userId: 11, username: 'operator' };
  const companyB = { companyId: 8, dbName: 'COMPANY_B', serverName: 'SAP01' };
  const keyA = buildCompanyScopedFormSettingsKey('delivery', company, user);

  expect(keyA).not.toBe(buildCompanyScopedFormSettingsKey('delivery', company, userB));
  expect(keyA).not.toBe(buildCompanyScopedFormSettingsKey('delivery', companyB, user));
});

test('requires settings responses to identify the active user and company', () => {
  expect(isFormSettingsPayloadForScope({ companyId: 7, userId: 10 }, company, user)).toBe(true);
  expect(isFormSettingsPayloadForScope({ companyId: 8, userId: 10 }, company, user)).toBe(false);
  expect(isFormSettingsPayloadForScope({ companyId: 7 }, company, user)).toBe(false);
  expect(isFormSettingsPayloadForScope({}, company, user)).toBe(false);
});

test('applies published SQL columns as an editable company Content layout', () => {
  const settings = applyPublishedQueryLayoutToSettings(
    {
      matrixColumns: {
        __lineNumber: { visible: true, active: true },
        itemNo: { visible: true, active: true },
        quantity: { visible: true, active: true },
        unitPrice: { visible: true, active: true },
        stdDiscount: { visible: true, active: true },
        taxCode: { visible: true, active: true },
        whse: { visible: true, active: true },
        binLocationAllocation: { visible: true, active: true },
        priceAfterDiscount: { visible: true, active: true },
        itemCost: { visible: true, active: true },
        deliveredQty: { visible: true, active: true },
        forRate: { visible: true, active: true },
      },
      rowUdfs: {
        grossWt: { visible: true, active: true },
        totalPackage: { visible: true, active: true },
        price: { visible: true, active: true },
        specialRebate: { visible: true, active: true },
        U_Fix_Brock_B: { visible: true, active: true },
        U_Custom: { visible: true, active: true },
      },
      headerUdfs: {},
    },
    {
      formKey: 'sapb1.salesQuotation.formSettings.v1',
      version: 2,
      isPublished: true,
      columns: [
        { key: 'Item_No', label: 'Item_No' },
        { key: 'Unit_Price', label: 'Unit_Price' },
        { key: 'GrossWt', label: 'GrossWt' },
        { key: 'Total_Package', label: 'Total_Package' },
        { key: 'Discount_Percent', label: 'Discount_Percent' },
        { key: 'Delivered_Qty', label: 'Delivered_Qty' },
        { key: 'FOR_Rate', label: 'FOR_Rate' },
        { key: 'Whse', label: 'Whse' },
        { key: 'Bin_Location_Allocation', label: 'Bin_Location_Allocation' },
        { key: 'Price_after_Discount', label: 'Price_after_Discount' },
        { key: 'Item_Cost', label: 'Item_Cost' },
        { key: 'Price', label: 'Price' },
        { key: 'Special_Rebate', label: 'Special_Rebate' },
        { key: 'FIX_Brok_BUYER', label: 'FIX_Brok_BUYER' },
        { key: 'U_Custom', label: 'U_Custom' },
      ],
    },
    [
      [],
      [
        { key: 'price', label: 'Price' },
        { key: 'grossWt', label: 'GrossWt' },
        { key: 'totalPackage', label: 'Total-Package' },
        { key: 'specialRebate', label: 'Special Rebate' },
        { key: 'U_Fix_Brock_B', label: 'FIX Brok BUYER' },
        { key: 'U_Custom', label: 'Custom' },
      ],
      [
        { key: '__lineNumber', label: '#' },
        { key: 'itemNo', label: 'Item No.' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'unitPrice', label: 'Unit Price', sapField: 'Price' },
        { key: 'stdDiscount', label: 'Discount %' },
        { key: 'taxCode', label: 'Tax Code' },
        { key: 'whse', label: 'Whse' },
        { key: 'binLocationAllocation', label: 'Bin Location Allocation' },
        { key: 'priceAfterDiscount', label: 'Price after Discount' },
        { key: 'itemCost', label: 'Item Cost' },
        { key: 'deliveredQty', label: 'Delivered Qty' },
        { key: 'forRate', label: 'FOR Rate' },
      ],
    ],
  );

  expect(settings.__companyQueryLayout.mode).toBe('editable-layout');
  expect(settings.matrixColumns.itemNo).toMatchObject({ visible: true, active: true, order: 1 });
  expect(settings.matrixColumns.unitPrice).toMatchObject({ visible: true, active: true, order: 2 });
  expect(settings.rowUdfs.grossWt).toMatchObject({ visible: true, active: true, order: 3 });
  expect(settings.rowUdfs.totalPackage).toMatchObject({ visible: true, active: true, order: 4 });
  expect(settings.matrixColumns.stdDiscount).toMatchObject({ visible: true, active: true, order: 5 });
  expect(settings.matrixColumns.deliveredQty).toMatchObject({ visible: true, active: true, order: 6 });
  expect(settings.matrixColumns.forRate).toMatchObject({ visible: true, active: true, order: 7 });
  expect(settings.matrixColumns.whse).toMatchObject({ visible: true, active: true, order: 8 });
  expect(settings.matrixColumns.binLocationAllocation).toMatchObject({ visible: true, active: true, order: 9 });
  expect(settings.matrixColumns.priceAfterDiscount).toMatchObject({ visible: true, active: true, order: 10 });
  expect(settings.matrixColumns.itemCost).toMatchObject({ visible: true, active: true, order: 11 });
  expect(settings.rowUdfs.price).toMatchObject({ visible: true, active: true, order: 12 });
  expect(settings.rowUdfs.specialRebate).toMatchObject({ visible: true, active: true, order: 13 });
  expect(settings.rowUdfs.U_Fix_Brock_B).toMatchObject({ visible: true, active: true, order: 14 });
  expect(settings.rowUdfs.U_Custom).toMatchObject({ visible: true, active: true, order: 15 });
  expect(settings.matrixColumns.__lineNumber).toMatchObject({ visible: true, active: true, order: 0, companyQueryLayout: true });
  expect(settings.matrixColumns.quantity.visible).toBe(false);
  expect(settings.matrixColumns.taxCode.visible).toBe(false);
});

test('creates SQL-selected standard matrix settings even when live metadata omitted them', () => {
  const settings = applyPublishedQueryLayoutToSettings(
    {
      matrixColumns: {
        __lineNumber: { visible: true, active: true },
        itemNo: { visible: true, active: true },
      },
      rowUdfs: {},
      headerUdfs: {},
    },
    {
      formKey: 'sapb1.salesOrder.formSettings.v1',
      version: 4,
      isPublished: true,
      columns: [
        { key: 'Delivered_Qty', label: 'Delivered_Qty' },
        { key: 'FOR_Rate', label: 'FOR_Rate' },
      ],
    },
    [[], [], [{ key: '__lineNumber', label: '#' }, { key: 'itemNo', label: 'Item No.' }]],
  );

  expect(settings.matrixColumns.__lineNumber.visible).toBe(true);
  expect(settings.matrixColumns.itemNo.visible).toBe(false);
  expect(settings.matrixColumns.deliveredQty).toMatchObject({ visible: true, order: 1, companyQueryLayout: true });
  expect(settings.matrixColumns.forRate).toMatchObject({ visible: true, order: 2, companyQueryLayout: true });
});

test('loads company settings first and keeps explicit edits out of cache until Save succeeds', async () => {
  fetchFormSettings.mockResolvedValue({
    companyId: 7,
    userId: 10,
    settings: { matrixColumns: { ItemCode: { visible: false } } },
  });
  saveFormSettings.mockResolvedValue({ companyId: 7, userId: 10 });

  const { result } = renderHook(() => useCompanyScopedFormSettings(
    'sales-order-form',
    readTestSettings,
    [],
    { saveMode: 'explicit' },
  ));

  expect(result.current[4].loading).toBe(true);
  await waitFor(() => expect(result.current[4].loaded).toBe(true));
  expect(result.current[0].matrixColumns.ItemCode.visible).toBe(false);

  act(() => {
    result.current[1]((settings) => ({
      ...settings,
      matrixColumns: {
        ...settings.matrixColumns,
        ItemCode: { ...settings.matrixColumns.ItemCode, visible: true },
      },
    }));
  });

  const storageKey = result.current[2];
  expect(JSON.parse(window.localStorage.getItem(storageKey)).matrixColumns.ItemCode.visible).toBe(false);
  expect(result.current[4].hasUnsavedChanges).toBe(true);
  expect(saveFormSettings).not.toHaveBeenCalled();

  await act(async () => {
    await result.current[4].save();
  });

  expect(saveFormSettings).toHaveBeenCalledWith(
    'sales-order-form',
    expect.objectContaining({ matrixColumns: expect.any(Object) }),
  );
  expect(JSON.parse(window.localStorage.getItem(storageKey)).matrixColumns.ItemCode.visible).toBe(true);
  expect(result.current[4].hasUnsavedChanges).toBe(false);
});

test('uses the published company SQL layout as an editable default and saves a user override', async () => {
  const companyDefaultSettings = {
    matrixColumns: {
      itemNo: { visible: true, active: true },
      quantity: { visible: true, active: true },
    },
    rowUdfs: {},
    headerUdfs: {},
  };
  const publishedLayout = {
    formKey: 'sales-order-form',
    version: 3,
    isPublished: true,
    columns: [{ key: 'Item_No', label: 'Item No.' }],
  };
  const readCompanyDefaultSettings = (storageKey) => (
    JSON.parse(window.localStorage.getItem(storageKey) || 'null') || companyDefaultSettings
  );

  fetchFormSettings.mockResolvedValue({
    companyId: 7,
    userId: 10,
    settings: null,
    queryLayout: publishedLayout,
  });
  saveFormSettings.mockResolvedValue({ companyId: 7, userId: 10 });

  const { result } = renderHook(() => useCompanyScopedFormSettings(
    'sales-order-form',
    readCompanyDefaultSettings,
    [],
    { saveMode: 'explicit' },
  ));

  await waitFor(() => expect(result.current[4].loaded).toBe(true));
  expect(result.current[0].matrixColumns.itemNo.visible).toBe(true);
  expect(result.current[0].matrixColumns.quantity.visible).toBe(false);
  expect(result.current[4].companyQueryLayoutActive).toBe(true);

  act(() => {
    result.current[1]((settings) => ({
      ...settings,
      matrixColumns: {
        ...settings.matrixColumns,
        quantity: { ...settings.matrixColumns.quantity, visible: true },
      },
    }));
  });

  expect(result.current[0].matrixColumns.itemNo.visible).toBe(true);
  expect(result.current[0].matrixColumns.quantity.visible).toBe(true);
  expect(result.current[4].companyQueryLayoutActive).toBe(false);
  expect(result.current[4].hasUnsavedChanges).toBe(true);

  await act(async () => {
    await result.current[4].save();
  });

  expect(saveFormSettings).toHaveBeenCalledWith(
    'sales-order-form',
    expect.objectContaining({
      matrixColumns: expect.objectContaining({
        quantity: expect.objectContaining({ visible: true }),
      }),
    }),
  );
  expect(result.current[0].matrixColumns.quantity.visible).toBe(true);
});

test('keeps a saved user layout when a company SQL layout is also published', async () => {
  const readUserSettings = (storageKey) => {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : { matrixColumns: {}, rowUdfs: {}, headerUdfs: {} };
  };
  fetchFormSettings.mockResolvedValue({
    companyId: 7,
    userId: 10,
    settings: {
      matrixColumns: {
        itemNo: { visible: true },
        quantity: { visible: true },
      },
      rowUdfs: {},
      headerUdfs: {},
    },
    queryLayout: {
      formKey: 'sales-order-form',
      version: 3,
      isPublished: true,
      columns: [{ key: 'Item_No', label: 'Item No.' }],
    },
  });

  const { result } = renderHook(() => useCompanyScopedFormSettings(
    'sales-order-form',
    readUserSettings,
    [],
    { saveMode: 'explicit' },
  ));

  await waitFor(() => expect(result.current[4].loaded).toBe(true));
  expect(result.current[0].matrixColumns.quantity.visible).toBe(true);
  expect(result.current[4].companyQueryLayoutActive).toBe(false);
});

test('rejects a mismatched save response and leaves explicit changes unsaved', async () => {
  fetchFormSettings.mockResolvedValue({ companyId: 7, userId: 10, settings: null });
  saveFormSettings.mockResolvedValue({ companyId: 8, userId: 10 });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

  const { result } = renderHook(() => useCompanyScopedFormSettings(
    'delivery-form',
    readTestSettings,
    [],
    { saveMode: 'explicit' },
  ));
  await waitFor(() => expect(result.current[4].loaded).toBe(true));

  act(() => {
    result.current[1]((settings) => ({
      ...settings,
      matrixColumns: {
        ...settings.matrixColumns,
        ItemCode: { ...settings.matrixColumns.ItemCode, visible: false },
      },
    }));
  });

  let saved;
  await act(async () => {
    saved = await result.current[4].save();
  });

  expect(saved).toBe(false);
  expect(result.current[4].hasUnsavedChanges).toBe(true);
  expect(result.current[4].error).toMatch(/different user or company/i);
  expect(window.localStorage.getItem(result.current[2])).toBeNull();
  warn.mockRestore();
});


test('a company Price column selects the standard calculation input and Total Before Tax selects net total', () => {
  const result = applyPublishedQueryLayoutToSettings(
    { matrixColumns: { unitPrice: { visible: false }, price: { visible: true }, totalLC: { visible: false } }, rowUdfs: {} },
    { isPublished: true, columns: [{ key: 'Price', label: 'Price' }, { key: 'Total_Before_Tax', label: 'Total Before Tax' }] },
    [[], [], [{ key: 'unitPrice', sapField: 'Price' }, { key: 'price', sapField: 'U_PRICE' }, { key: 'totalLC', sapField: 'LineTotal' }]]
  );
  expect(result.matrixColumns.unitPrice.visible).toBe(true);
  expect(result.matrixColumns.price.visible).toBe(false);
  expect(result.matrixColumns.totalLC.visible).toBe(true);
});

test('an explicit U_PRICE company column keeps its UDF identity', () => {
  const result = applyPublishedQueryLayoutToSettings(
    { matrixColumns: { unitPrice: { visible: true } }, rowUdfs: { U_PRICE: { visible: false } } },
    { isPublished: true, columns: [{ key: 'U_PRICE', label: 'Price' }] },
    [[], [{ key: 'U_PRICE', label: 'Price' }], [{ key: 'unitPrice', sapField: 'Price' }]]
  );
  expect(result.rowUdfs.U_PRICE.visible).toBe(true);
  expect(result.matrixColumns.unitPrice.visible).toBe(false);
});

import { act, renderHook, waitFor } from '@testing-library/react';

let mockAuthState;

jest.mock('../auth/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../api/formSettingsApi', () => ({
  fetchFormSettings: jest.fn(),
  saveFormSettings: jest.fn(),
}));

import { mergeSavedFormSettings } from './formSettingsPreferences';
import { getOrderedVisibleMatrixColumns } from './formSettingsColumns';

import { fetchFormSettings, saveFormSettings } from '../api/formSettingsApi';
import {
  buildCompanyScopedFormSettingsKey,
  useCompanyScopedFormSettings,
} from './formSettingsStorage';

const FORM_KEY = 'sapb1.salesOrder.formSettings.v2';

const DEFAULT_SETTINGS = {
  matrixColumns: {
    itemCode: { visible: true },
  },
  headerUdfs: {},
  rowUdfs: {},
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const readSavedFormSettings = (storageKey) => {
  const saved = window.localStorage.getItem(storageKey);
  return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
};

const renderExplicitSettingsHook = () => renderHook(() => (
  useCompanyScopedFormSettings(
    FORM_KEY,
    readSavedFormSettings,
    [],
    { saveMode: 'explicit' },
  )
));

describe('useCompanyScopedFormSettings explicit-save lifecycle', () => {
  let warnSpy;

  beforeEach(() => {
    mockAuthState = {
      company: {
        companyId: 7,
        companyName: 'Company A',
        dbName: 'COMPANY_A',
        serverName: 'SAP01',
      },
      user: { userId: 10, username: 'manager' },
    };
    window.localStorage.clear();
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('removes stale cached preferences when the backend has no user settings', async () => {
    const key = buildCompanyScopedFormSettingsKey(FORM_KEY, mockAuthState.company, mockAuthState.user);
    window.localStorage.setItem(key, JSON.stringify({ ...DEFAULT_SETTINGS,
      matrixColumns: { itemCode: { visible: false, order: 99 } },
    }));
    fetchFormSettings.mockResolvedValue({ companyId: 7, userId: 10, settings: null });
    const { result } = renderExplicitSettingsHook();
    await waitFor(() => expect(result.current[4].loaded).toBe(true));
    expect(result.current[0]).toEqual(DEFAULT_SETTINGS);
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(saveFormSettings).not.toHaveBeenCalled();
  });

  test('a save completed after a company switch cannot override the new company layout', async () => {
    const saveRequest = createDeferred();
    fetchFormSettings.mockResolvedValue({ companyId: 7, userId: 10, settings: DEFAULT_SETTINGS });
    saveFormSettings.mockReturnValue(saveRequest.promise);
    const { result, rerender } = renderExplicitSettingsHook();
    await waitFor(() => expect(result.current[4].loaded).toBe(true));
    act(() => result.current[1]({ ...DEFAULT_SETTINGS, matrixColumns: { itemCode: { visible: false } } }));
    let saving;
    act(() => { saving = result.current[4].save(); });
    mockAuthState = { ...mockAuthState, company: { ...mockAuthState.company, companyId: 8, dbName: 'COMPANY_B' } };
    fetchFormSettings.mockResolvedValue({ companyId: 8, userId: 10, settings: null,
      queryLayout: { isPublished: true, formKey: FORM_KEY, version: 1, columns: [{ key: 'ItemCode' }] },
    });
    rerender();
    await waitFor(() => expect(result.current[4].companyQueryLayoutActive).toBe(true));
    await act(async () => {
      saveRequest.resolve({ companyId: 7, userId: 10 });
      await saving;
    });
    expect(result.current[4].companyQueryLayoutActive).toBe(true);
    expect(result.current[0].__companyQueryLayout?.version).toBe(1);
  });

  test('keeps each company and user on a different browser-storage key', () => {
    const companyA = mockAuthState.company;
    const companyB = { ...companyA, companyId: 8, dbName: 'COMPANY_B' };
    const userA = mockAuthState.user;
    const userB = { userId: 11, username: 'operator' };

    const companyAUserAKey = buildCompanyScopedFormSettingsKey(FORM_KEY, companyA, userA);

    expect(companyAUserAKey).not.toBe(
      buildCompanyScopedFormSettingsKey(FORM_KEY, companyB, userA),
    );
    expect(companyAUserAKey).not.toBe(
      buildCompanyScopedFormSettingsKey(FORM_KEY, companyA, userB),
    );
  });

  test('does not become ready until matching company/user settings finish loading', async () => {
    const request = createDeferred();
    const backendSettings = {
      ...DEFAULT_SETTINGS,
      matrixColumns: { itemCode: { visible: false } },
    };
    fetchFormSettings.mockReturnValue(request.promise);

    const { result } = renderExplicitSettingsHook();

    expect(result.current[4]).toMatchObject({ loaded: false, loading: true });
    expect(result.current[0].matrixColumns.itemCode.visible).toBe(true);

    await act(async () => {
      request.resolve({
        companyId: 7,
        userId: 10,
        settings: backendSettings,
      });
      await request.promise;
    });

    await waitFor(() => expect(result.current[4].loaded).toBe(true));
    expect(result.current[4].loading).toBe(false);
    expect(result.current[0]).toEqual(backendSettings);
    expect(fetchFormSettings).toHaveBeenCalledWith(FORM_KEY);
  });

  test.each([
    ['different company', { companyId: 8, userId: 10, settings: { matrixColumns: {} } }],
    ['different user', { companyId: 7, userId: 11, settings: { matrixColumns: {} } }],
    ['missing scope', { settings: { matrixColumns: {} } }],
  ])('rejects a %s backend payload without applying it', async (_label, payload) => {
    fetchFormSettings.mockResolvedValue(payload);

    const { result } = renderExplicitSettingsHook();
    const scopedKey = result.current[2];

    await waitFor(() => expect(result.current[4].loaded).toBe(true));

    expect(result.current[0]).toEqual(DEFAULT_SETTINGS);
    expect(window.localStorage.getItem(scopedKey)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[FORM_SETTINGS] Unable to load backend settings:',
      'Ignored Form Settings returned for a different user or company.',
    );
  });

  test('keeps edits as a draft until Save, then persists and clears dirty state', async () => {
    fetchFormSettings.mockResolvedValue({
      companyId: 7,
      userId: 10,
      settings: DEFAULT_SETTINGS,
    });
    saveFormSettings.mockImplementation(async (_formKey, settings) => ({
      companyId: 7,
      userId: 10,
      settings,
    }));
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    const { result } = renderExplicitSettingsHook();
    await waitFor(() => expect(result.current[4].loaded).toBe(true));
    const scopedKey = result.current[2];
    setItemSpy.mockClear();

    act(() => {
      result.current[1]((current) => ({
        ...current,
        matrixColumns: {
          ...current.matrixColumns,
          itemCode: { ...current.matrixColumns.itemCode, visible: false },
        },
      }));
    });

    expect(result.current[0].matrixColumns.itemCode.visible).toBe(false);
    expect(result.current[4].hasUnsavedChanges).toBe(true);
    expect(saveFormSettings).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();

    let saved;
    await act(async () => {
      saved = await result.current[4].save();
    });

    expect(saved).toBe(true);
    expect(saveFormSettings).toHaveBeenCalledTimes(1);
    expect(saveFormSettings).toHaveBeenCalledWith(FORM_KEY, result.current[0]);
    expect(JSON.parse(window.localStorage.getItem(scopedKey))).toEqual(result.current[0]);
    expect(result.current[4]).toMatchObject({
      saving: false,
      error: '',
      hasUnsavedChanges: false,
    });

    setItemSpy.mockRestore();
  });

  test('discard restores the last saved company-scoped settings', async () => {
    const backendSettings = {
      ...DEFAULT_SETTINGS,
      matrixColumns: { itemCode: { visible: true, order: 1 } },
    };
    fetchFormSettings.mockResolvedValue({
      companyId: 7,
      userId: 10,
      settings: backendSettings,
    });

    const { result } = renderExplicitSettingsHook();
    await waitFor(() => expect(result.current[4].loaded).toBe(true));

    act(() => {
      result.current[1]((current) => ({
        ...current,
        matrixColumns: {
          ...current.matrixColumns,
          itemCode: { ...current.matrixColumns.itemCode, visible: false, order: 3 },
        },
      }));
    });
    expect(result.current[4].hasUnsavedChanges).toBe(true);

    act(() => {
      result.current[4].discard();
    });
    expect(result.current[0]).toEqual(backendSettings);
    expect(result.current[4].hasUnsavedChanges).toBe(false);
    expect(saveFormSettings).not.toHaveBeenCalled();
  });
  test('keeps cached user preferences when backend loading fails', async () => {
    const key = buildCompanyScopedFormSettingsKey(FORM_KEY, mockAuthState.company, mockAuthState.user);
    const cached = { ...DEFAULT_SETTINGS, matrixColumns: { itemCode: { visible: true, order: 4 } } };
    window.localStorage.setItem(key, JSON.stringify(cached));
    fetchFormSettings.mockRejectedValue(new Error('Offline'));
    const { result } = renderExplicitSettingsHook();
    await waitFor(() => expect(result.current[4].loaded).toBe(true));
    expect(result.current[0]).toEqual(cached);
    expect(window.localStorage.getItem(key)).toBe(JSON.stringify(cached));
    expect(saveFormSettings).not.toHaveBeenCalled();
  });

  test('no-op edits keep the published company order active', async () => {
    fetchFormSettings.mockResolvedValue({ companyId: 7, userId: 10, settings: null,
      queryLayout: { isPublished: true, version: 3, columns: [{ key: 'ItemCode' }] },
    });
    const { result } = renderExplicitSettingsHook();
    await waitFor(() => expect(result.current[4].loaded).toBe(true));
    act(() => result.current[1]((current) => current));
    expect(result.current[4].companyQueryLayoutActive).toBe(true);
    expect(result.current[4].hasUnsavedChanges).toBe(false);
    expect(saveFormSettings).not.toHaveBeenCalled();
  });

  test('saves a user override marker so edits survive a published company layout reload', async () => {
    fetchFormSettings.mockResolvedValue({ companyId: 7, userId: 10, settings: null,
      queryLayout: {
        isPublished: true, formKey: FORM_KEY, version: 3, columns: [{ key: 'ItemCode' }],
      },
    });
    let savedSettings;
    saveFormSettings.mockImplementation(async (_formKey, settings) => {
      savedSettings = settings;
      return { companyId: 7, userId: 10, settings };
    });
    const renderPublishedSettingsHook = () => renderHook(() => (
      useCompanyScopedFormSettings(
        FORM_KEY,
        readSavedFormSettings,
        [],
        { saveMode: 'explicit', followPublishedVersion: true },
      )
    ));

    const first = renderPublishedSettingsHook();
    await waitFor(() => expect(first.result.current[4].loaded).toBe(true));
    act(() => first.result.current[1]((current) => ({
      ...current,
      matrixColumns: { ...current.matrixColumns, itemCode: { visible: false } },
    })));
    await act(async () => {
      expect(await first.result.current[4].save()).toBe(true);
    });
    expect(savedSettings.__companyQueryLayout).toMatchObject({
      formKey: FORM_KEY,
      version: 3,
      mode: 'user-override',
    });
    first.unmount();

    fetchFormSettings.mockResolvedValue({ companyId: 7, userId: 10, settings: savedSettings,
      queryLayout: {
        isPublished: true, formKey: FORM_KEY, version: 3, columns: [{ key: 'ItemCode' }],
      },
    });
    const reloaded = renderPublishedSettingsHook();
    await waitFor(() => expect(reloaded.result.current[4].loaded).toBe(true));
    expect(reloaded.result.current[0].matrixColumns.itemCode.visible).toBe(false);
    expect(reloaded.result.current[4].companyQueryLayoutActive).toBe(false);
  });

  test.each(['metadata-first', 'settings-first'])('preserves saved mixed standard/UDF order with %s loading', async (timing) => {
    const request = createDeferred();
    const fields = [{ key: 'quantity' }, { key: 'U_Current' }, { key: 'itemNo' }];
    const fullSchema = {
      matrixColumns: { itemNo: { order: 1 }, quantity: { order: 2 } },
      rowUdfs: { U_Current: { order: 3, active: false } }, headerUdfs: {},
    };
    const saved = { matrixColumns: { quantity: { order: 1 }, itemNo: { order: 3 } },
      rowUdfs: { U_Current: { order: 2 } }, headerUdfs: {},
    };
    const read = (schema, key) => mergeSavedFormSettings(schema, JSON.parse(window.localStorage.getItem(key) || '{}'));
    fetchFormSettings.mockReturnValue(request.promise);
    const { result, rerender } = renderHook(({ schema }) => useCompanyScopedFormSettings(
      FORM_KEY, read, [schema], { saveMode: 'explicit' },
    ), { initialProps: { schema: { matrixColumns: {}, rowUdfs: {}, headerUdfs: {} } } });
    const hydrate = () => {
      rerender({ schema: fullSchema });
      act(() => result.current[3](read(fullSchema, result.current[2])));
    };
    if (timing === 'metadata-first') hydrate();
    await act(async () => {
      request.resolve({ companyId: 7, userId: 10, settings: saved });
      await request.promise;
    });
    if (timing === 'settings-first') hydrate();
    expect(getOrderedVisibleMatrixColumns(fields, result.current[0]).map((field) => field.key))
      .toEqual(['quantity', 'U_Current', 'itemNo']);
    expect(result.current[0].rowUdfs.U_Current.active).toBe(false);
    expect(result.current[4].hasUnsavedChanges).toBe(false);
    expect(saveFormSettings).not.toHaveBeenCalled();
  });

  test('metadata reconciliation retains a draft order without auto-saving', async () => {
    fetchFormSettings.mockResolvedValue({ companyId: 7, userId: 10, settings: DEFAULT_SETTINGS });
    const { result } = renderExplicitSettingsHook();
    await waitFor(() => expect(result.current[4].loaded).toBe(true));
    act(() => result.current[1]({ ...DEFAULT_SETTINGS,
      matrixColumns: { itemCode: { visible: true, order: 2 }, quantity: { visible: true, order: 1 } },
    }));
    act(() => result.current[3]({ matrixColumns: {
      itemCode: { order: 1 }, quantity: { order: 2 }, newField: { order: 0 },
    }, headerUdfs: {}, rowUdfs: {} }));
    expect(getOrderedVisibleMatrixColumns([{ key: 'itemCode' }, { key: 'quantity' }, { key: 'newField' }], result.current[0])
      .map((field) => field.key)).toEqual(['quantity', 'itemCode', 'newField']);
    expect(result.current[4].hasUnsavedChanges).toBe(true);
    expect(saveFormSettings).not.toHaveBeenCalled();
  });

  test('reconciles persisted preferences when metadata arrives after settings without a page replacement', async () => {
    const saved = { matrixColumns: { itemNo: { order: 3 }, quantity: { order: 1 } },
      rowUdfs: { U_Current: { order: 2 } }, headerUdfs: {},
    };
    fetchFormSettings.mockResolvedValue({ companyId: 7, userId: 10, settings: saved });
    const read = (schema, key) => mergeSavedFormSettings(schema, JSON.parse(window.localStorage.getItem(key) || '{}'));
    const { result, rerender } = renderHook(({ schema }) => useCompanyScopedFormSettings(
      FORM_KEY, read, [schema], { saveMode: 'explicit' },
    ), { initialProps: { schema: { matrixColumns: {}, rowUdfs: {}, headerUdfs: {} } } });
    await waitFor(() => expect(result.current[4].loaded).toBe(true));
    rerender({ schema: {
      matrixColumns: { itemNo: { order: 1 }, quantity: { order: 2 } },
      rowUdfs: { U_Current: { order: 3 } }, headerUdfs: {},
    } });
    await waitFor(() => expect(getOrderedVisibleMatrixColumns(
      [{ key: 'itemNo' }, { key: 'quantity' }, { key: 'U_Current' }], result.current[0],
    ).map((field) => field.key)).toEqual(['quantity', 'U_Current', 'itemNo']));
    expect(result.current[4].hasUnsavedChanges).toBe(false);
    expect(saveFormSettings).not.toHaveBeenCalled();
  });

});

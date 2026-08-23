import { act, renderHook, waitFor } from '@testing-library/react';

let mockAuthState;

jest.mock('../auth/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../api/formSettingsApi', () => ({
  fetchFormSettings: jest.fn(),
  saveFormSettings: jest.fn(),
}));

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
});

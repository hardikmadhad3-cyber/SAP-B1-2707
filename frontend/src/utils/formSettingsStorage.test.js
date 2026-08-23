import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../auth/AuthContext';
import { fetchFormSettings, saveFormSettings } from '../api/formSettingsApi';
import {
  buildCompanyScopedFormSettingsKey,
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

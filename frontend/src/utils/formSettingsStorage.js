import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchFormSettings, saveFormSettings } from '../api/formSettingsApi';

const normalizeScopePart = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

const areSettingsEqual = (left, right) => {
  try {
    return JSON.stringify(left || {}) === JSON.stringify(right || {});
  } catch (_error) {
    return false;
  }
};

export const buildCompanyScopedFormSettingsKey = (baseKey, company = {}, user = {}) => {
  const safeCompany = company || {};
  const safeUser = user || {};
  const companyScope = [
    safeCompany.companyId !== undefined && safeCompany.companyId !== null ? `id:${safeCompany.companyId}` : '',
    safeCompany.dbName ? `db:${normalizeScopePart(safeCompany.dbName)}` : '',
    safeCompany.serverName ? `server:${normalizeScopePart(safeCompany.serverName)}` : '',
  ].filter(Boolean);
  const userScope = [
    safeUser.userId !== undefined && safeUser.userId !== null ? `id:${safeUser.userId}` : '',
    safeUser.UserId !== undefined && safeUser.UserId !== null ? `id:${safeUser.UserId}` : '',
    safeUser.username ? `username:${normalizeScopePart(safeUser.username)}` : '',
    safeUser.Username ? `username:${normalizeScopePart(safeUser.Username)}` : '',
  ].filter(Boolean);

  return `${baseKey}::user:${encodeURIComponent(userScope.join('|') || 'unselected')}::company:${encodeURIComponent(companyScope.join('|') || 'unselected')}`;
};

const normalizeScopeId = (value) => String(value ?? '').trim();

export const isFormSettingsPayloadForScope = (payload = {}, company = {}, user = {}) => {
  const expectedCompanyId = normalizeScopeId(company?.companyId);
  const expectedUserId = normalizeScopeId(user?.userId ?? user?.UserId);
  const payloadCompanyId = normalizeScopeId(payload?.companyId);
  const payloadUserId = normalizeScopeId(payload?.userId);

  if (expectedCompanyId && expectedCompanyId !== payloadCompanyId) return false;
  if (expectedUserId && expectedUserId !== payloadUserId) return false;
  return true;
};

export const useCompanyScopedFormSettings = (
  baseStorageKey,
  readSavedFormSettings,
  readArgs = [],
  options = {},
) => {
  const { company, user } = useAuth();
  const saveMode = options?.saveMode === 'explicit' ? 'explicit' : 'auto';
  const selectedCompanyId = company?.companyId;
  const selectedUserId = user?.userId ?? user?.UserId;
  const storageKey = useMemo(
    () => buildCompanyScopedFormSettingsKey(baseStorageKey, company, user),
    [
      baseStorageKey,
      company?.companyId,
      company?.dbName,
      company?.serverName,
      user?.userId,
      user?.UserId,
      user?.username,
      user?.Username,
    ],
  );

  // Document pages obtain their live schema asynchronously. Always resolve
  // persisted preferences with the latest schema, rather than with the empty
  // schema that existed when a company-switch request started.
  const readArgsRef = useRef(readArgs);
  readArgsRef.current = readArgs;
  const hasLocalChangesRef = useRef(false);
  const stateRef = useRef(null);
  const saveRequestRef = useRef(0);

  const readSettings = useCallback(
    (key = storageKey) => readSavedFormSettings(...readArgsRef.current, key),
    [readSavedFormSettings, storageKey],
  );

  const [state, setState] = useState(() => ({
    storageKey,
    settings: readSettings(storageKey),
    loaded: false,
    saveVersion: 0,
    savedVersion: 0,
  }));
  stateRef.current = state;
  const [persistence, setPersistence] = useState({
    saving: false,
    error: '',
  });

  useEffect(() => {
    let isCancelled = false;
    hasLocalChangesRef.current = false;
    saveRequestRef.current += 1;

    setState({
      storageKey,
      settings: readSettings(storageKey),
      loaded: false,
      saveVersion: 0,
      savedVersion: 0,
    });
    setPersistence({ saving: false, error: '' });

    fetchFormSettings(baseStorageKey)
      .then((payload) => {
        if (isCancelled) return;
        if (!isFormSettingsPayloadForScope(
          payload,
          { companyId: selectedCompanyId },
          { userId: selectedUserId },
        )) {
          throw new Error('Ignored Form Settings returned for a different user or company.');
        }

        const backendSettings = payload?.settings;
        const hasBackendSettings =
          backendSettings && typeof backendSettings === 'object' && !Array.isArray(backendSettings);

        setState((previous) => {
          if (previous.storageKey !== storageKey) {
            return previous;
          }

          // An explicit web-form edit made while the request was in flight
          // must not be overwritten. A schema replacement does not mark this
          // flag, so the selected company's saved header/UDF preferences still
          // load after the live SAP layout is available.
          if (previous.saveVersion > 0 || hasLocalChangesRef.current) {
            return {
              ...previous,
              loaded: true,
            };
          }

          if (hasBackendSettings && typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(storageKey, JSON.stringify(backendSettings));
          }

          return {
            storageKey,
            settings: readSettings(storageKey),
            loaded: true,
            saveVersion: 0,
            savedVersion: 0,
          };
        });
      })
      .catch((error) => {
        if (isCancelled) return;
        console.warn('[FORM_SETTINGS] Unable to load backend settings:', error?.message || error);
        setState((previous) => (
          previous.storageKey === storageKey
            ? { ...previous, loaded: true }
            : previous
        ));
      });

    return () => {
      isCancelled = true;
    };
  }, [baseStorageKey, readSettings, selectedCompanyId, selectedUserId, storageKey]);

  useEffect(() => {
    if (state.storageKey !== storageKey || typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    // Explicit mode keeps edits as a draft in component state. Do not let a
    // company switch or page close make an unsaved visibility choice appear
    // persisted in the browser cache.
    if (saveMode !== 'explicit' && state.loaded && state.saveVersion > 0) {
      window.localStorage.setItem(storageKey, JSON.stringify(state.settings));
    }

    if (saveMode === 'explicit' || !state.loaded || state.saveVersion <= state.savedVersion) return;

    const saveTimer = window.setTimeout(() => {
      const requestId = saveRequestRef.current + 1;
      const requestedVersion = state.saveVersion;
      saveRequestRef.current = requestId;
      setPersistence({ saving: true, error: '' });
      saveFormSettings(baseStorageKey, state.settings)
        .then((payload) => {
          if (!isFormSettingsPayloadForScope(
            payload,
            { companyId: selectedCompanyId },
            { userId: selectedUserId },
          )) {
            throw new Error('Ignored Form Settings save response for a different user or company.');
          }
          setState((previous) => (
            previous.storageKey === storageKey
              ? { ...previous, savedVersion: Math.max(previous.savedVersion || 0, requestedVersion) }
              : previous
          ));
          if (saveRequestRef.current === requestId) {
            setPersistence({ saving: false, error: '' });
          }
        })
        .catch((error) => {
          console.warn('[FORM_SETTINGS] Unable to save backend settings:', error?.message || error);
          if (saveRequestRef.current === requestId) {
            setPersistence({ saving: false, error: error?.message || 'Unable to save Form Settings.' });
          }
        });
    }, 250);

    return () => window.clearTimeout(saveTimer);
  }, [
    baseStorageKey,
    saveMode,
    selectedCompanyId,
    selectedUserId,
    state.loaded,
    state.savedVersion,
    state.saveVersion,
    state.settings,
    state.storageKey,
    storageKey,
  ]);

  const setScopedFormSettings = useCallback(
    (nextSettings) => {
      setState((previous) => {
        const isCurrentScope = previous.storageKey === storageKey;
        const currentSettings =
          isCurrentScope ? previous.settings : readSettings(storageKey);
        const resolvedSettings =
          typeof nextSettings === 'function' ? nextSettings(currentSettings) : nextSettings;
        const didChange = !areSettingsEqual(currentSettings, resolvedSettings);

        if (isCurrentScope && !didChange) {
          return previous;
        }

        return {
          storageKey,
          settings: resolvedSettings,
          loaded: isCurrentScope ? previous.loaded : false,
          saveVersion: didChange ? (isCurrentScope ? (previous.saveVersion || 0) + 1 : 1) : previous.saveVersion,
          savedVersion: isCurrentScope ? (previous.savedVersion || 0) : 0,
        };
      });
      hasLocalChangesRef.current = true;
    },
    [readSettings, storageKey],
  );

  const replaceScopedFormSettings = useCallback(
    (nextSettings) => {
      setState((previous) => {
        const isCurrentScope = previous.storageKey === storageKey;
        const currentSettings = isCurrentScope ? previous.settings : readSettings(storageKey);
        const resolvedSettings =
          typeof nextSettings === 'function' ? nextSettings(currentSettings) : nextSettings;

        if (isCurrentScope && !areSettingsEqual(currentSettings, resolvedSettings)) {
          return {
            ...previous,
            settings: resolvedSettings,
          };
        }

        if (isCurrentScope) return previous;

        return {
          storageKey,
          settings: resolvedSettings,
          loaded: false,
          saveVersion: 0,
          savedVersion: 0,
        };
      });
    },
    [readSettings, storageKey],
  );

  const saveScopedFormSettings = useCallback(async () => {
    const current = stateRef.current;
    if (!current || current.storageKey !== storageKey || !current.loaded) return false;
    if ((current.saveVersion || 0) <= (current.savedVersion || 0)) return true;

    const requestId = saveRequestRef.current + 1;
    const requestedVersion = current.saveVersion || 0;
    saveRequestRef.current = requestId;
    setPersistence({ saving: true, error: '' });

    try {
      const payload = await saveFormSettings(baseStorageKey, current.settings);
      if (!isFormSettingsPayloadForScope(
        payload,
        { companyId: selectedCompanyId },
        { userId: selectedUserId },
      )) {
        throw new Error('Ignored Form Settings save response for a different user or company.');
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKey, JSON.stringify(current.settings));
      }
      setState((previous) => (
        previous.storageKey === storageKey
          ? { ...previous, savedVersion: Math.max(previous.savedVersion || 0, requestedVersion) }
          : previous
      ));
      if (saveRequestRef.current === requestId) {
        setPersistence({ saving: false, error: '' });
      }
      return true;
    } catch (error) {
      console.warn('[FORM_SETTINGS] Unable to save backend settings:', error?.message || error);
      if (saveRequestRef.current === requestId) {
        setPersistence({ saving: false, error: error?.message || 'Unable to save Form Settings.' });
      }
      return false;
    }
  }, [baseStorageKey, selectedCompanyId, selectedUserId, storageKey]);

  const isCurrentScope = state.storageKey === storageKey;
  const formSettingsStatus = {
    loaded: isCurrentScope && state.loaded,
    loading: !isCurrentScope || !state.loaded,
    saving: persistence.saving,
    error: persistence.error,
    hasUnsavedChanges: isCurrentScope && state.saveVersion > state.savedVersion,
    saveMode,
    save: saveScopedFormSettings,
    scopeLabel: [
      normalizeScopePart(user?.username || user?.Username || selectedUserId),
      normalizeScopePart(company?.dbName || company?.companyName || company?.name || selectedCompanyId),
    ].filter(Boolean).join(' / '),
  };

  return [
    isCurrentScope ? state.settings : readSettings(storageKey),
    setScopedFormSettings,
    storageKey,
    replaceScopedFormSettings,
    formSettingsStatus,
  ];
};

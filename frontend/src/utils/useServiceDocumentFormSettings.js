import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCompanyScopedFormSettings } from './formSettingsStorage';
import {
  getSalesDocumentCompanyScopeKey,
  isSalesDocumentFieldMetadataReady,
} from './salesDocumentLiveFields';

/**
 * Keeps service-document Form Settings tied to both the authenticated company
 * and the company schema that produced the current matrix definitions.
 *
 * Schema hydration is a replacement, not a user edit. Visibility changes stay
 * as an explicit draft until the user presses Save in the Form Settings panel.
 */
const useServiceDocumentFormSettings = ({
  company,
  baseStorageKey,
  readSavedFormSettings,
  headerUdfDefinitions,
  rowUdfDefinitions,
  matrixColumnDefinitions,
}) => {
  const activeScope = useMemo(() => getSalesDocumentCompanyScopeKey({
    companyId: company?.companyId || '',
    companyDb: company?.dbName || '',
  }), [company?.companyId, company?.dbName]);
  const [hydratedScope, setHydratedScope] = useState('');
  const [
    formSettings,
    setFormSettings,
    formSettingsStorageKey,
    replaceFormSettings,
    formSettingsStatus,
  ] = useCompanyScopedFormSettings(
    baseStorageKey,
    readSavedFormSettings,
    [headerUdfDefinitions, rowUdfDefinitions, matrixColumnDefinitions],
    { saveMode: 'explicit' },
  );

  const formSettingsReady = formSettingsStatus.loaded && isSalesDocumentFieldMetadataReady({
    companyId: company?.companyId || '',
    companyDb: company?.dbName || '',
    hydratedScope,
  });

  const clearMetadataScope = useCallback(() => {
    setHydratedScope('');
  }, []);

  const hydrateFormSettings = useCallback((headerUdfs, rowUdfs, matrixColumns) => {
    replaceFormSettings(readSavedFormSettings(
      headerUdfs,
      rowUdfs,
      matrixColumns,
      formSettingsStorageKey,
    ));
    setHydratedScope(activeScope);
  }, [activeScope, formSettingsStorageKey, readSavedFormSettings, replaceFormSettings]);

  useEffect(() => {
    if (!formSettingsReady || formSettingsStatus.hasUnsavedChanges) return;
    replaceFormSettings(readSavedFormSettings(
      headerUdfDefinitions,
      rowUdfDefinitions,
      matrixColumnDefinitions,
      formSettingsStorageKey,
    ));
  }, [
    formSettingsReady,
    formSettingsStatus.hasUnsavedChanges,
    formSettingsStorageKey,
    headerUdfDefinitions,
    matrixColumnDefinitions,
    readSavedFormSettings,
    replaceFormSettings,
    rowUdfDefinitions,
  ]);

  return {
    formSettings,
    setFormSettings,
    formSettingsStatus,
    formSettingsReady,
    hydrateFormSettings,
    clearMetadataScope,
  };
};

export default useServiceDocumentFormSettings;

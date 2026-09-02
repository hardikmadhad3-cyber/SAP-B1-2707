import { mergeSavedFormSettings } from './formSettingsPreferences';

const buildVisibilitySettings = (definitions = []) => (
  (definitions || []).reduce((settings, field) => {
    if (!field?.key) return settings;
    const active = field.active !== undefined
      ? field.active !== false
      : field.editable !== false && !field.readOnly;
    settings[field.key] = {
      visible: field.visible !== false,
      active,
      sapControlled: Boolean(field.sapControlled),
      order: Number(field.columnOrder ?? field.order) || undefined,
      minWidth: Number(field.minWidth ?? field.width) || undefined,
    };
    return settings;
  }, {})
);

export const createServiceDocumentFormSettings = (
  headerUdfs = [],
  rowUdfs = [],
  matrixColumns = [],
) => ({
  matrixColumns: buildVisibilitySettings(matrixColumns),
  headerUdfs: buildVisibilitySettings(headerUdfs),
  rowUdfs: buildVisibilitySettings(rowUdfs),
});

export const readServiceDocumentFormSettings = ({
  headerUdfs = [],
  rowUdfs = [],
  matrixColumns = [],
  storageKey,
} = {}) => {
  const defaults = createServiceDocumentFormSettings(headerUdfs, rowUdfs, matrixColumns);
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    return mergeSavedFormSettings(defaults, JSON.parse(raw));
  } catch (_error) {
    return defaults;
  }
};

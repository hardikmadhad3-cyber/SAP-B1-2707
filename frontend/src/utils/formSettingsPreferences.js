const DEFAULT_EDITABLE_SAP_CONTROLLED_GROUPS = Object.freeze([
  'matrixColumns',
  'rowUdfs',
]);

const USER_EDITABLE_PROPERTIES = new Set(['visible', 'active']);

const isRecord = (value) => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const hasOwn = (record, key) => Object.prototype.hasOwnProperty.call(record, key);

const getEditableGroupSet = (groups) => new Set(
  Array.isArray(groups) ? groups : DEFAULT_EDITABLE_SAP_CONTROLLED_GROUPS,
);

const getSavedVisibility = (savedEntry = {}) => (
  typeof savedEntry.visible === 'boolean' ? { visible: savedEntry.visible } : {}
);

/**
 * Reconciles persisted web preferences with the active company's live schema.
 *
 * The live defaults are the physical-field allowlist and remain authoritative
 * for activity, ordering, and width. A signed-in user may override only
 * visibility for current matrix/row-UDF fields (including the SAP-standard
 * fallback) without reviving stale fields from another company or layout.
 */
export const mergeSavedFormSettings = (
  defaults = {},
  saved = {},
  { editableSapControlledGroups = DEFAULT_EDITABLE_SAP_CONTROLLED_GROUPS } = {},
) => {
  const safeDefaults = isRecord(defaults) ? defaults : {};
  const safeSaved = isRecord(saved) ? saved : {};
  const editableGroups = getEditableGroupSet(editableSapControlledGroups);

  return Object.keys(safeDefaults).reduce((settings, groupKey) => {
    const defaultGroup = isRecord(safeDefaults[groupKey]) ? safeDefaults[groupKey] : {};
    const savedGroup = isRecord(safeSaved[groupKey]) ? safeSaved[groupKey] : {};

    settings[groupKey] = Object.keys(defaultGroup).reduce((group, fieldKey) => {
      const defaultEntry = isRecord(defaultGroup[fieldKey]) ? defaultGroup[fieldKey] : {};
      const savedEntry = isRecord(savedGroup[fieldKey]) ? savedGroup[fieldKey] : {};
      const savedPreferences = editableGroups.has(groupKey)
        ? getSavedVisibility(savedEntry)
        : (defaultEntry.sapControlled ? {} : savedEntry);

      group[fieldKey] = {
        ...defaultEntry,
        ...savedPreferences,
        sapControlled: Boolean(defaultEntry.sapControlled),
        order: defaultEntry.order,
        minWidth: defaultEntry.minWidth,
      };
      return group;
    }, {});

    return settings;
  }, {});
};

/**
 * Applies one Form Settings edit without allowing the UI to manufacture a
 * field that is absent from the active company's reconciled settings.
 */
export const updateFormSettingPreference = (
  settings,
  groupKey,
  fieldKey,
  property,
  value,
  { editableSapControlledGroups = DEFAULT_EDITABLE_SAP_CONTROLLED_GROUPS } = {},
) => {
  if (
    !isRecord(settings)
    || !USER_EDITABLE_PROPERTIES.has(property)
    || typeof value !== 'boolean'
  ) return settings;

  const group = settings[groupKey];
  if (!isRecord(group) || !hasOwn(group, fieldKey) || !isRecord(group[fieldKey])) return settings;

  const current = group[fieldKey];
  const editableGroups = getEditableGroupSet(editableSapControlledGroups);
  if (editableGroups.has(groupKey) && property !== 'visible') return settings;
  if (current.sapControlled && !editableGroups.has(groupKey)) return settings;

  if (current[property] === value) return settings;

  return {
    ...settings,
    [groupKey]: {
      ...group,
      [fieldKey]: {
        ...current,
        [property]: value,
      },
    },
  };
};

export { DEFAULT_EDITABLE_SAP_CONTROLLED_GROUPS };

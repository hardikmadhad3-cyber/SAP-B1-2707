const DEFAULT_EDITABLE_SAP_CONTROLLED_GROUPS = Object.freeze([
  'matrixColumns',
  'rowUdfs',
]);

const USER_EDITABLE_PROPERTIES = new Set(['visible', 'active', 'order']);

const isRecord = (value) => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const hasOwn = (record, key) => Object.prototype.hasOwnProperty.call(record, key);

const getEditableGroupSet = (groups) => new Set(
  Array.isArray(groups) ? groups : DEFAULT_EDITABLE_SAP_CONTROLLED_GROUPS,
);

const getSavedLinePreferences = (savedEntry = {}) => {
  const preferences = typeof savedEntry.visible === 'boolean'
    ? { visible: savedEntry.visible }
    : {};
  const order = Number(savedEntry.order);
  if (Number.isFinite(order) && order >= 0) preferences.order = order;
  return preferences;
};

const buildReconciledLineOrderMap = (defaults, saved, editableGroups) => {
  const fields = [];
  Object.keys(defaults).forEach((groupKey) => {
    if (!editableGroups.has(groupKey)) return;
    const defaultGroup = isRecord(defaults[groupKey]) ? defaults[groupKey] : {};
    const savedGroup = isRecord(saved[groupKey]) ? saved[groupKey] : {};
    Object.keys(defaultGroup).forEach((fieldKey) => {
      const savedOrder = Number(savedGroup[fieldKey]?.order);
      const defaultOrder = Number(defaultGroup[fieldKey]?.order);
      fields.push({
        identity: `${groupKey}:${fieldKey}`,
        sourceIndex: fields.length,
        savedOrder: Number.isFinite(savedOrder) && savedOrder >= 0 ? savedOrder : null,
        defaultOrder: Number.isFinite(defaultOrder) ? defaultOrder : Number.MAX_SAFE_INTEGER,
      });
    });
  });
  const savedFields = fields
    .filter((field) => field.savedOrder !== null)
    .sort((left, right) => left.savedOrder - right.savedOrder || left.sourceIndex - right.sourceIndex);
  const savedIdentities = new Set(savedFields.map((field) => field.identity));
  const newFields = fields
    .filter((field) => !savedIdentities.has(field.identity))
    .sort((left, right) => left.defaultOrder - right.defaultOrder || left.sourceIndex - right.sourceIndex);
  return new Map([...savedFields, ...newFields].map((field, index) => [field.identity, index + 1]));
};

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
  const lineOrderMap = buildReconciledLineOrderMap(safeDefaults, safeSaved, editableGroups);

  return Object.keys(safeDefaults).reduce((settings, groupKey) => {
    const defaultGroup = isRecord(safeDefaults[groupKey]) ? safeDefaults[groupKey] : {};
    const savedGroup = isRecord(safeSaved[groupKey]) ? safeSaved[groupKey] : {};

    settings[groupKey] = Object.keys(defaultGroup).reduce((group, fieldKey) => {
      const defaultEntry = isRecord(defaultGroup[fieldKey]) ? defaultGroup[fieldKey] : {};
      const savedEntry = isRecord(savedGroup[fieldKey]) ? savedGroup[fieldKey] : {};
      const savedPreferences = editableGroups.has(groupKey)
        ? getSavedLinePreferences(savedEntry)
        : (defaultEntry.sapControlled ? {} : savedEntry);

      group[fieldKey] = {
        ...defaultEntry,
        ...savedPreferences,
        sapControlled: Boolean(defaultEntry.sapControlled),
        order: editableGroups.has(groupKey)
          ? lineOrderMap.get(`${groupKey}:${fieldKey}`)
          : defaultEntry.order,
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
    || (property !== 'order' && typeof value !== 'boolean')
    || (property === 'order' && (!Number.isFinite(Number(value)) || Number(value) < 0))
  ) return settings;

  const group = settings[groupKey];
  if (!isRecord(group) || !hasOwn(group, fieldKey) || !isRecord(group[fieldKey])) return settings;

  const current = group[fieldKey];
  const editableGroups = getEditableGroupSet(editableSapControlledGroups);
  if (editableGroups.has(groupKey) && !['visible', 'order'].includes(property)) return settings;
  if (current.sapControlled && !editableGroups.has(groupKey)) return settings;

  if (current[property] === value) return settings;

  return {
    ...settings,
    [groupKey]: {
      ...group,
      [fieldKey]: {
        ...current,
        [property]: property === 'order' ? Number(value) : value,
      },
    },
  };
};

export { DEFAULT_EDITABLE_SAP_CONTROLLED_GROUPS };

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const numberOrNull = (value) => {
  if (!hasValue(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const isBaseDocumentLine = (line = {}) => (
  hasValue(line.baseType) && hasValue(line.baseEntry) && hasValue(line.baseLine)
);

export const isManualUomGroup = (group = {}) => (
  group.isManual === true
  || (numberOrNull(group.AbsEntry) !== null && numberOrNull(group.AbsEntry) <= 0)
  || String(group.Name || '').trim().toUpperCase() === 'MANUAL'
);

export const getUomGroup = (groups = [], entry) => (
  (groups || []).find((group) => String(group.AbsEntry) === String(entry)) || null
);

export const getStructuredUoms = (group = {}) => {
  if (Array.isArray(group.uoms) && group.uoms.length) return group.uoms;
  return (group.uomCodes || []).map((uomCode) => {
    const conversion = group.conversions?.[uomCode] || {};
    return {
      uomEntry: null,
      uomCode,
      uomName: uomCode,
      baseQty: conversion.baseQty || 1,
      altQty: conversion.altQty || 1,
      factor: conversion.factor || 1,
    };
  });
};

export const getItemUomGroup = (item = {}, groups = []) => (
  getUomGroup(groups, item.UoMGroupEntry ?? item.UgpEntry)
);

export const getItemDefaultUom = (item = {}, groups = [], side = 'sales') => {
  const group = getItemUomGroup(item, groups);
  const itemGroupEntry = numberOrNull(item.UoMGroupEntry ?? item.UgpEntry);
  const manual = group ? isManualUomGroup(group) : (itemGroupEntry !== null && itemGroupEntry <= 0);
  const rawEntry = side === 'purchase'
    ? (item.PurchaseUomEntry ?? item.PUoMEntry)
    : (item.SalesUomEntry ?? item.SUoMEntry);
  const rawCode = side === 'purchase'
    ? (item.PurchaseUomCode ?? item.PurchaseUoMCode ?? item.PurchaseUnit)
    : (item.SalesUomCode ?? item.SalesUoMCode ?? item.SalesUnit);
  const rawName = side === 'purchase'
    ? (item.PurchaseUomName ?? item.PurchaseUoMName ?? item.PurchaseUnit)
    : (item.SalesUomName ?? item.SalesUoMName ?? item.SalesUnit);

  if (manual) {
    const name = String(rawName || rawCode || item.InventoryUOM || '').trim();
    return {
      uomGroupEntry: item.UoMGroupEntry ?? item.UgpEntry ?? group?.AbsEntry ?? -1,
      uomEntry: -1,
      uomCode: 'Manual',
      uomName: name,
      uomFactor: 1,
      uomNameEdited: false,
    };
  }

  const options = getStructuredUoms(group || {});
  const entry = numberOrNull(rawEntry);
  const normalizedCode = String(rawCode || '').trim().toUpperCase();
  const normalizedName = String(rawName || '').trim().toUpperCase();
  const selected = options.find((option) => numberOrNull(option.uomEntry) === entry)
    || options.find((option) => [option.uomCode, option.uomName]
      .some((value) => [normalizedCode, normalizedName].includes(String(value || '').trim().toUpperCase())))
    || options[0]
    || null;

  return {
    uomGroupEntry: item.UoMGroupEntry ?? item.UgpEntry ?? group?.AbsEntry ?? null,
    uomEntry: selected ? numberOrNull(selected.uomEntry) : entry,
    uomCode: String(selected?.uomCode || rawCode || '').trim(),
    uomName: String(selected?.uomName || rawName || rawCode || '').trim(),
    uomFactor: Number(selected?.factor || 1),
    uomNameEdited: false,
  };
};

export const getLineUomOptions = (line = {}, item = {}, groups = []) => {
  const group = getItemUomGroup(item, groups) || getUomGroup(groups, line.uomGroupEntry);
  const options = getStructuredUoms(group || {});
  if (isManualUomGroup(group || {})) {
    return options.length ? options : [{ uomEntry: -1, uomCode: 'Manual', uomName: 'Manual', factor: 1 }];
  }
  if (line.uomCode && !options.some((option) => String(option.uomCode) === String(line.uomCode))) {
    return [...options, {
      uomEntry: numberOrNull(line.uomEntry),
      uomCode: line.uomCode,
      uomName: line.uomName || line.uomCode,
      factor: Number(line.uomFactor || 1),
    }];
  }
  return options;
};

export const applyUomCodeSelection = (line = {}, value, options = []) => {
  const selected = (options || []).find((option) => String(option.uomCode) === String(value));
  const manual = String(value || '').trim().toUpperCase() === 'MANUAL'
    || (selected && numberOrNull(selected.uomEntry) < 0);
  return {
    ...line,
    uomEntry: manual ? -1 : numberOrNull(selected?.uomEntry),
    uomCode: manual ? 'Manual' : String(selected?.uomCode || value || '').trim(),
    uomName: manual
      ? (line.uomName && String(line.uomName).toUpperCase() !== 'MANUAL' ? line.uomName : '')
      : String(selected?.uomName || value || '').trim(),
    uomFactor: Number(selected?.factor || 1),
    uomNameEdited: false,
  };
};

export const canEditUomCode = (line = {}, item = {}, groups = [], pageEditable = true) => {
  if (!pageEditable || isBaseDocumentLine(line)) return false;
  return !isManualUomGroup(getItemUomGroup(item, groups) || getUomGroup(groups, line.uomGroupEntry) || {});
};

export const canEditUomName = (line = {}, item = {}, groups = [], pageEditable = true) => {
  if (!pageEditable || isBaseDocumentLine(line)) return false;
  return isManualUomGroup(getItemUomGroup(item, groups) || getUomGroup(groups, line.uomGroupEntry) || {});
};

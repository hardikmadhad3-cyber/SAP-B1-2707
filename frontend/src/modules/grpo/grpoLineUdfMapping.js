import { GRPO_LINE_UDF_FIELD_MAP } from '../../config/grpoForm';
import { buildVisibleEnteredRowUdfPayload } from '../../utils/rowUdfPayload';

export const normalizeUdfLookupKey = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^U_/, '')
    .replace(/[^A-Z0-9]+/g, '');

export const getFirstLineValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value) !== '') return value;
  }
  return '';
};

export const buildUdfKeyLookup = (rowUdfDefinitions = []) => {
  const lookup = new Map();

  (rowUdfDefinitions || []).forEach((field) => {
    const candidates = [
      field?.key,
      field?.sapField,
      field?.aliasId,
      field?.label,
      field?.description,
      field?.Descr,
    ];

    candidates.forEach((candidate) => {
      const token = normalizeUdfLookupKey(candidate);
      if (field?.key && token && !lookup.has(token)) {
        lookup.set(token, field.key);
      }
    });
  });

  return lookup;
};

export const resolveUdfDefinitionKey = (targetKey, rowUdfDefinitions = []) => {
  const targets = Array.isArray(targetKey) ? targetKey : [targetKey];
  const lookup = buildUdfKeyLookup(rowUdfDefinitions);

  for (const target of targets) {
    const token = normalizeUdfLookupKey(target);
    if (!token) continue;
    const matched = lookup.get(token);
    if (matched) return matched;
  }

  return '';
};

export const getMappedLineKeyForUdf = (udfKey, rowUdfDefinitions = []) => {
  const udfToken = normalizeUdfLookupKey(udfKey);
  if (!udfToken) return '';

  for (const [lineKey, configuredUdfKeys] of Object.entries(GRPO_LINE_UDF_FIELD_MAP)) {
    const aliases = Array.isArray(configuredUdfKeys) ? configuredUdfKeys : [configuredUdfKeys];
    const actualUdfKey = resolveUdfDefinitionKey(aliases, rowUdfDefinitions);
    if (
      normalizeUdfLookupKey(actualUdfKey) === udfToken ||
      aliases.some((alias) => normalizeUdfLookupKey(alias) === udfToken)
    ) {
      return lineKey;
    }
  }

  return '';
};

export const synchronizeGRPOLineUdfChange = (
  line = {},
  udfKey,
  value,
  rowUdfDefinitions = [],
) => {
  const lineKey = getMappedLineKeyForUdf(udfKey, rowUdfDefinitions);
  return {
    ...line,
    ...(lineKey ? { [lineKey]: value } : {}),
    udf: { ...(line.udf || {}), [udfKey]: value },
  };
};

export const synchronizeGRPOLineFieldChange = (
  line = {},
  lineKey,
  value,
  rowUdfDefinitions = [],
) => {
  const configuredUdfKeys = GRPO_LINE_UDF_FIELD_MAP[lineKey];
  if (!configuredUdfKeys) return { ...line, [lineKey]: value };

  const actualUdfKey = resolveUdfDefinitionKey(configuredUdfKeys, rowUdfDefinitions);
  return {
    ...line,
    [lineKey]: value,
    ...(actualUdfKey
      ? { udf: { ...(line.udf || {}), [actualUdfKey]: value } }
      : {}),
  };
};

export const getLineUdfValue = (line = {}, aliases = []) => {
  const normalizedAliases = Array.isArray(aliases) ? aliases : [aliases];
  const aliasTokens = new Set(normalizedAliases.map(normalizeUdfLookupKey).filter(Boolean));
  if (!aliasTokens.size) return '';

  const containers = [line.udf, line.line_udfs, line.lineUdfs, line];
  for (const source of containers) {
    const isDirectLineSource = source === line;
    const entries = Object.entries(source || {});
    const match = entries.find(([key, value]) =>
      (!isDirectLineSource || String(key || '').trim().toUpperCase().startsWith('U_')) &&
      aliasTokens.has(normalizeUdfLookupKey(key)) &&
      value !== undefined &&
      value !== null &&
      String(value) !== ''
    );
    if (match) return match[1];
  }

  return '';
};

export const hydrateGRPOLineUdfFields = (line = {}) => {
  const next = { ...line };

  Object.entries(GRPO_LINE_UDF_FIELD_MAP).forEach(([lineKey, udfKey]) => {
    const value = getLineUdfValue(line, udfKey);
    if (value !== undefined && value !== null && String(value) !== '') {
      next[lineKey] = getFirstLineValue(next[lineKey], value);
    }
  });

  next.sellerPaymentTermsDuplicate = getFirstLineValue(
    next.sellerPaymentTermsDuplicate,
    next.sellerPaymentTerms,
  );

  return next;
};

export const buildGRPOLineUdfPayload = (line = {}, rowUdfDefinitions = [], formSettings = {}) => {
  const udf = buildVisibleEnteredRowUdfPayload(rowUdfDefinitions, line.udf || {}, formSettings);

  Object.entries(GRPO_LINE_UDF_FIELD_MAP).forEach(([lineKey, configuredUdfKey]) => {
    const actualUdfKey = resolveUdfDefinitionKey(configuredUdfKey, rowUdfDefinitions);

    const value = lineKey === 'sellerPaymentTermsDuplicate'
      ? getFirstLineValue(line.sellerPaymentTermsDuplicate, line.sellerPaymentTerms)
      : line[lineKey];

    if (actualUdfKey && value !== undefined && value !== null && String(value).trim() !== '') {
      udf[actualUdfKey] = value;
    }
  });

  return udf;
};

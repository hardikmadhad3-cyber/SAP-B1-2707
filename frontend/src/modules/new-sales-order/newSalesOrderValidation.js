import {
  getNewSalesOrderFieldBucket,
  getNewSalesOrderFieldKey,
  normalizeNewSalesOrderDefaultValue,
  readNewSalesOrderFieldValue,
} from './newSalesOrderState';
import {
  NEW_SALES_ORDER_HEADER_TABLE,
  NEW_SALES_ORDER_LINE_TABLE,
} from './newSalesOrderConstants';

const isEmpty = (value) => value === '' || value === undefined || value === null;
const normalizeType = (field) => String(field?.type || field?.renderer || 'text').trim().toLowerCase();

const isValidCalendarDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').split('T')[0]);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const validateNumericValue = (field, value) => {
  const raw = String(value).trim();
  const type = normalizeType(field);
  const pattern = type === 'integer' ? /^-?\d+$/ : /^-?(?:\d+\.?\d*|\.\d+)$/;
  if (!pattern.test(raw) || !Number.isFinite(Number(raw))) return type === 'integer' ? 'Enter a whole number.' : 'Enter a valid number.';

  const [integerPart, fractionPart = ''] = raw.replace(/^-/, '').split('.');
  const scale = field.scale === undefined || field.scale === null ? null : Math.max(0, Number(field.scale) || 0);
  const precision = field.precision === undefined || field.precision === null ? null : Math.max(0, Number(field.precision) || 0);
  if (type === 'integer' && fractionPart.length) return 'Decimal values are not allowed.';
  if (scale !== null && fractionPart.length > scale) return `Use no more than ${scale} decimal place${scale === 1 ? '' : 's'}.`;
  if (precision !== null && `${integerPart}${fractionPart}`.replace(/^0+/, '').length > precision) return `Use no more than ${precision} digits.`;

  const parsed = Number(raw);
  if (field.minimum !== undefined && field.minimum !== null && parsed < Number(field.minimum)) return `Value must be at least ${field.minimum}.`;
  if (field.maximum !== undefined && field.maximum !== null && parsed > Number(field.maximum)) return `Value must be at most ${field.maximum}.`;
  return '';
};

const normalizeOptionValue = (option) => String(typeof option === 'object' ? option?.value ?? '' : option ?? '');

const validateKnownKeys = (record = {}, fields = {}) => {
  const errors = {};
  ['values', 'udf'].forEach((bucket) => {
    const allowed = fields[bucket];
    Object.keys(record?.[bucket] || {}).forEach((key) => {
      if (!allowed.has(key)) errors[key] = 'Unknown field for the active company schema.';
    });
  });
  return errors;
};

const buildAllowedKeys = (fields = []) => (
  fields.reduce((allowed, field) => {
    const key = getNewSalesOrderFieldKey(field);
    if (key) allowed[getNewSalesOrderFieldBucket(field)].add(key);
    return allowed;
  }, { values: new Set(), udf: new Set() })
);

const validateRecord = (record, fields, { expectedTable, lookupStates = {} } = {}) => {
  const errors = validateKnownKeys(record, buildAllowedKeys(fields));

  (fields || []).forEach((field) => {
    const key = getNewSalesOrderFieldKey(field);
    if (!key) return;
    const value = readNewSalesOrderFieldValue(record, field);
    const label = field.label || key;
    const tableName = String(field.tableName || '').toUpperCase();
    if (tableName && tableName !== expectedTable) {
      errors[key] = `${label} does not belong to ${expectedTable}.`;
      return;
    }
    if (field.required && isEmpty(value)) {
      errors[key] = `${label} is required.`;
      return;
    }
    if (isEmpty(value)) return;

    const storage = String(field.storage || '').toLowerCase();
    if (field.editable === false || field.readOnly || storage === 'display-only' || storage === 'calculated') {
      const defaultValue = normalizeNewSalesOrderDefaultValue(field);
      if (String(value) !== String(defaultValue)) errors[key] = `${label} is read-only.`;
      return;
    }

    const type = normalizeType(field);
    if (type === 'number' || type === 'integer') {
      const numericError = validateNumericValue(field, value);
      if (numericError) errors[key] = numericError;
    } else if (type === 'date' && !isValidCalendarDate(value)) {
      errors[key] = 'Enter a valid date in YYYY-MM-DD format.';
    } else if ((type === 'text' || type === 'textarea') && Number(field.maxLength || field.length) > 0 && String(value).length > Number(field.maxLength || field.length)) {
      errors[key] = `Use no more than ${field.maxLength || field.length} characters.`;
    }

    const renderer = String(field.renderer || '').toLowerCase();
    const declaredOptions = Array.isArray(field.options) ? field.options : [];
    const loadedOptions = lookupStates[field.id]?.items || lookupStates[key]?.items || [];
    const options = declaredOptions.length ? declaredOptions : loadedOptions;
    if ((type === 'select' || renderer === 'select') && options.length && !options.some((option) => normalizeOptionValue(option) === String(value))) {
      errors[key] = `${label} is not a valid option for the active company.`;
    }
    if ((type === 'lookup' || renderer === 'lookup' || renderer === 'item-lookup') && loadedOptions.length && !loadedOptions.some((option) => normalizeOptionValue(option) === String(value))) {
      errors[key] = `${label} is not a valid lookup value for the active company.`;
    }
  });

  return errors;
};

export const isNewSalesOrderLineEmpty = (line = {}) => (
  [...Object.values(line.values || {}), ...Object.values(line.udf || {})]
    .every((value) => isEmpty(value) || value === false)
);

export const validateNewSalesOrderForm = ({ schema, formData, lookups = {} } = {}) => {
  const form = [];
  if (!schema?.schemaVersion) form.push('A current company schema is required.');

  const header = validateRecord(formData?.header || {}, schema?.headerFields || [], {
    expectedTable: NEW_SALES_ORDER_HEADER_TABLE,
    lookupStates: lookups,
  });

  const populatedLines = (formData?.lines || []).filter((line) => !isNewSalesOrderLineEmpty(line));
  if (!populatedLines.length) form.push('Add at least one document line.');

  const lines = {};
  populatedLines.forEach((line) => {
    const scopedLookups = Object.entries(lookups || {}).reduce((next, [lookupKey, lookupState]) => {
      const prefix = `${line.localLineId}:`;
      if (lookupKey.startsWith(prefix)) next[lookupKey.slice(prefix.length)] = lookupState;
      else if (!lookupKey.includes(':')) next[lookupKey] = lookupState;
      return next;
    }, {});
    const lineErrors = validateRecord(line, schema?.lineFields || [], {
      expectedTable: NEW_SALES_ORDER_LINE_TABLE,
      lookupStates: scopedLookups,
    });
    if (Object.keys(lineErrors).length) lines[line.localLineId] = lineErrors;
  });

  const errors = { form, header, lines };
  return {
    valid: !form.length && !Object.keys(header).length && !Object.keys(lines).length,
    errors,
  };
};

export const normalizeNewSalesOrderServerErrors = (serverErrors, formData = {}) => {
  if (!Array.isArray(serverErrors)) {
    return {
      form: Array.isArray(serverErrors?.form) ? serverErrors.form : (serverErrors?.form ? [String(serverErrors.form)] : []),
      header: serverErrors?.header || {},
      lines: serverErrors?.lines || {},
    };
  }

  return serverErrors.reduce((normalized, error) => {
    const message = String(error?.message || 'Validation failed.');
    const path = String(error?.path || '');
    const headerMatch = /^formData\.header\.(?:values|udf)\.([^.[\]]+)$/.exec(path);
    if (headerMatch) {
      normalized.header[headerMatch[1]] = message;
      return normalized;
    }

    const lineMatch = /^formData\.lines\[(\d+)\]\.(?:values|udf)\.([^.[\]]+)$/.exec(path);
    if (lineMatch) {
      const lineIndex = Number(lineMatch[1]);
      const lineId = formData?.lines?.[lineIndex]?.localLineId || String(lineIndex);
      normalized.lines[lineId] = {
        ...(normalized.lines[lineId] || {}),
        [lineMatch[2]]: message,
      };
      return normalized;
    }

    normalized.form.push(message);
    return normalized;
  }, { form: [], header: {}, lines: {} });
};

export { isValidCalendarDate, validateNumericValue };

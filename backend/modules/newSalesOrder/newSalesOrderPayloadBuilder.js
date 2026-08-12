const {
  HEADER_TABLE,
  LINE_TABLE,
  isEmptyValue,
  isUdfField,
  normalizeCheckbox,
} = require('./newSalesOrderValidationService');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const text = (value) => String(value ?? '').trim();

const serializeFieldValue = (field, value) => {
  if (isEmptyValue(value)) {
    return field.required ? undefined : null;
  }

  const type = text(field.type || field.renderer || 'text').toLowerCase();
  if (type === 'number' || type === 'integer') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (type === 'checkbox' || type === 'boolean') {
    return normalizeCheckbox(value) ? 'tYES' : 'tNO';
  }
  if (type === 'date') {
    return String(value).split('T')[0];
  }
  return String(value).trim();
};

const isPayloadField = (field, tableName) => {
  const storage = text(field.storage).toLowerCase();
  const fieldTable = text(field.tableName || tableName).toUpperCase();
  return fieldTable === tableName
    && Boolean(text(field.sapField))
    && !['calculated', 'display-only', 'display_only'].includes(storage);
};

const getCanonicalValue = (field, canonicalGroup) => {
  const bucket = isUdfField(field) ? canonicalGroup?.udf : canonicalGroup?.values;
  const key = isUdfField(field) ? field.sapField : (field.stateKey || field.sapField);
  return {
    present: hasOwn(bucket, key),
    value: bucket?.[key],
  };
};

const buildPayloadSection = (fields, canonicalGroup, tableName) => {
  const payload = {};
  const usedSapFields = new Set();
  for (const field of fields || []) {
    if (!isPayloadField(field, tableName)) continue;
    const sapField = text(field.sapField);
    const normalizedSapField = sapField.toUpperCase();
    if (usedSapFields.has(normalizedSapField)) {
      const error = new Error(`Duplicate SAP payload field ${sapField}.`);
      error.statusCode = 500;
      error.code = 'INVALID_SCHEMA';
      throw error;
    }
    usedSapFields.add(normalizedSapField);

    const canonicalValue = getCanonicalValue(field, canonicalGroup);
    if (!canonicalValue.present) continue;
    const serialized = serializeFieldValue(field, canonicalValue.value);
    if (serialized !== undefined) payload[sapField] = serialized;
  }
  return payload;
};

const buildNewSalesOrderPayload = ({ schema, canonicalFormData } = {}) => {
  if (!schema || !canonicalFormData) {
    const error = new Error('schema and canonicalFormData are required.');
    error.statusCode = 500;
    throw error;
  }

  return {
    ...buildPayloadSection(schema.headerFields, canonicalFormData.header, HEADER_TABLE),
    DocumentLines: (canonicalFormData.lines || []).map((line) =>
      buildPayloadSection(schema.lineFields, line, LINE_TABLE)),
  };
};

module.exports = {
  buildNewSalesOrderPayload,
  buildPayloadSection,
  serializeFieldValue,
};

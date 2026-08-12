import {
  getNewSalesOrderFieldKey,
  readNewSalesOrderFieldValue,
} from './newSalesOrderState';
import { isNewSalesOrderLineEmpty } from './newSalesOrderValidation';
import {
  NEW_SALES_ORDER_HEADER_TABLE,
  NEW_SALES_ORDER_LINE_TABLE,
} from './newSalesOrderConstants';

const emptyValue = (value) => value === '' || value === undefined || value === null;

export const serializeNewSalesOrderFieldValue = (field = {}, value) => {
  if (emptyValue(value)) return field.required ? undefined : null;

  const type = String(field.type || field.renderer || 'text').toLowerCase();
  if (type === 'number' || type === 'integer') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    if (type === 'integer' && !Number.isInteger(parsed)) return undefined;
    return parsed;
  }
  if (type === 'checkbox') {
    const checked = value === true || ['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value).trim().toUpperCase());
    return checked ? 'tYES' : 'tNO';
  }
  if (type === 'date') return String(value).split('T')[0];
  return String(value).trim();
};

const canSerializeField = (field, expectedTable) => {
  const tableName = String(field?.tableName || '').toUpperCase();
  const storage = String(field?.storage || 'standard').toLowerCase();
  return Boolean(field?.sapField)
    && (!tableName || tableName === expectedTable)
    && storage !== 'calculated'
    && storage !== 'display-only';
};

const serializeRecord = (record, fields, expectedTable) => (
  (fields || []).reduce((payload, field) => {
    if (!canSerializeField(field, expectedTable)) return payload;
    const stateKey = getNewSalesOrderFieldKey(field);
    if (!stateKey) return payload;
    const serialized = serializeNewSalesOrderFieldValue(field, readNewSalesOrderFieldValue(record, field));
    if (serialized !== undefined) payload[field.sapField] = serialized;
    return payload;
  }, {})
);

export const buildNewSalesOrderDummyPayload = (schema = {}, formData = {}) => ({
  ...serializeRecord(formData.header || {}, schema.headerFields || [], NEW_SALES_ORDER_HEADER_TABLE),
  DocumentLines: (formData.lines || [])
    .filter((line) => !isNewSalesOrderLineEmpty(line))
    .map((line) => serializeRecord(line, schema.lineFields || [], NEW_SALES_ORDER_LINE_TABLE)),
});

export const stripNewSalesOrderFormErrors = (formData = {}) => ({
  header: {
    values: { ...(formData.header?.values || {}) },
    udf: { ...(formData.header?.udf || {}) },
  },
  lines: (formData.lines || [])
    .filter((line) => !isNewSalesOrderLineEmpty(line))
    .map((line) => ({
      localLineId: line.localLineId,
      values: { ...(line.values || {}) },
      udf: { ...(line.udf || {}) },
    })),
});

export const buildNewSalesOrderRequest = (schema, formData) => ({
  schemaVersion: String(schema?.schemaVersion || ''),
  formData: stripNewSalesOrderFormErrors(formData),
});

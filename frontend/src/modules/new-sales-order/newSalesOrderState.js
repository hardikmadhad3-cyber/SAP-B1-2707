import {
  NEW_SALES_ORDER_DOCUMENT_TYPE,
  NEW_SALES_ORDER_OBJECT_TYPE,
} from './newSalesOrderConstants';
import {
  getSalesDocumentFieldKey,
  normalizeSalesDocumentSchema,
} from '../../utils/salesDocumentSchema';

let fallbackLineSequence = 0;

export const getNewSalesOrderFieldKey = getSalesDocumentFieldKey;

export const isNewSalesOrderUdfField = (field = {}) => {
  const storage = String(field.storage || '').trim().toLowerCase();
  const sapField = String(field.sapField || field.databaseField || field.stateKey || '');
  return storage === 'udf' || sapField.toUpperCase().startsWith('U_');
};

export const getNewSalesOrderFieldBucket = (field = {}) => (
  isNewSalesOrderUdfField(field) ? 'udf' : 'values'
);

export const readNewSalesOrderFieldValue = (record = {}, field = {}) => {
  const key = getNewSalesOrderFieldKey(field);
  return record?.[getNewSalesOrderFieldBucket(field)]?.[key] ?? '';
};

const isTruthyCheckbox = (value) => (
  value === true || ['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value || '').trim().toUpperCase())
);

export const normalizeNewSalesOrderDefaultValue = (field = {}) => {
  const value = field.defaultValue;
  if (value === undefined || value === null) return field.type === 'checkbox' ? false : '';

  const type = String(field.type || field.renderer || '').toLowerCase();
  if (type === 'checkbox') return isTruthyCheckbox(value);
  if (type === 'date') return String(value).split('T')[0];
  if (type === 'number' || type === 'integer') return String(value);
  return String(value);
};

export const createNewSalesOrderRecord = (fields = []) => (
  (fields || []).reduce((record, field) => {
    const key = getNewSalesOrderFieldKey(field);
    if (!key) return record;
    record[getNewSalesOrderFieldBucket(field)][key] = normalizeNewSalesOrderDefaultValue(field);
    return record;
  }, { values: {}, udf: {} })
);

export const createNewSalesOrderLineId = () => {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  fallbackLineSequence += 1;
  return `nso-line-${Date.now().toString(36)}-${fallbackLineSequence.toString(36)}`;
};

export const createNewSalesOrderLine = (fields = []) => ({
  localLineId: createNewSalesOrderLineId(),
  ...createNewSalesOrderRecord(fields),
  errors: {},
});

export const normalizeNewSalesOrderSchema = (schema = {}) => ({
  ...normalizeSalesDocumentSchema(schema),
  documentType: schema.documentType || NEW_SALES_ORDER_DOCUMENT_TYPE,
  objectType: String(schema.objectType || NEW_SALES_ORDER_OBJECT_TYPE),
});

export const buildNewSalesOrderIdentity = (company = {}, user = {}) => ({
  companyId: company?.companyId ?? '',
  companyDb: String(company?.dbName || ''),
  userId: user?.userId ?? '',
  userCode: String(user?.username || ''),
  objectType: NEW_SALES_ORDER_OBJECT_TYPE,
  documentType: NEW_SALES_ORDER_DOCUMENT_TYPE,
});

export const buildNewSalesOrderIdentityKey = (identity = {}) => [
  identity.companyId,
  identity.companyDb,
  identity.userId,
  identity.userCode,
  identity.objectType || NEW_SALES_ORDER_OBJECT_TYPE,
  identity.documentType || NEW_SALES_ORDER_DOCUMENT_TYPE,
].map((part) => encodeURIComponent(String(part ?? '').trim())).join('|');

export const schemaMatchesNewSalesOrderIdentity = (schema = {}, identity = {}) => {
  if (schema.companyId !== undefined && schema.companyId !== null && String(schema.companyId) !== String(identity.companyId)) {
    return false;
  }
  if (schema.companyDb && identity.companyDb && String(schema.companyDb).toLowerCase() !== String(identity.companyDb).toLowerCase()) {
    return false;
  }
  if (schema.objectType && String(schema.objectType) !== NEW_SALES_ORDER_OBJECT_TYPE) return false;
  return true;
};

const blankFormData = () => ({ header: { values: {}, udf: {} }, lines: [] });

export const buildNewSalesOrderDefaultFormData = (schema = {}) => ({
  header: createNewSalesOrderRecord(schema.headerFields || []),
  lines: [createNewSalesOrderLine(schema.lineFields || [])],
});

export const createNewSalesOrderInitialState = () => ({
  identity: null,
  identityKey: '',
  schema: null,
  schemaStatus: 'idle',
  schemaError: '',
  formData: blankFormData(),
  activeTab: 'Contents',
  lookups: {},
  errors: { form: [], header: {}, lines: {} },
  validation: { status: 'idle', message: '' },
  dummySave: { status: 'idle', message: '', draft: null },
  payloadPreview: null,
  debugOpen: false,
});

const updateRecordField = (record, field, value) => {
  const bucket = getNewSalesOrderFieldBucket(field);
  const key = getNewSalesOrderFieldKey(field);
  if (!key) return record;
  return {
    ...record,
    [bucket]: { ...(record?.[bucket] || {}), [key]: value },
  };
};

const normalizeErrors = (errors = {}) => ({
  form: Array.isArray(errors.form) ? errors.form : (errors.form ? [String(errors.form)] : []),
  header: errors.header || {},
  lines: errors.lines || {},
});

export const newSalesOrderReducer = (state, action) => {
  switch (action.type) {
    case 'COMPANY_CHANGE_STARTED':
      return {
        ...createNewSalesOrderInitialState(),
        identity: action.identity,
        identityKey: action.identityKey,
        schemaStatus: action.identity?.companyId ? 'loading' : 'idle',
      };
    case 'SCHEMA_LOAD_SUCCEEDED': {
      if (action.identityKey !== state.identityKey) return state;
      const schema = normalizeNewSalesOrderSchema(action.schema);
      if (!schemaMatchesNewSalesOrderIdentity(schema, state.identity || {})) {
        return { ...state, schemaStatus: 'error', schemaError: 'The server returned a schema for a different company.' };
      }
      return {
        ...state,
        schema,
        schemaStatus: 'ready',
        schemaError: '',
        formData: buildNewSalesOrderDefaultFormData(schema),
        lookups: {},
        errors: { form: [], header: {}, lines: {} },
        payloadPreview: null,
      };
    }
    case 'SCHEMA_LOAD_FAILED':
      if (action.identityKey !== state.identityKey) return state;
      return { ...state, schemaStatus: 'error', schemaError: action.message || 'Unable to load the field schema.' };
    case 'SET_HEADER_FIELD':
      return {
        ...state,
        formData: {
          ...state.formData,
          header: updateRecordField(state.formData.header, action.field, action.value),
        },
        validation: { status: 'idle', message: '' },
        dummySave: { ...state.dummySave, status: 'idle', message: '' },
      };
    case 'SET_LINE_FIELD':
      return {
        ...state,
        formData: {
          ...state.formData,
          lines: state.formData.lines.map((line) => (
            line.localLineId === action.lineId
              ? { ...updateRecordField(line, action.field, action.value), localLineId: line.localLineId, errors: {} }
              : line
          )),
        },
        validation: { status: 'idle', message: '' },
        dummySave: { ...state.dummySave, status: 'idle', message: '' },
      };
    case 'ADD_LINE':
      return {
        ...state,
        formData: {
          ...state.formData,
          lines: [...state.formData.lines, createNewSalesOrderLine(state.schema?.lineFields || [])],
        },
      };
    case 'REMOVE_LINE': {
      const remaining = state.formData.lines.filter((line) => line.localLineId !== action.lineId);
      return {
        ...state,
        formData: {
          ...state.formData,
          lines: remaining.length ? remaining : [createNewSalesOrderLine(state.schema?.lineFields || [])],
        },
      };
    }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab };
    case 'SET_ERRORS':
      return { ...state, errors: normalizeErrors(action.errors) };
    case 'VALIDATION_STARTED':
      return { ...state, validation: { status: 'loading', message: 'Validating test data…' } };
    case 'VALIDATION_FINISHED':
      if (action.identityKey && action.identityKey !== state.identityKey) return state;
      return {
        ...state,
        validation: { status: action.valid ? 'success' : 'error', message: action.message || (action.valid ? 'Validation passed.' : 'Validation failed.') },
        errors: normalizeErrors(action.errors),
        payloadPreview: action.payload ?? state.payloadPreview,
      };
    case 'DUMMY_SAVE_STARTED':
      return { ...state, dummySave: { status: 'loading', message: 'Saving local dummy draft…', draft: null } };
    case 'DUMMY_SAVE_SUCCEEDED':
      if (action.identityKey && action.identityKey !== state.identityKey) return state;
      return {
        ...state,
        dummySave: { status: 'success', message: action.message || 'Local dummy draft saved.', draft: action.draft || null },
        payloadPreview: action.payload ?? state.payloadPreview,
        errors: { form: [], header: {}, lines: {} },
      };
    case 'DUMMY_SAVE_FAILED':
      if (action.identityKey && action.identityKey !== state.identityKey) return state;
      return { ...state, dummySave: { status: 'error', message: action.message || 'Unable to save the local dummy draft.', draft: null }, errors: normalizeErrors(action.errors || state.errors) };
    case 'LOOKUP_LOAD_STARTED':
      if (action.identityKey !== state.identityKey) return state;
      return {
        ...state,
        lookups: {
          ...state.lookups,
          [action.fieldKey]: {
            ...(state.lookups[action.fieldKey] || {}),
            requestId: action.requestId,
            loading: true,
            error: '',
            query: action.query || '',
          },
        },
      };
    case 'LOOKUP_LOAD_SUCCEEDED': {
      const current = state.lookups[action.fieldKey];
      if (action.identityKey !== state.identityKey || current?.requestId !== action.requestId) return state;
      return {
        ...state,
        lookups: {
          ...state.lookups,
          [action.fieldKey]: {
            ...current,
            loading: false,
            error: '',
            items: action.page > 1
              ? [
                  ...(current.items || []),
                  ...(action.items || []).filter((option) => !(current.items || []).some((existing) => String(existing?.value) === String(option?.value))),
                ]
              : (action.items || []),
            page: action.page || 1,
            limit: action.limit,
            hasMore: Boolean(action.hasMore),
          },
        },
      };
    }
    case 'LOOKUP_LOAD_FAILED': {
      const current = state.lookups[action.fieldKey];
      if (action.identityKey !== state.identityKey || current?.requestId !== action.requestId) return state;
      return {
        ...state,
        lookups: {
          ...state.lookups,
          [action.fieldKey]: { ...current, loading: false, error: action.message || 'Lookup failed.', items: [] },
        },
      };
    }
    case 'SET_PAYLOAD_PREVIEW':
      return { ...state, payloadPreview: action.payload };
    case 'TOGGLE_DEBUG':
      return { ...state, debugOpen: action.open ?? !state.debugOpen };
    case 'RESET_TEST_DATA':
      return {
        ...state,
        formData: state.schema ? buildNewSalesOrderDefaultFormData(state.schema) : blankFormData(),
        lookups: {},
        errors: { form: [], header: {}, lines: {} },
        validation: { status: 'idle', message: '' },
        dummySave: { status: 'idle', message: '', draft: null },
        payloadPreview: null,
        activeTab: 'Contents',
      };
    default:
      return state;
  }
};

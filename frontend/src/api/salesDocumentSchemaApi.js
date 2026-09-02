import apiClient from './client';
import {
  SALES_DOCUMENT_SCHEMA_LOOKUP_LIMIT,
  SALES_DOCUMENT_SCHEMA_LOOKUP_SOURCES,
} from '../utils/salesDocumentSchema';

const unwrap = (response) => response?.data ?? response;

const normalizeLookupSource = (source) => String(source || '').trim().toLowerCase();
const CUSTOM_LOOKUP_SOURCE = /^custom:\d+$/;

export const requireSalesDocumentLookupSource = (source) => {
  const normalized = normalizeLookupSource(source);
  if (!SALES_DOCUMENT_SCHEMA_LOOKUP_SOURCES.has(normalized) && !CUSTOM_LOOKUP_SOURCE.test(normalized)) {
    throw new Error(`Unsupported sales document lookup source: ${source || '(empty)'}`);
  }
  return normalized;
};

export const fetchSalesDocumentSchema = ({ documentType = '', signal } = {}) =>
  apiClient.get('/sales-document/schema', {
    params: documentType ? { documentType } : undefined,
    signal,
  }).then(unwrap);

export const fetchSalesDocumentLookup = async (source, {
  q = '',
  page = 1,
  limit = SALES_DOCUMENT_SCHEMA_LOOKUP_LIMIT,
  fieldId = '',
  schemaVersion = '',
  itemCode = '',
  documentType = '',
  signal,
} = {}) => {
  const safeSource = requireSalesDocumentLookupSource(source);
  const safeLimit = Math.min(SALES_DOCUMENT_SCHEMA_LOOKUP_LIMIT, Math.max(1, Number(limit) || SALES_DOCUMENT_SCHEMA_LOOKUP_LIMIT));
  const params = {
    q: String(q || '').trim(),
    page: Math.max(1, Number(page) || 1),
    limit: safeLimit,
  };

  if (fieldId) params.fieldId = String(fieldId);
  if (schemaVersion) params.schemaVersion = String(schemaVersion);
  if (itemCode) params.itemCode = String(itemCode);
  if (documentType) params.documentType = String(documentType);

  const response = await apiClient.get(
    `/sales-document/lookups/${encodeURIComponent(safeSource)}`,
    { params, signal },
  );
  return unwrap(response);
};

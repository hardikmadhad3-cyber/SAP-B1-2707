import apiClient from '../../api/client';
import {
  fetchSalesDocumentLookup,
  fetchSalesDocumentSchema,
  requireSalesDocumentLookupSource,
} from '../../api/salesDocumentSchemaApi';

const unwrap = (response) => response?.data ?? response;

export const fetchNewSalesOrderSchema = ({ signal } = {}) =>
  fetchSalesDocumentSchema({ signal });

export const fetchNewSalesOrderLookup = fetchSalesDocumentLookup;

export const validateNewSalesOrder = (request, { signal } = {}) =>
  apiClient.post('/new-sales-order/validate', request, { signal }).then(unwrap);

export const saveNewSalesOrderDummyDraft = (request, { signal } = {}) =>
  apiClient.post('/new-sales-order/dummy-drafts', request, { signal }).then(unwrap);

export { requireSalesDocumentLookupSource as requireLookupSource };

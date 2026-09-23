import apiClient from './client';

export const fetchAdminEntities = () =>
  apiClient.get('/admin-panel/entities').then((response) => response.data);

export const fetchAdminEntityBootstrap = (entityKey) =>
  apiClient.get(`/admin-panel/${encodeURIComponent(entityKey)}/bootstrap`).then((response) => response.data);

export const createAdminRecord = (entityKey, payload) =>
  apiClient.post(`/admin-panel/${encodeURIComponent(entityKey)}`, payload).then((response) => response.data);

export const updateAdminRecord = (entityKey, recordId, payload) =>
  apiClient.put(`/admin-panel/${encodeURIComponent(entityKey)}/${encodeURIComponent(recordId)}`, payload).then((response) => response.data);

export const deleteAdminRecord = (entityKey, recordId) =>
  apiClient.delete(`/admin-panel/${encodeURIComponent(entityKey)}/${encodeURIComponent(recordId)}`).then((response) => response.data);

export const fetchAdminCompanyFormSettings = ({ companyId, formKey, signal } = {}) =>
  apiClient.get('/admin-panel/form-settings/bootstrap', {
    params: {
      ...(companyId ? { companyId } : {}),
      ...(formKey ? { formKey } : {}),
    },
    signal,
  }).then((response) => response.data);

export const previewAdminCompanyFormQuery = (
  { companyId, formKey, queryText, context },
  { signal } = {},
) =>
  apiClient.post('/admin-panel/form-settings/preview', {
    companyId, formKey, queryText, context,
  }, { signal }).then((response) => response.data);

export const publishAdminCompanyFormQuery = (
  { companyId, formKey, queryText, context, expectedVersion },
  { signal } = {},
) =>
  apiClient.put('/admin-panel/form-settings', {
    companyId, formKey, queryText, context, expectedVersion,
  }, { signal })
    .then((response) => response.data);

export const unpublishAdminCompanyFormQuery = (
  { companyId, formKey, expectedVersion },
  { signal } = {},
) =>
  apiClient.delete('/admin-panel/form-settings', {
    data: { companyId, formKey, expectedVersion },
    signal,
  })
    .then((response) => response.data);

export const copyAdminSalesPurchaseLayouts = ({ sourceCompanyId, targetCompanyId }) =>
  apiClient.post('/admin-panel/form-settings/copy-sales-purchase', {
    sourceCompanyId,
    targetCompanyId,
  }).then((response) => response.data);

export const fetchAdminFieldConfiguration = ({ companyId, documentType, signal } = {}) =>
  apiClient.get('/admin-panel/field-configuration/bootstrap', {
    params: { ...(companyId ? { companyId } : {}), documentType }, signal,
  }).then((response) => response.data);

export const saveAdminFieldConfiguration = ({ companyId, documentType, schemaVersion, assignments }, { signal } = {}) =>
  apiClient.put('/admin-panel/field-configuration', {
    companyId, documentType, schemaVersion, assignments,
  }, { signal }).then((response) => response.data);

export const previewAdminCustomLookup = ({ companyId, id, name, queryText }, { signal } = {}) =>
  apiClient.post('/admin-panel/field-configuration/custom-lookups/preview', {
    companyId, id, name, queryText,
  }, { signal }).then((response) => response.data);

export const saveAdminCustomLookup = ({ companyId, id, name, queryText }, { signal } = {}) =>
  apiClient.post('/admin-panel/field-configuration/custom-lookups', {
    companyId, id, name, queryText,
  }, { signal }).then((response) => response.data);

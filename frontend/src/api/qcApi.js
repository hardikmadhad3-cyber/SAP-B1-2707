import apiClient from './client';

const BASE = '/qc';

export const listQcForms = () => apiClient.get(`${BASE}/forms`).then((r) => r.data);

export const listQcAddons = () => apiClient.get(`${BASE}/addons`).then((r) => r.data);
export const createQcAddon = (data) => apiClient.post(`${BASE}/addons`, data).then((r) => r.data);
export const updateQcAddon = (id, data) => apiClient.patch(`${BASE}/addons/${id}`, data).then((r) => r.data);
export const deleteQcAddon = (id) => apiClient.delete(`${BASE}/addons/${id}`).then((r) => r.data);

export const listQcMappings = () => apiClient.get(`${BASE}/mappings`).then((r) => r.data);
export const createQcMapping = (data) => apiClient.post(`${BASE}/mappings`, data).then((r) => r.data);
export const updateQcMapping = (id, data) => apiClient.patch(`${BASE}/mappings/${id}`, data).then((r) => r.data);
export const deleteQcMapping = (id) => apiClient.delete(`${BASE}/mappings/${id}`).then((r) => r.data);

export const listQcParameters = () => apiClient.get(`${BASE}/parameters`).then((r) => r.data);
export const createQcParameter = (data) => apiClient.post(`${BASE}/parameters`, data).then((r) => r.data);
export const updateQcParameter = (id, data) => apiClient.patch(`${BASE}/parameters/${id}`, data).then((r) => r.data);
export const deleteQcParameter = (id) => apiClient.delete(`${BASE}/parameters/${id}`).then((r) => r.data);

export const listQcWorkflows = () => apiClient.get(`${BASE}/workflows`).then((r) => r.data);
export const createQcWorkflow = (data) => apiClient.post(`${BASE}/workflows`, data).then((r) => r.data);
export const updateQcWorkflow = (id, data) => apiClient.patch(`${BASE}/workflows/${id}`, data).then((r) => r.data);
export const deleteQcWorkflow = (id) => apiClient.delete(`${BASE}/workflows/${id}`).then((r) => r.data);

export const listQcTransactions = () => apiClient.get(`${BASE}/transactions`).then((r) => r.data);
export const createQcTransaction = (data) => apiClient.post(`${BASE}/transactions`, data).then((r) => r.data);
export const updateQcTransaction = (id, data) => apiClient.patch(`${BASE}/transactions/${id}`, data).then((r) => r.data);
export const deleteQcTransaction = (id) => apiClient.delete(`${BASE}/transactions/${id}`).then((r) => r.data);

export const listQcItemParameterMappings = () => apiClient.get(`${BASE}/item-parameter-mappings`).then((r) => r.data);
export const createQcItemParameterMapping = (data) => apiClient.post(`${BASE}/item-parameter-mappings`, data).then((r) => r.data);
export const saveQcItemParameterMappingHeader = (data) => apiClient.post(`${BASE}/item-parameter-mappings/save`, data).then((r) => r.data);
export const updateQcItemParameterMapping = (id, data) => apiClient.patch(`${BASE}/item-parameter-mappings/${id}`, data).then((r) => r.data);
export const deleteQcItemParameterMapping = (id) => apiClient.delete(`${BASE}/item-parameter-mappings/${id}`).then((r) => r.data);

export const listQcInstruments = () => apiClient.get(`${BASE}/instruments`).then((r) => r.data);
export const createQcInstrument = (data) => apiClient.post(`${BASE}/instruments`, data).then((r) => r.data);
export const updateQcInstrument = (id, data) => apiClient.patch(`${BASE}/instruments/${id}`, data).then((r) => r.data);
export const deleteQcInstrument = (id) => apiClient.delete(`${BASE}/instruments/${id}`).then((r) => r.data);

export const listInwardPendingVendors = () => apiClient.get(`${BASE}/inward/vendors`).then((r) => r.data);
export const listInwardPendingDocuments = (vendorCode) =>
	apiClient.get(`${BASE}/inward/documents`, { params: { vendorCode } }).then((r) => r.data);
export const listInwardPendingItems = (docEntry) =>
	apiClient.get(`${BASE}/inward/items`, { params: { docEntry } }).then((r) => r.data);
export const listInwardItemParameters = (itemCode) =>
	apiClient.get(`${BASE}/inward/parameters`, { params: { itemCode } }).then((r) => r.data);
export const listInwardItemBatches = (itemCode, whsCode) =>
	apiClient.get(`${BASE}/inward/batches`, { params: { itemCode, whsCode } }).then((r) => r.data);
export const saveInwardQcInspection = (data) => apiClient.post(`${BASE}/inward/save`, data).then((r) => r.data);

export const listOutwardPendingCustomers = () => apiClient.get(`${BASE}/outward/customers`).then((r) => r.data);
export const listOutwardPendingDocuments = (customerCode) =>
	apiClient.get(`${BASE}/outward/documents`, { params: { customerCode } }).then((r) => r.data);
export const listOutwardPendingItems = (docEntry) =>
	apiClient.get(`${BASE}/outward/items`, { params: { docEntry } }).then((r) => r.data);
export const listOutwardItemParameters = (itemCode) =>
	apiClient.get(`${BASE}/outward/parameters`, { params: { itemCode } }).then((r) => r.data);
export const listOutwardItemBatches = (itemCode, whsCode) =>
	apiClient.get(`${BASE}/outward/batches`, { params: { itemCode, whsCode } }).then((r) => r.data);
export const saveOutwardQcInspection = (data) => apiClient.post(`${BASE}/outward/save`, data).then((r) => r.data);

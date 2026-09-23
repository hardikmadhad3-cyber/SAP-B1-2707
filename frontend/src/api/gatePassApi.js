import apiClient from './client';

// --- Masters (Visitor Type / Visit Type) ---

export const fetchGatePassMasterList = (masterKey, { query = '' } = {}) =>
  apiClient.get(`/gate-pass/masters/${masterKey}`, { params: { query } });

export const createGatePassMasterRow = (masterKey, payload) =>
  apiClient.post(`/gate-pass/masters/${masterKey}`, payload);

export const updateGatePassMasterRow = (masterKey, code, payload) =>
  apiClient.patch(`/gate-pass/masters/${masterKey}/${encodeURIComponent(code)}`, payload);

export const deleteGatePassMasterRow = (masterKey, code) =>
  apiClient.delete(`/gate-pass/masters/${masterKey}/${encodeURIComponent(code)}`);

// --- Transactions (Visitor Log / Gate In / Gate Out) ---

export const fetchGatePassList = (transactionKey, { query = '', page = 1, pageSize = 25 } = {}) =>
  apiClient.get(`/gate-pass/${transactionKey}/list`, { params: { query, page, pageSize } });

export const fetchGatePassByDocEntry = (transactionKey, docEntry) =>
  apiClient.get(`/gate-pass/${transactionKey}/${encodeURIComponent(docEntry)}`);

export const submitGatePassDocument = (transactionKey, payload) =>
  apiClient.post(`/gate-pass/${transactionKey}`, payload);

export const updateGatePassDocument = (transactionKey, docEntry, payload) =>
  apiClient.patch(`/gate-pass/${transactionKey}/${encodeURIComponent(docEntry)}`, payload);

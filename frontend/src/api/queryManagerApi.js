import apiClient from './client';

export const fetchQueryFolderTree = () =>
  apiClient.get('/query-manager/folders').then((response) => response.data);

export const createFolder = (payload) =>
  apiClient.post('/query-manager/folders', payload).then((response) => response.data);

export const renameOrMoveFolder = (folderId, payload) =>
  apiClient.put(`/query-manager/folders/${folderId}`, payload).then((response) => response.data);

export const deleteFolder = (folderId) =>
  apiClient.delete(`/query-manager/folders/${folderId}`).then((response) => response.data);

export const fetchSavedQuery = (queryId) =>
  apiClient.get(`/query-manager/queries/${queryId}`).then((response) => response.data);

export const createSavedQuery = (payload) =>
  apiClient.post('/query-manager/queries', payload).then((response) => response.data);

export const updateSavedQuery = (queryId, payload) =>
  apiClient.put(`/query-manager/queries/${queryId}`, payload).then((response) => response.data);

export const deleteSavedQuery = (queryId) =>
  apiClient.delete(`/query-manager/queries/${queryId}`).then((response) => response.data);

export const previewQuery = (payload) =>
  apiClient.post('/query-manager/queries/preview', payload).then((response) => response.data);

export const runSavedQuery = (queryId) =>
  apiClient.post(`/query-manager/queries/${queryId}/run`, {}).then((response) => response.data);

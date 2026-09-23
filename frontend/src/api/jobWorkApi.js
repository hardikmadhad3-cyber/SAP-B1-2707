import apiClient from './client';

export const fetchJobWorkReferenceData = (transactionKey) =>
  apiClient.get(`/job-work/${transactionKey}/reference-data`);

export const fetchJobWorkList = (transactionKey, { query = '', page = 1, pageSize = 25 } = {}) =>
  apiClient.get(`/job-work/${transactionKey}/list`, { params: { query, page, pageSize } });

export const fetchJobWorkByDocEntry = (transactionKey, docEntry) =>
  apiClient.get(`/job-work/${transactionKey}/${encodeURIComponent(docEntry)}`);

export const fetchJobWorkPartyAddresses = (transactionKey, partyCode) =>
  apiClient.get(`/job-work/${transactionKey}/party-addresses/${encodeURIComponent(partyCode)}`);

export const fetchJobWorkBins = (transactionKey, whsCode) =>
  apiClient.get(`/job-work/${transactionKey}/bins/${encodeURIComponent(whsCode)}`);

export const fetchJobWorkSeries = (transactionKey) =>
  apiClient.get(`/job-work/${transactionKey}/series`);

export const fetchJobWorkGoodsReceiptSeries = (transactionKey, { date = '', branch = '' } = {}) =>
  apiClient.get(`/job-work/${transactionKey}/goods-receipt-series`, { params: { date, branch } });

export const fetchJobWorkConsumableIssues = (transactionKey, vendorCode) =>
  apiClient.get(`/job-work/${transactionKey}/consumable-issues`, { params: { vendorCode } });

export const submitJobWork = (transactionKey, payload) =>
  apiClient.post(`/job-work/${transactionKey}`, payload);

export const updateJobWork = (transactionKey, docEntry, payload) =>
  apiClient.patch(`/job-work/${transactionKey}/${encodeURIComponent(docEntry)}`, payload);

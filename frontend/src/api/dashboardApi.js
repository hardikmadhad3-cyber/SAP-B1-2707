import apiClient from './client';

export const fetchDashboardOverview = ({ refresh = false, asOfDate = '' } = {}) =>
  apiClient.get('/dashboard/overview', {
    params: {
      ...(refresh ? { refresh: '1' } : {}),
      ...(asOfDate ? { asOfDate } : {}),
    },
  }).then((response) => response.data);

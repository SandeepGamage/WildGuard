import { apiDownload, apiRequest } from './client';

export const getParks = () => apiRequest('/analytics/parks');

/**
 * Generate a conservation report (UC4 main flow steps 1–9).
 * @returns {Promise<object>} The report, or `{ empty: true, filter }` when nothing matches (A2).
 */
export const generateReport = (filters) =>
  apiRequest('/analytics/reports', { method: 'POST', body: filters });

export const getSavedReports = () => apiRequest('/analytics/reports?limit=50');

export const getReport = (id) => apiRequest(`/analytics/reports/${encodeURIComponent(id)}`);

/** Export a saved report (UC4c). The server fetches the report by id. */
export const exportReport = (id, { format, sections }) =>
  apiDownload(
    `/analytics/reports/${encodeURIComponent(id)}/export?format=${format}&sections=${sections.join(',')}`,
  );

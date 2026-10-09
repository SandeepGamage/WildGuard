import { apiRequest } from './client';

export const createIncident = (body) => apiRequest('/incidents', { method: 'POST', body });

export const listMyIncidents = () => apiRequest('/incidents/mine?limit=50');

export const getMyIncident = (id) => apiRequest(`/incidents/${id}`);

export const requestPhotoUpload = ({ contentType, sizeBytes }) =>
  apiRequest('/incidents/photo-upload', { method: 'POST', body: { contentType, sizeBytes } });

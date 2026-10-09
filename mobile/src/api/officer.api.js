import { apiRequest } from './client';

export const getQueue = () => apiRequest('/officer/queue');

export const getOfficerIncident = (id) => apiRequest(`/officer/incidents/${id}`);

export const startReview = (id) => apiRequest(`/officer/incidents/${id}/review`, { method: 'POST' });

export const verifyIncident = (id, body) =>
  apiRequest(`/officer/incidents/${id}/verify`, { method: 'POST', body });

export const rejectIncident = (id, body) =>
  apiRequest(`/officer/incidents/${id}/reject`, { method: 'POST', body });

export const getOfficerMap = () => apiRequest('/officer/map');

export const getOfficerHistory = ({ decision } = {}) =>
  apiRequest(`/officer/history?limit=50${decision ? `&decision=${decision}` : ''}`);

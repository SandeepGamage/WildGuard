import { apiRequest } from './client';

/** Upload one batch (session + track points + incidents). Idempotent by client ids. */
export const syncPatrol = (body) => apiRequest('/patrols/sync', { method: 'POST', body });

export const requestPatrolPhotoUpload = ({ contentType, sizeBytes }) =>
  apiRequest('/patrols/photo-upload', { method: 'POST', body: { contentType, sizeBytes } });

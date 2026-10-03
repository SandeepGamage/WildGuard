import { apiRequest } from './client';

export const getMe = () => apiRequest('/auth/me');

export const registerVillager = (values) =>
  apiRequest('/auth/register', { method: 'POST', body: values, auth: false });

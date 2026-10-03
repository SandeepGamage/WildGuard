import { apiRequest } from './client';

export const listVillages = () => apiRequest('/villages', { auth: false });

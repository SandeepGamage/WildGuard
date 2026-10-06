import { apiRequest } from './client';

/** @returns {Promise<{ profile: object, accessToken: string }>} */
export const login = ({ account, password }) =>
  apiRequest('/auth/login', { method: 'POST', body: { account, password }, auth: false });

export const getMe = () => apiRequest('/auth/me');

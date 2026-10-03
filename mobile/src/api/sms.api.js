import { apiRequest } from './client';

/** Demo-only: the SMS gateway is simulated, so this is an unauthenticated call. */
export const simulateSms = ({ phone, message }) =>
  apiRequest('/sms/simulate', { method: 'POST', body: { phone, message }, auth: false });

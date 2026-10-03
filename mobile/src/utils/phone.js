import { config } from '../constants/config';

const LOCAL_MOBILE_PATTERN = /^0\d{9}$/;

/**
 * Normalise a Sri Lankan mobile number to 07XXXXXXXX.
 * @returns {string|null} null when the input is not a valid mobile number.
 */
export function normalizePhone(input) {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+94')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('94') && digits.length === 11) digits = `0${digits.slice(2)}`;
  return LOCAL_MOBILE_PATTERN.test(digits) ? digits : null;
}

/**
 * Supabase Auth signs in with email + password. A mobile number maps to the same
 * pseudo-email the backend creates at registration; a real email is used as typed.
 * @returns {string|null} null when the input is neither an email nor a valid mobile number.
 */
export function accountToLoginEmail(account) {
  const value = (account ?? '').trim();
  if (value.includes('@')) return value.toLowerCase();
  const phone = normalizePhone(value);
  return phone ? `${phone}@${config.phoneEmailDomain}` : null;
}

/** "077 *** 812" style display. */
export function maskPhone(phone) {
  if (!phone || phone.length < 6) return '';
  return `${phone.slice(0, 3)} *** ${phone.slice(-3)}`;
}

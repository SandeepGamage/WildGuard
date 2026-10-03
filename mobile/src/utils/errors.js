import { API_ERROR_CODES } from '../api/client';

/** Backend error code -> translation key. Raw backend messages are never shown. */
const ERROR_KEYS = {
  [API_ERROR_CODES.NETWORK]: 'errors.network',
  UNAUTHENTICATED: 'errors.sessionExpired',
  FORBIDDEN_ROLE: 'errors.forbidden',
  OUT_OF_SCOPE: 'errors.outOfScope',
  VALIDATION_FAILED: 'errors.validation',
  PHONE_ALREADY_REGISTERED: 'errors.phoneRegistered',
  VILLAGE_NOT_FOUND: 'errors.villageNotFound',
  LOCATION_UNRESOLVED: 'errors.locationUnavailable',
  INCIDENT_ALREADY_REVIEWED: 'errors.alreadyReviewed',
  INCIDENT_NOT_FOUND: 'errors.notFound',
  REPORT_NOT_FOUND: 'errors.notFound',
  RATE_LIMITED: 'errors.rateLimited',
  INVALID_PHONE: 'errors.invalidPhone',
};

/**
 * @param {unknown} error
 * @param {(key: string) => string} t i18next translate function.
 * @returns {string} A message that is safe to show to the user.
 */
export function friendlyError(error, t) {
  const key = ERROR_KEYS[error?.code] ?? 'errors.generic';
  return t(key);
}

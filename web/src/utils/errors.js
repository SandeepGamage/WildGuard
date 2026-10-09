import { API_ERROR_CODES } from '../api/client';

/** Backend error code -> translation key. Raw backend messages are never shown. */
const ERROR_KEYS = {
  [API_ERROR_CODES.NETWORK]: 'errors.network',
  UNAUTHENTICATED: 'errors.sessionExpired',
  INVALID_CREDENTIALS: 'errors.invalidCredentials',
  FORBIDDEN_ROLE: 'errors.forbidden',
  VALIDATION_FAILED: 'errors.validation',
  REPORT_NOT_FOUND: 'errors.notFound',
  RATE_LIMITED: 'errors.rateLimited',
  DATA_SOURCE_UNAVAILABLE: 'errors.dataUnavailable',
  EXPORT_FAILED: 'errors.exportFailed',
  NOT_MANAGER: 'auth.notManager',
};

/** A message that is safe to show to the user. */
export function friendlyError(error, t) {
  return t(ERROR_KEYS[error?.code] ?? 'errors.generic');
}

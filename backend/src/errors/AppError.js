/**
 * Operational error that is safe to show to API clients.
 * Anything that is not an AppError is treated as an internal failure.
 */
class AppError extends Error {
  /**
   * @param {number} statusCode HTTP status code.
   * @param {string} code Stable machine-readable error code.
   * @param {string} message Client-safe message.
   * @param {object} [details] Optional client-safe extra data.
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (code, message, details) => new AppError(400, code, message, details);
const unauthorized = (message = 'Authentication is required.') =>
  new AppError(401, 'UNAUTHENTICATED', message);
const forbidden = (code, message) => new AppError(403, code, message);
const notFound = (code, message) => new AppError(404, code, message);
const conflict = (code, message, details) => new AppError(409, code, message, details);
const serviceUnavailable = (code, message) => new AppError(503, code, message);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, serviceUnavailable };

const { unauthorized, forbidden } = require('../errors/AppError');

const BEARER_PATTERN = /^Bearer (.+)$/i;

/**
 * Verifies the Supabase access token on every protected request and attaches
 * `req.user` ({ id, email, profile }). The role always comes from the database.
 * @param {{ authenticate: (token: string) => Promise<object> }} authService
 */
function createAuthenticate(authService) {
  return async (req, _res, next) => {
    const match = BEARER_PATTERN.exec(req.get('authorization') ?? '');
    if (!match) return next(unauthorized());
    try {
      req.user = await authService.authenticate(match[1]);
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Allows the request only for the listed roles.
 * @param {...string} roles Values from USER_ROLES.
 */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.profile.role)) {
      return next(forbidden('FORBIDDEN_ROLE', 'You do not have access to this resource.'));
    }
    return next();
  };
}

module.exports = { createAuthenticate, requireRole };

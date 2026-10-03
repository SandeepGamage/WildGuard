const { rateLimit } = require('express-rate-limit');

const tooManyRequests = {
  success: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
};

/**
 * @param {{ windowMs: number, max: number }} settings
 */
function createLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: tooManyRequests,
  });
}

/**
 * General limiter for the whole API plus a stricter one for anonymous,
 * abuse-prone endpoints (registration and the SMS gateway).
 * @param {{ windowMs: number, max: number }} rateLimitConfig
 */
function createRateLimiters(rateLimitConfig) {
  return {
    general: createLimiter(rateLimitConfig),
    strict: createLimiter({
      windowMs: rateLimitConfig.windowMs,
      max: Math.max(10, Math.floor(rateLimitConfig.max / 5)),
    }),
  };
}

module.exports = { createRateLimiters };

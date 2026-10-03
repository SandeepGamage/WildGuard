const { randomUUID } = require('node:crypto');

/** Assigns a request id and logs one line per finished request (no headers, bodies or tokens). */
function createRequestContext(logger) {
  return (req, res, next) => {
    req.id = randomUUID();
    res.setHeader('X-Request-Id', req.id);
    const startedAt = Date.now();
    res.on('finish', () => {
      logger.debug('request', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - startedAt,
      });
    });
    next();
  };
}

module.exports = { createRequestContext };

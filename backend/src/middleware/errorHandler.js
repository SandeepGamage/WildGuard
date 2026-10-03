const { AppError, notFound } = require('../errors/AppError');

/** 404 for unknown routes. */
function notFoundHandler(_req, _res, next) {
  next(notFound('ROUTE_NOT_FOUND', 'The requested endpoint does not exist.'));
}

/**
 * Central error handler. Operational errors are returned as-is; everything
 * else is logged with the request id and returned as a generic 500, so stack
 * traces and database messages never reach clients.
 * @param {{ error: Function }} logger
 */
function createErrorHandler(logger) {
  return (error, req, res, _next) => {
    if (error instanceof AppError) {
      const body = { success: false, error: { code: error.code, message: error.message } };
      if (error.details) body.error.details = error.details;
      return res.status(error.statusCode).json(body);
    }

    if (error.type === 'entity.too.large') {
      return res
        .status(413)
        .json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large.' } });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' },
      });
    }

    logger.error('Unhandled error', { requestId: req.id, path: req.path, message: error.message });
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again.',
        requestId: req.id,
      },
    });
  };
}

module.exports = { notFoundHandler, createErrorHandler };

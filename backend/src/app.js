const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createApiRouter } = require('./routes');
const { createRateLimiters } = require('./middleware/rateLimiters');
const { createRequestContext } = require('./middleware/requestContext');
const { notFoundHandler, createErrorHandler } = require('./middleware/errorHandler');

const BODY_LIMIT = '100kb';

/**
 * Build the Express application. All collaborators are injected, so tests can
 * run the full HTTP stack against in-memory repositories.
 * @param {{ config: object, services: object, logger: object }} deps
 */
function createApp({ config, services, logger }) {
  const app = express();
  const limiters = createRateLimiters(config.rateLimit);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Native apps send no Origin header; browsers must be on the allow-list.
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
    }),
  );
  app.use(createRequestContext(logger));
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use('/api/v1', limiters.general, createApiRouter({ services, limiters, config }));
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}

module.exports = { createApp };

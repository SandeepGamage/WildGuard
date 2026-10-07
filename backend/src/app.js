const path = require('node:path');
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
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: (origin, callback) => {
        // Native apps send no Origin header; browsers must be on the allow-list.
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      // Lets the web dashboard read the file name of an exported report.
      exposedHeaders: ['Content-Disposition'],
    }),
  );
  app.use(createRequestContext(logger));
  app.use(express.json({ limit: BODY_LIMIT }));
  // UC2: Wildlife Collar Boundary Alert Operations Console & Phone GPS Simulation
  app.use('/collar-console', express.static(path.join(__dirname, '../public')));
  app.use('/operations', express.static(path.join(__dirname, '../public')));

  // Operations Console compatibility router
  const { createOperationsCompatRouter } = require('./routes/operationsCompat.routes');
  app.use('/api', createOperationsCompatRouter({ services }));
  app.use('/collar.html', (req, res) => res.sendFile(path.join(__dirname, '../public/collar.html')));
  app.use('/collar_qr.png', (req, res) => res.sendFile(path.join(__dirname, '../public/collar_qr.png')));
  app.use('/api/v1', limiters.general, createApiRouter({ services, limiters, config }));
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}

module.exports = { createApp };

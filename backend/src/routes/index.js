const { Router } = require('express');
const { getHealth } = require('../controllers/health.controller');
const { createAuthController } = require('../controllers/auth.controller');
const { createVillageController } = require('../controllers/village.controller');
const { createIncidentController } = require('../controllers/incident.controller');
const { createOfficerController } = require('../controllers/officer.controller');
const { createSmsController } = require('../controllers/sms.controller');
const { createNotificationController } = require('../controllers/notification.controller');
const { createAuthRoutes } = require('./auth.routes');
const { createVillageRoutes } = require('./village.routes');
const { createIncidentRoutes } = require('./incident.routes');
const { createOfficerRoutes } = require('./officer.routes');
const { createSmsRoutes } = require('./sms.routes');
const { createNotificationRoutes } = require('./notification.routes');
const { createAuthenticate } = require('../middleware/auth');

/**
 * Compose the /api/v1 router.
 * @param {{ services: object, limiters: { strict: Function }, config: object }} deps
 */
function createApiRouter({ services, limiters, config }) {
  const authenticate = createAuthenticate(services.authService);
  const strictLimiter = limiters.strict;
  const router = Router();

  router.get('/health', getHealth);
  router.use(
    '/auth',
    createAuthRoutes({ controller: createAuthController(services), authenticate, strictLimiter }),
  );
  router.use('/villages', createVillageRoutes({ controller: createVillageController(services) }));
  router.use(
    '/incidents',
    createIncidentRoutes({ controller: createIncidentController(services), authenticate }),
  );
  router.use(
    '/officer',
    createOfficerRoutes({ controller: createOfficerController(services), authenticate }),
  );
  router.use(
    '/notifications',
    createNotificationRoutes({ controller: createNotificationController(services), authenticate }),
  );
  if (config.smsSimulatorEnabled) {
    router.use('/sms', createSmsRoutes({ controller: createSmsController(services), strictLimiter }));
  }
  return router;
}

module.exports = { createApiRouter };

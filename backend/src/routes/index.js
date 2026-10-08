const { Router } = require('express');
const { getHealth } = require('../controllers/health.controller');
const { createAuthController } = require('../controllers/auth.controller');
const { createVillageController } = require('../controllers/village.controller');
const { createIncidentController } = require('../controllers/incident.controller');
const { createOfficerController } = require('../controllers/officer.controller');
const { createSmsController } = require('../controllers/sms.controller');
const { createNotificationController } = require('../controllers/notification.controller');
const { createAnalyticsController } = require('../controllers/analytics.controller');
const { createCollarController } = require('../controllers/collar.controller');
const { createPatrolController } = require('../controllers/patrol.controller');
const { createPatrolRoutes } = require('./patrol.routes');
const { createAuthRoutes } = require('./auth.routes');
const { createVillageRoutes } = require('./village.routes');
const { createIncidentRoutes } = require('./incident.routes');
const { createOfficerRoutes } = require('./officer.routes');
const { createSmsRoutes } = require('./sms.routes');
const { createNotificationRoutes } = require('./notification.routes');
const { createAnalyticsRoutes } = require('./analytics.routes');
const { createCollarRoutes } = require('./collar.routes');
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
    '/patrols',
    createPatrolRoutes({ controller: createPatrolController(services), authenticate }),
  );
  router.use(
    '/notifications',
    createNotificationRoutes({ controller: createNotificationController(services), authenticate }),
  );
  router.use(
    '/analytics',
    createAnalyticsRoutes({ controller: createAnalyticsController(services), authenticate }),
  );
  router.use('/collar', createCollarRoutes({ controller: createCollarController(services), authenticate }));
  if (config.smsSimulatorEnabled) {
    router.use('/sms', createSmsRoutes({ controller: createSmsController(services), strictLimiter }));
  }
  return router;
}

module.exports = { createApiRouter };

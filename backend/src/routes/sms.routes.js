const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { simulateSmsBody } = require('../validators/sms.validators');

/** Simulated SMS gateway. Only mounted when SMS_SIMULATOR_ENABLED is true. */
function createSmsRoutes({ controller, strictLimiter }) {
  const router = Router();
  router.post('/simulate', strictLimiter, validate({ body: simulateSmsBody }), controller.simulate);
  return router;
}

module.exports = { createSmsRoutes };

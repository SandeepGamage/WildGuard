const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { registerBody } = require('../validators/auth.validators');

function createAuthRoutes({ controller, authenticate, strictLimiter }) {
  const router = Router();
  router.get('/me', authenticate, controller.me);
  router.post('/register', strictLimiter, validate({ body: registerBody }), controller.register);
  return router;
}

module.exports = { createAuthRoutes };

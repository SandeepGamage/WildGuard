const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { registerBody, loginBody } = require('../validators/auth.validators');

function createAuthRoutes({ controller, authenticate, strictLimiter }) {
  const router = Router();
  router.get('/me', authenticate, controller.me);
  router.post('/register', strictLimiter, validate({ body: registerBody }), controller.register);
  router.post('/login', strictLimiter, validate({ body: loginBody }), controller.login);
  return router;
}

module.exports = { createAuthRoutes };

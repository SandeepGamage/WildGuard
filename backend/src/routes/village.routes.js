const { Router } = require('express');

/** The village list is needed on the sign-up screen, so it is public read-only data. */
function createVillageRoutes({ controller }) {
  const router = Router();
  router.get('/', controller.list);
  return router;
}

module.exports = { createVillageRoutes };

const { Router } = require('express');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams } = require('../validators/common');
const { verifyBody, rejectBody, historyQuery } = require('../validators/officer.validators');
const { USER_ROLES } = require('../constants/domain');

function createOfficerRoutes({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate, requireRole(USER_ROLES.COMMUNITY_LIAISON_OFFICER));

  router.get('/queue', controller.queue);
  router.get('/map', controller.map);
  router.get('/history', validate({ query: historyQuery }), controller.history);
  router.get('/incidents/:id', validate({ params: idParams }), controller.getIncident);
  router.post('/incidents/:id/review', validate({ params: idParams }), controller.startReview);
  router.post('/incidents/:id/verify', validate({ params: idParams, body: verifyBody }), controller.verify);
  router.post('/incidents/:id/reject', validate({ params: idParams, body: rejectBody }), controller.reject);
  return router;
}

module.exports = { createOfficerRoutes };

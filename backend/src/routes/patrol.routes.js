const { Router } = require('express');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { photoUploadBody } = require('../validators/incident.validators');
const { syncPatrolBody } = require('../validators/patrol.validators');
const { USER_ROLES } = require('../constants/domain');

function createPatrolRoutes({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate, requireRole(USER_ROLES.FIELD_RANGER));

  router.post('/sync', validate({ body: syncPatrolBody }), controller.sync);
  router.post('/photo-upload', validate({ body: photoUploadBody }), controller.createPhotoUpload);
  return router;
}

module.exports = { createPatrolRoutes };

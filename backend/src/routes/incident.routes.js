const { Router } = require('express');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams, pagination } = require('../validators/common');
const { createIncidentBody, photoUploadBody } = require('../validators/incident.validators');
const { USER_ROLES } = require('../constants/domain');

function createIncidentRoutes({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate, requireRole(USER_ROLES.VILLAGER));

  router.post('/', validate({ body: createIncidentBody }), controller.create);
  router.post('/photo-upload', validate({ body: photoUploadBody }), controller.createPhotoUpload);
  router.get('/mine', validate({ query: pagination }), controller.listMine);
  router.get('/:id', validate({ params: idParams }), controller.getMine);
  return router;
}

module.exports = { createIncidentRoutes };

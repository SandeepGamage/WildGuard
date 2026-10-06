const { Router } = require('express');
const { requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParams } = require('../validators/common');
const { reportBody, exportQuery, reportListQuery } = require('../validators/analytics.validators');
const { USER_ROLES } = require('../constants/domain');

function createAnalyticsRoutes({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate, requireRole(USER_ROLES.PARK_MANAGER));

  router.get('/parks', controller.parks);
  router.get('/reports', validate({ query: reportListQuery }), controller.list);
  router.post('/reports', validate({ body: reportBody }), controller.generate);
  router.get('/reports/:id', validate({ params: idParams }), controller.getReport);
  router.get(
    '/reports/:id/export',
    validate({ params: idParams, query: exportQuery }),
    controller.exportReport,
  );
  return router;
}

module.exports = { createAnalyticsRoutes };

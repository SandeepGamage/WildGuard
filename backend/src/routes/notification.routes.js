const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { idParams } = require('../validators/common');
const { notificationListQuery } = require('../validators/notification.validators');

function createNotificationRoutes({ controller, authenticate }) {
  const router = Router();
  router.use(authenticate);
  router.get('/', validate({ query: notificationListQuery }), controller.list);
  router.patch('/:id/read', validate({ params: idParams }), controller.markRead);
  return router;
}

module.exports = { createNotificationRoutes };

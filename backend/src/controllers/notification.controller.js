const { sendSuccess } = require('../utils/response');
const { notFound } = require('../errors/AppError');

/** @param {{ notificationService: object }} deps */
function createNotificationController({ notificationService }) {
  return {
    list: async (req, res) => sendSuccess(res, await notificationService.list(req.user, req.validated.query)),

    markRead: async (req, res) => {
      const notification = await notificationService.markRead(req.user, req.validated.params.id);
      if (!notification) throw notFound('NOTIFICATION_NOT_FOUND', 'Notification not found.');
      return sendSuccess(res, notification);
    },
  };
}

module.exports = { createNotificationController };

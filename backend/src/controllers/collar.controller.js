const { sendSuccess } = require('../utils/response');

/**
 * Controller: CollarController (UC2)
 * @param {{ collarService: object }} deps
 */
function createCollarController({ collarService }) {
  return {
    ingestReading: async (req, res) => {
      const result = await collarService.ingestReading(req.body);
      return sendSuccess(res, result);
    },

    ingestBatch: async (req, res) => {
      const result = await collarService.ingestBatch(req.body.readings);
      return sendSuccess(res, result);
    },

    listActiveAlerts: async (_req, res) => {
      const alerts = await collarService.listActiveAlerts();
      return sendSuccess(res, alerts);
    },

    acknowledgeAlert: async (req, res) => {
      const officerId = req.user ? req.user.id : req.body.officerId || 'OFF-01';
      const result = await collarService.acknowledgeAlert(req.params.id, {
        ...req.body,
        officerId,
      });
      return sendSuccess(res, result);
    },

    markFalseAlarm: async (req, res) => {
      const officerId = req.user ? req.user.id : req.body.officerId || 'OFF-01';
      const result = await collarService.markFalseAlarm(req.params.id, {
        ...req.body,
        officerId,
      });
      return sendSuccess(res, result);
    },

    listAuditTrail: async (req, res) => {
      const { collarId, limit } = req.query;
      const trail = await collarService.listAuditTrail({
        collarId,
        limit: limit ? Number(limit) : 50,
      });
      return sendSuccess(res, trail);
    },

    listZones: async (_req, res) => {
      const zones = await collarService.listZones();
      return sendSuccess(res, zones);
    },

    listCollars: async (_req, res) => {
      const collars = await collarService.listCollars();
      return sendSuccess(res, collars);
    },
  };
}

module.exports = { createCollarController };

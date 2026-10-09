const { sendSuccess } = require('../utils/response');

/**
 * Controller: CollarController (UC2 - HazardMonitoringController)
 * Strictly matches SE3070 A2 Report Section 7.4.2 & Section 8.2.
 * @param {{ collarService: object }} deps
 */
function createCollarController({ collarService }) {
  return {
    ingestReading: async (req, res) => {
      const result = await collarService.ingestReading(req.body || {});
      return sendSuccess(res, result);
    },

    ingestBatch: async (req, res) => {
      const result = await collarService.ingestBatch(req.body?.readings || []);
      return sendSuccess(res, result);
    },

    listActiveAlerts: async (_req, res) => {
      const alerts = await collarService.listActiveAlerts();
      return sendSuccess(res, alerts);
    },

    // Screenshot 3 (O4): Responder acknowledges dispatch within 3 minutes
    acknowledgeDispatch: async (req, res) => {
      const responderId = req.body?.responderId || (req.user ? req.user.id : 'RESP-01');
      const result = await collarService.acknowledgeDispatch(req.params.id, {
        responderId,
        notes: req.body?.notes,
      });
      return sendSuccess(res, result);
    },

    // Screenshot 4 (O2): Escalation and Manual Responder Assignment
    escalateAlert: async (req, res) => {
      const reason = req.body?.reason || 'Escalated by Operations Officer.';
      const result = await collarService.escalateAlert(req.params.id, reason);
      return sendSuccess(res, result);
    },

    listCandidateResponders: async (req, res) => {
      const candidates = await collarService.listCandidateResponders(req.params.id);
      return sendSuccess(res, candidates);
    },

    manualAssignResponder: async (req, res) => {
      const officerId = req.user ? req.user.id : req.body?.officerId || 'OFF-01';
      const result = await collarService.manualAssignResponder(req.params.id, {
        responderId: req.body?.responderId,
        officerId,
        officerNotes: req.body?.officerNotes,
      });
      return sendSuccess(res, result);
    },

    // Screenshot 5 (O3): Camera-Trap Detection & Review Queue
    handleCameraTrap: async (req, res) => {
      const result = await collarService.handleCameraTrapImage(req.body || {});
      return sendSuccess(res, result);
    },

    listPendingCameraTraps: async (_req, res) => {
      const reviews = await collarService.listPendingCameraTrapReviews();
      return sendSuccess(res, reviews);
    },

    reviewCameraTrap: async (req, res) => {
      const officerId = req.user ? req.user.id : req.body?.officerId || 'OFF-01';
      const result = await collarService.reviewCameraTrapImage(req.params.id, {
        ...(req.body || {}),
        officerId,
      });
      return sendSuccess(res, result);
    },

    // Screenshot 6: Signal Lost & Resolution with reason
    checkCollarHealth: async (_req, res) => {
      const result = await collarService.checkCollarHealth();
      return sendSuccess(res, result);
    },

    simulateSignalLost: async (req, res) => {
      const result = await collarService.simulateSignalLost(req.params.id);
      return sendSuccess(res, result);
    },

    resolveAlert: async (req, res) => {
      const officerId = req.user ? req.user.id : req.body?.officerId || 'OFF-01';
      const result = await collarService.resolveAlert(req.params.id, {
        reason: req.body?.reason,
        officerId,
        notes: req.body?.notes,
      });
      return sendSuccess(res, result);
    },

    // Backwards-compatible methods
    acknowledgeAlert: async (req, res) => {
      const officerId = req.user ? req.user.id : req.body?.officerId || 'OFF-01';
      const result = await collarService.acknowledgeAlert(req.params.id, {
        ...(req.body || {}),
        officerId,
      });
      return sendSuccess(res, result);
    },

    markFalseAlarm: async (req, res) => {
      const officerId = req.user ? req.user.id : req.body?.officerId || 'OFF-01';
      const result = await collarService.markFalseAlarm(req.params.id, {
        ...(req.body || {}),
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

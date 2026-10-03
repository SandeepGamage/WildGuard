const { sendSuccess } = require('../utils/response');

/** @param {{ officerService: object }} deps */
function createOfficerController({ officerService }) {
  return {
    queue: async (req, res) => sendSuccess(res, await officerService.getQueue(req.user)),

    getIncident: async (req, res) =>
      sendSuccess(res, await officerService.getIncident(req.user, req.validated.params.id)),

    startReview: async (req, res) =>
      sendSuccess(res, await officerService.startReview(req.user, req.validated.params.id)),

    verify: async (req, res) =>
      sendSuccess(res, await officerService.verify(req.user, req.validated.params.id, req.validated.body), {
        message: 'Report verified.',
      }),

    reject: async (req, res) =>
      sendSuccess(res, await officerService.reject(req.user, req.validated.params.id, req.validated.body), {
        message: 'Report rejected.',
      }),

    map: async (req, res) => sendSuccess(res, await officerService.getMap(req.user)),

    history: async (req, res) =>
      sendSuccess(res, await officerService.getHistory(req.user, req.validated.query)),
  };
}

module.exports = { createOfficerController };

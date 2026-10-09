const { sendSuccess } = require('../utils/response');

/** @param {{ patrolService: object, photoService: object }} deps */
function createPatrolController({ patrolService, photoService }) {
  return {
    sync: async (req, res) => sendSuccess(res, await patrolService.sync(req.user, req.validated.body)),

    createPhotoUpload: async (req, res) =>
      sendSuccess(res, await photoService.createUploadTicket(req.user, req.validated.body), { status: 201 }),
  };
}

module.exports = { createPatrolController };

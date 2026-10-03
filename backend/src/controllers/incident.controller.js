const { sendSuccess } = require('../utils/response');

/** @param {{ incidentService: object, photoService: object }} deps */
function createIncidentController({ incidentService, photoService }) {
  return {
    create: async (req, res) => {
      const { report, created } = await incidentService.createFromApp(req.user, req.validated.body);
      return sendSuccess(res, report, {
        status: created ? 201 : 200,
        message: created ? 'Report received.' : 'Report already received.',
      });
    },

    listMine: async (req, res) =>
      sendSuccess(res, await incidentService.listMine(req.user, req.validated.query)),

    getMine: async (req, res) =>
      sendSuccess(res, await incidentService.getMine(req.user, req.validated.params.id)),

    createPhotoUpload: async (req, res) =>
      sendSuccess(res, await photoService.createUploadTicket(req.user, req.validated.body), { status: 201 }),
  };
}

module.exports = { createIncidentController };

const { sendSuccess } = require('../utils/response');

/** @param {{ smsService: object }} deps */
function createSmsController({ smsService }) {
  return {
    simulate: async (req, res) => {
      const result = await smsService.handleInbound(req.validated.body);
      return sendSuccess(res, result, {
        message: result.accepted ? 'Report accepted.' : 'Message not understood.',
      });
    },
  };
}

module.exports = { createSmsController };

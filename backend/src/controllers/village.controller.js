const { sendSuccess } = require('../utils/response');

/** @param {{ villageService: object }} deps */
function createVillageController({ villageService }) {
  return {
    list: async (_req, res) => sendSuccess(res, await villageService.list()),
  };
}

module.exports = { createVillageController };

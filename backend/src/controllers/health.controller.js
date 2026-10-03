const { sendSuccess } = require('../utils/response');

const getHealth = (_req, res) =>
  sendSuccess(res, { status: 'ok', time: new Date().toISOString() }, { message: 'Healthy' });

module.exports = { getHealth };

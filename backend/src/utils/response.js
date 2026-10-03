/**
 * Standard success envelope: { success: true, data, message }.
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {{ status?: number, message?: string }} [options]
 */
function sendSuccess(res, data, { status = 200, message = 'OK' } = {}) {
  return res.status(status).json({ success: true, data, message });
}

module.exports = { sendSuccess };

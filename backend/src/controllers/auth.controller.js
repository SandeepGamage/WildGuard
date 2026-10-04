const { sendSuccess } = require('../utils/response');
const { presentProfile } = require('../models/profile.model');

/** @param {{ authService: object }} deps */
function createAuthController({ authService }) {
  return {
    me: async (req, res) => sendSuccess(res, presentProfile(await authService.me(req.user))),

    register: async (req, res) => {
      const profile = await authService.registerVillager(req.validated.body);
      return sendSuccess(res, presentProfile(profile), {
        status: 201,
        message: 'Account created. You can now sign in.',
      });
    },

    login: async (req, res) => {
      const result = await authService.login(req.validated.body);
      return sendSuccess(
        res,
        {
          profile: presentProfile(result.profile),
          accessToken: result.accessToken,
        },
        { message: 'Signed in successfully.' },
      );
    },
  };
}

module.exports = { createAuthController };

const { sendSuccess } = require('../utils/response');

/** @param {{ analyticsService: object }} deps */
function createAnalyticsController({ analyticsService }) {
  return {
    parks: async (_req, res) => sendSuccess(res, await analyticsService.listParks()),

    generate: async (req, res) => {
      const report = await analyticsService.generateConservationReport(req.user, req.validated.body);
      return sendSuccess(res, report, {
        status: report.empty ? 200 : 201,
        message: report.empty ? 'No records match these filters.' : 'Report generated.',
      });
    },

    list: async (req, res) =>
      sendSuccess(res, await analyticsService.listReports(req.user, req.validated.query)),

    getReport: async (req, res) =>
      sendSuccess(res, await analyticsService.getReport(req.user, req.validated.params.id)),

    exportReport: async (req, res) => {
      const file = await analyticsService.exportReport(
        req.user,
        req.validated.params.id,
        req.validated.query,
      );
      res.set({
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Content-Length': String(file.content.length),
        'Cache-Control': 'no-store',
      });
      return res.status(200).send(file.content);
    },
  };
}

module.exports = { createAnalyticsController };

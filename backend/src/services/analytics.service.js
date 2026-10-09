const { badRequest, notFound, serviceUnavailable } = require('../errors/AppError');
const { ANALYTICS_RULES } = require('../constants/domain');
const { PARKS, findPark } = require('../constants/parks');
const { DAY_MS } = require('../utils/time');

/** The manager's calendar dates are Sri Lanka dates (UTC+05:30). */
const startOfLocalDay = (isoDate) => new Date(`${isoDate}T00:00:00+05:30`);

const invalid = (issues) => badRequest('VALIDATION_FAILED', 'Some filters are invalid.', { issues });

const presentPark = (park) => ({ id: park.id, name: park.name, block: park.block, boundary: park.boundary });

/** API view of a report. The per-incident list is only used by the exporters. */
function presentReport(report, park) {
  return {
    id: report.id,
    park: presentPark(park),
    generatedAt: report.generatedAt,
    filter: report.filter,
    stats: report.stats,
    trends: report.trends,
    coverage: report.coverage,
    heatmap: report.heatmap,
    topHotspots: report.topHotspots,
    landmarks: report.landmarks ?? [],
    patrolPoints: report.patrolPoints ?? [],
  };
}

/**
 * Plays the AnalyticsController role of the design (Fig 11, Fig 19–20): validates
 * the filters, asks AnalyticsReportService for the report, and exports a saved
 * report by id through the ExportEngine.
 */
class AnalyticsService {
  /**
   * @param {{ analyticsRepository: object, analyticsReportService: object, exportEngine: object, logger: object }} deps
   */
  constructor(deps) {
    Object.assign(this, deps);
  }

  /** Parks and their sectors, for the filter bar. */
  async listParks() {
    return Promise.all(
      PARKS.map(async (park) => ({
        ...presentPark(park),
        sectors: await this.#read(() => this.analyticsRepository.listSectors(park.name)),
      })),
    );
  }

  /**
   * Step 4 (Fig 19): business rules on the filter (exception E1). Field names
   * match the request body so the dashboard can highlight the right input.
   * @param {{ dateFrom: string, dateTo: string, parkId: string }} input
   * @returns {object} The park the filter refers to.
   */
  validateFilters(input) {
    const issues = [];
    if (input.dateTo < input.dateFrom) {
      issues.push({ field: 'body.dateTo', message: '"To" date is before "From" date.' });
    } else {
      const limit = `${Number(input.dateFrom.slice(0, 4)) + ANALYTICS_RULES.MAX_RANGE_YEARS}${input.dateFrom.slice(4)}`;
      if (input.dateTo > limit) {
        issues.push({
          field: 'body.dateTo',
          message: `The date range can be at most ${ANALYTICS_RULES.MAX_RANGE_YEARS} years.`,
        });
      }
    }
    const park = findPark(input.parkId);
    if (!park) issues.push({ field: 'body.parkId', message: 'Choose a park.' });
    if (issues.length) throw invalid(issues);
    return park;
  }

  /**
   * UC4 main flow steps 1–9.
   * @param {{ id: string }} user Park manager.
   * @param {{ dateFrom: string, dateTo: string, parkId: string, reportType: string,
   *   incidentTypes: string[], bandwidthMetres?: number }} input Validated request body.
   */
  async generateConservationReport(user, input) {
    const park = this.validateFilters(input);
    const sectors = await this.#read(() => this.analyticsRepository.listSectors(park.name));
    const dateFrom = startOfLocalDay(input.dateFrom);
    const dateTo = new Date(startOfLocalDay(input.dateTo).getTime() + DAY_MS);
    const label = {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      parkId: park.id,
      reportType: input.reportType,
      incidentTypes: input.incidentTypes,
    };

    const report = await this.analyticsReportService.buildReport(
      {
        dateFrom,
        dateTo,
        park,
        sectors,
        reportType: input.reportType,
        incidentTypes: input.incidentTypes,
        bandwidthMetres: input.bandwidthMetres ?? ANALYTICS_RULES.DEFAULT_BANDWIDTH_M,
        label,
      },
      user.id,
    );
    return report.empty ? { empty: true, filter: label } : presentReport(report, park);
  }

  async getReport(_user, reportId) {
    const report = await this.#findReport(reportId);
    return presentReport(report, findPark(report.parkId));
  }

  /** Saved reports of this manager, newest first. */
  async listReports(user, { limit }) {
    const reports = await this.#read(() => this.analyticsRepository.listReports(user.id, limit));
    return reports.map((r) => ({
      id: r.id,
      generatedAt: r.generatedAt,
      filter: r.filter,
      parkName: findPark(r.parkId)?.name ?? r.parkId,
      totalIncidents: r.stats?.totalIncidents ?? 0,
    }));
  }

  /**
   * UC4c (Fig 20): the report is fetched by id on the server, never sent back by the client.
   * @returns {Promise<{ filename: string, contentType: string, content: Buffer }>}
   */
  async exportReport(_user, reportId, { format, sections }) {
    const report = await this.#findReport(reportId);
    return this.exportEngine.generateFile({ ...report, park: findPark(report.parkId) }, format, sections);
  }

  async #findReport(reportId) {
    const report = await this.#read(() => this.analyticsRepository.findReport(reportId));
    if (!report) throw notFound('REPORT_NOT_FOUND', 'This report does not exist.');
    return report;
  }

  async #read(query) {
    try {
      return await query();
    } catch (error) {
      this.logger.error('Analytics read failed', { message: error.message });
      throw serviceUnavailable(
        'DATA_SOURCE_UNAVAILABLE',
        'The data source is unavailable. Please try again.',
      );
    }
  }
}

module.exports = { AnalyticsService, presentReport };

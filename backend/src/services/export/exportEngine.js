const { AppError, badRequest } = require('../../errors/AppError');
const { EXPORT_FORMATS } = require('../../constants/domain');
const { PdfExporter } = require('./pdf.exporter');
const { CsvExporter } = require('./csv.exporter');

/**
 * ExportEngine (Fig 11). Picks a ReportExporter by format (Strategy pattern),
 * so a new format is a new exporter, not a change here (open/closed).
 */
class ExportEngine {
  /** @param {{ exporters?: Record<string, { export: Function }>, logger: object }} deps */
  constructor({ exporters, logger }) {
    this.exporters = exporters ?? {
      [EXPORT_FORMATS.PDF]: new PdfExporter(),
      [EXPORT_FORMATS.CSV]: new CsvExporter(),
    };
    this.logger = logger;
  }

  /**
   * @param {object} report ConservationReport.
   * @param {string} format Value from EXPORT_FORMATS.
   * @param {string[]} sections Values from EXPORT_SECTIONS.
   * @returns {Promise<{ filename: string, contentType: string, content: Buffer }>}
   */
  async generateFile(report, format, sections) {
    const exporter = this.#getExporter(format);
    try {
      return await exporter.export(report, sections);
    } catch (error) {
      this.logger.error('Report export failed', { format, message: error.message });
      throw new AppError(
        500,
        'EXPORT_FAILED',
        'The file could not be created. Try again or use another format.',
        {
          format,
        },
      );
    }
  }

  #getExporter(format) {
    const exporter = this.exporters[format];
    if (!exporter) throw badRequest('UNSUPPORTED_FORMAT', 'This export format is not supported.');
    return exporter;
  }
}

module.exports = { ExportEngine };

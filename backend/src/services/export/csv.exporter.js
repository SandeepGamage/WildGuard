const { EXPORT_SECTIONS } = require('../../constants/domain');
const { typeLabel, monthLabel, kpiRows, reportFileName, REPORT_TYPE_LABELS } = require('./reportText');

const UTF8_BOM = String.fromCharCode(0xfeff);

/** RFC 4180 field: quote when it holds a comma, quote or line break; neutralise spreadsheet formulas. */
function csvField(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text) && Number.isNaN(Number(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvRow = (fields) => fields.map(csvField).join(',');

/** CsvExporter (ReportExporter strategy): raw rows for research use. */
class CsvExporter {
  /**
   * @param {object} report ConservationReport.
   * @param {string[]} sections Values from EXPORT_SECTIONS.
   * @returns {{ filename: string, contentType: string, content: Buffer }}
   */
  export(report, sections) {
    const lines = [
      csvRow(['WildGuard LK conservation report']),
      csvRow(['Park', report.park?.name ?? report.parkId]),
      csvRow(['Period', `${report.filter.dateFrom} to ${report.filter.dateTo}`]),
      csvRow(['Report type', REPORT_TYPE_LABELS[report.filter.reportType] ?? report.filter.reportType]),
      csvRow(['Generated at', new Date(report.generatedAt).toISOString()]),
    ];
    const section = (title, header, rows) => {
      lines.push('', csvRow([title]), csvRow(header), ...rows.map(csvRow));
    };

    if (sections.includes(EXPORT_SECTIONS.KPI_SUMMARY)) {
      section('KPI summary', ['Metric', 'Value', 'Note'], kpiRows(report));
      section(
        'Incidents by type',
        ['Type', 'Count'],
        report.stats.byType.map((row) => [typeLabel(row.type), row.count]),
      );
      section(
        'Incidents by sector',
        ['Sector', 'Count'],
        report.stats.bySector.map((row) => [row.name, row.count]),
      );
      section(
        'Incidents by month',
        ['Month', 'Count'],
        report.stats.byMonth.map((row) => [monthLabel(row.month), row.count]),
      );
    }
    if (sections.includes(EXPORT_SECTIONS.HOTSPOT_MAP)) {
      section(
        'Top hotspots',
        ['Area', 'Incidents', 'Main type'],
        report.topHotspots.map((row) => [row.area, row.incidents, typeLabel(row.mainType)]),
      );
      section(
        `Hotspot density grid (kernel density, ${report.heatmap?.bandwidthMetres ?? '-'} m bandwidth)`,
        ['Latitude', 'Longitude', 'Incidents per km2'],
        (report.heatmap?.cells ?? []).map((cell) => [
          cell.latitude.toFixed(5),
          cell.longitude.toFixed(5),
          cell.density.toFixed(3),
        ]),
      );
    }
    if (sections.includes(EXPORT_SECTIONS.COVERAGE_GAPS)) {
      section(
        'Coverage gaps (sectors not patrolled > 14 days)',
        ['Sector', 'Last patrolled', 'Days since patrol'],
        report.coverage.available
          ? report.coverage.unpatrolledSectors.map((row) => [
              row.name,
              row.lastPatrolledAt,
              row.daysSincePatrol,
            ])
          : [['Patrol data (UC1) not connected yet', '', '']],
      );
    }
    if (sections.includes(EXPORT_SECTIONS.CONFLICT_TRENDS)) {
      section(
        'Human-wildlife conflict by month',
        ['Month', ...report.trends.series.map((s) => typeLabel(s.type)), 'Total'],
        report.trends.months.map((month, index) => [
          monthLabel(month),
          ...report.trends.series.map((s) => s.counts[index]),
          report.trends.totals[index],
        ]),
      );
    }
    if (sections.includes(EXPORT_SECTIONS.INCIDENT_LIST)) {
      section(
        'Incident list (verified only; no reporter details)',
        ['Reference', 'Type', 'Occurred at', 'Village', 'Sector', 'Latitude', 'Longitude'],
        report.incidents.map((i) => [
          i.trackingCode,
          typeLabel(i.incidentType),
          i.occurredAt ? new Date(i.occurredAt) : null,
          i.villageName,
          i.sectorName,
          i.latitude,
          i.longitude,
        ]),
      );
    }

    return {
      filename: reportFileName(report, 'csv'),
      contentType: 'text/csv; charset=utf-8',
      // A byte-order mark lets Excel open the Sinhala/Tamil place names as UTF-8.
      content: Buffer.from(`${UTF8_BOM}${lines.join('\r\n')}\r\n`, 'utf8'),
    };
  }
}

module.exports = { CsvExporter, csvField };

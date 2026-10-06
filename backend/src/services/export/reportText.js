/** Shared, human-readable labels used by both exporters. */

const TYPE_LABELS = Object.freeze({
  ELEPHANT_NEAR_VILLAGE: 'Elephant near village',
  CROP_DAMAGE: 'Crop damage',
  PROPERTY_DAMAGE: 'House / property damage',
  PERSON_INJURED: 'Person injured',
  SNARE_POACHING: 'Snares / suspected poaching',
  OTHER_ANIMAL: 'Other animal',
});

const REPORT_TYPE_LABELS = Object.freeze({
  INCIDENT_SUMMARY: 'Incident summary',
  HOTSPOT_MAP: 'Hotspot map',
  PATROL_COVERAGE: 'Patrol coverage',
  HUMAN_WILDLIFE_CONFLICT: 'Human-wildlife conflict',
});

const typeLabel = (type) => TYPE_LABELS[type] ?? type;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-06' -> 'Jun 2026' */
const monthLabel = (key) => `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

/** KPI rows shared by the PDF and CSV summaries. */
function kpiRows(report) {
  const { stats, coverage } = report;
  const change =
    stats.changePercent === null ? 'n/a' : `${stats.changePercent > 0 ? '+' : ''}${stats.changePercent}%`;
  return [
    ['Incidents', String(stats.totalIncidents), `${change} vs previous period`],
    [
      'Verified community reports',
      String(stats.communityReports.verified),
      `of ${stats.communityReports.received} received`,
    ],
    [
      'Patrol coverage',
      coverage.available ? `${coverage.coveragePercent}%` : 'Not available',
      coverage.available
        ? `${coverage.unpatrolledSectors.length} sector(s) not patrolled > 14 days`
        : 'Patrol data (UC1) not connected yet',
    ],
    ['Human-elephant conflict', String(stats.conflictEvents), `events, ${stats.injuries} injuries`],
  ];
}

const reportFileName = (report, extension) =>
  `wildguard-${report.parkId ?? report.park?.id}-${report.filter.dateFrom}-to-${report.filter.dateTo}.${extension}`;

module.exports = { typeLabel, monthLabel, kpiRows, reportFileName, REPORT_TYPE_LABELS };

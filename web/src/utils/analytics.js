import { ANALYTICS_RULES, REPORT_INCIDENT_TYPES } from '../constants';

const pad = (value) => String(value).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const toIsoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The same calendar day `months` months earlier (clamped to the month's last day). */
export function monthsBefore(isoDate, months) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const target = new Date(year, month - 1 - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toIsoDate(target);
}

/** Starting filters: the last three months, every incident type. The manager picks the report type. */
export function defaultFilters(parkId = '', today = new Date()) {
  const dateTo = toIsoDate(today);
  return {
    dateFrom: monthsBefore(dateTo, ANALYTICS_RULES.DEFAULT_RANGE_MONTHS),
    dateTo,
    parkId,
    reportType: '',
    incidentTypes: [...REPORT_INCIDENT_TYPES],
  };
}

/** Alternate flow A2: keep the end date and widen the start to N months earlier. */
export const widenFilters = (filters, months = ANALYTICS_RULES.DEFAULT_RANGE_MONTHS) => ({
  ...filters,
  dateFrom: monthsBefore(filters.dateTo, months),
});

/**
 * Backend validation issues ("body.dateTo") -> { dateTo: message } for highlighting fields (E1).
 * @param {{ code?: string, details?: { issues?: Array<{ field: string, message: string }> } }} error
 */
export function fieldErrors(error) {
  if (error?.code !== 'VALIDATION_FAILED') return {};
  return (error.details?.issues ?? []).reduce((errors, issue) => {
    const field = issue.field.replace(/^body\./, '').split('.')[0];
    if (!errors[field]) errors[field] = issue.message;
    return errors;
  }, {});
}

/** "+12%", "−5%", or null when there is no previous period to compare with. */
export function formatChange(percent) {
  if (percent === null || percent === undefined) return null;
  if (percent > 0) return `+${percent}%`;
  if (percent < 0) return `−${Math.abs(percent)}%`;
  return '0%';
}

/** Readable legend value: 0.064 -> "0.06", 1.5 -> "1.5", 12.3 -> "12". */
export function formatDensity(value) {
  if (value >= 10) return String(Math.round(value));
  if (value >= 1) return String(Math.round(value * 10) / 10);
  return String(Math.round(value * 100) / 100);
}

/** "2026-06" -> "Jun" (or "Jun 26" when the range spans years). */
export function monthLabel(key, withYear = false) {
  const date = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
  const month = date.toLocaleString('en-US', { month: 'short' });
  return withYear ? `${month} ${key.slice(2, 4)}` : month;
}

/** Leaflet bounds [[south, west], [north, east]] of a heatmap cell. */
export function cellBounds(cell, cellSizeDeg) {
  const halfLat = cellSizeDeg.latitude / 2;
  const halfLng = cellSizeDeg.longitude / 2;
  return [
    [cell.latitude - halfLat, cell.longitude - halfLng],
    [cell.latitude + halfLat, cell.longitude + halfLng],
  ];
}

/** Leaflet bounds that contain a list of points (park outline). */
export function pointsBounds(points) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

const DATE_LOCALES = { en: 'en-GB', si: 'si-LK', ta: 'ta-LK' };

/** "2026-06-01" -> "1 Jun 2026" in the UI language (parsed as a local calendar date). */
export function formatDate(isoDate, language = 'en', { withYear = true } = {}) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(DATE_LOCALES[language] ?? 'en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** "1 Jun – 31 Aug 2026" (the start keeps its year only when the range spans years). */
export function formatDateRange(from, to, language = 'en') {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDate(from, language, { withYear: !sameYear })} – ${formatDate(to, language)}`;
}

/** Hotspot level from an area's incidents relative to the busiest area: high, medium or low. */
export function hotspotLevel(incidents, maxIncidents) {
  const share = maxIncidents > 0 ? incidents / maxIncidents : 0;
  if (share >= 2 / 3) return 'high';
  if (share >= 1 / 3) return 'medium';
  return 'low';
}

/** The calendar day `days` days before an ISO date. */
export function daysBefore(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return toIsoDate(new Date(year, month - 1, day - days));
}
/** Saved reports open newest first. */
export const DEFAULT_SAVED_SORT = Object.freeze({ key: 'generated', direction: 'desc' });

const SAVED_SORT_VALUES = {
  period: (item) => `${item.filter.dateFrom}|${item.filter.dateTo}`,
  park: (item) => item.parkName ?? '',
  type: (item, typeLabel) => typeLabel(item.filter.reportType),
  incidents: (item) => item.totalIncidents ?? 0,
  generated: (item) => new Date(item.generatedAt).getTime(),
};
export const SAVED_SORT_KEYS = Object.freeze(Object.keys(SAVED_SORT_VALUES));

/** Choices in the Sort menu, most useful first. Together they cover every column and direction. */
export const SAVED_SORT_OPTIONS = Object.freeze(
  [
    ['generated', 'desc'],
    ['generated', 'asc'],
    ['incidents', 'desc'],
    ['incidents', 'asc'],
    ['period', 'desc'],
    ['period', 'asc'],
    ['park', 'asc'],
    ['park', 'desc'],
    ['type', 'asc'],
    ['type', 'desc'],
  ].map(([key, direction]) => Object.freeze({ key, direction, id: `${key}_${direction}` })),
);

/** Text columns start A–Z; numbers and dates start with the largest / newest. */
const firstDirection = (key) => (['park', 'type'].includes(key) ? 'asc' : 'desc');

/** Clicking the sorted column flips the direction; another column starts in its natural order. */
export const nextSort = (current, key) =>
  current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { key, direction: firstDirection(key) };

/**
 * Saved reports in the chosen order (a new array). Ties fall back to newest first.
 * @param {(type: string) => string} [typeLabel] Sorts report types by their shown label.
 */
export function sortSavedReports(items, { key, direction }, typeLabel = (type) => type) {
  const value = SAVED_SORT_VALUES[key] ?? SAVED_SORT_VALUES.generated;
  const factor = direction === 'asc' ? 1 : -1;
  const newest = SAVED_SORT_VALUES.generated;
  return [...items].sort((a, b) => {
    const left = value(a, typeLabel);
    const right = value(b, typeLabel);
    const order = typeof left === 'number' ? left - right : String(left).localeCompare(String(right));
    return order * factor || newest(b) - newest(a);
  });
}

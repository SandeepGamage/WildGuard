/** Values shared with the backend (backend/src/constants/domain.js). */
export const USER_ROLES = Object.freeze({ PARK_MANAGER: 'PARK_MANAGER' });

export const INCIDENT_TYPES = Object.freeze({
  ELEPHANT_NEAR_VILLAGE: 'ELEPHANT_NEAR_VILLAGE',
  CROP_DAMAGE: 'CROP_DAMAGE',
  PROPERTY_DAMAGE: 'PROPERTY_DAMAGE',
  PERSON_INJURED: 'PERSON_INJURED',
  SNARE_POACHING: 'SNARE_POACHING',
  OTHER_ANIMAL: 'OTHER_ANIMAL',
});

/** Types only rangers log on patrol (UC1); snares and "other animal" are shared with community reports. */
export const RANGER_INCIDENT_TYPES = Object.freeze({
  CARCASS: 'CARCASS',
  ELEPHANT_SIGHTING: 'ELEPHANT_SIGHTING',
  ILLEGAL_ACTIVITY: 'ILLEGAL_ACTIVITY',
  OTHER: 'OTHER',
});

/** Every incident type a report covers and filters on (backend ANALYTICS_INCIDENT_TYPES). */
export const REPORT_INCIDENT_TYPES = Object.freeze([
  ...Object.values(INCIDENT_TYPES),
  ...Object.values(RANGER_INCIDENT_TYPES),
]);

/** ReportType enumeration (Fig 7). */
export const REPORT_TYPES = Object.freeze({
  INCIDENT_SUMMARY: 'INCIDENT_SUMMARY',
  HOTSPOT_MAP: 'HOTSPOT_MAP',
  PATROL_COVERAGE: 'PATROL_COVERAGE',
  HUMAN_WILDLIFE_CONFLICT: 'HUMAN_WILDLIFE_CONFLICT',
});

export const EXPORT_FORMATS = Object.freeze({ PDF: 'PDF', CSV: 'CSV' });

/** Sections a manager can include in an exported report (wireframe A2). */
export const EXPORT_SECTIONS = Object.freeze({
  KPI_SUMMARY: 'KPI_SUMMARY',
  HOTSPOT_MAP: 'HOTSPOT_MAP',
  COVERAGE_GAPS: 'COVERAGE_GAPS',
  CONFLICT_TRENDS: 'CONFLICT_TRENDS',
  INCIDENT_LIST: 'INCIDENT_LIST',
});

export const DEFAULT_EXPORT_SECTIONS = Object.freeze([
  EXPORT_SECTIONS.KPI_SUMMARY,
  EXPORT_SECTIONS.HOTSPOT_MAP,
  EXPORT_SECTIONS.COVERAGE_GAPS,
  EXPORT_SECTIONS.CONFLICT_TRENDS,
]);

/** Export sections ticked by default for each report type, so the file matches what the type is about. */
export const EXPORT_SECTIONS_BY_TYPE = Object.freeze({
  [REPORT_TYPES.INCIDENT_SUMMARY]: [
    EXPORT_SECTIONS.KPI_SUMMARY,
    EXPORT_SECTIONS.CONFLICT_TRENDS,
    EXPORT_SECTIONS.INCIDENT_LIST,
  ],
  [REPORT_TYPES.HOTSPOT_MAP]: [EXPORT_SECTIONS.KPI_SUMMARY, EXPORT_SECTIONS.HOTSPOT_MAP],
  [REPORT_TYPES.PATROL_COVERAGE]: [EXPORT_SECTIONS.KPI_SUMMARY, EXPORT_SECTIONS.COVERAGE_GAPS],
  [REPORT_TYPES.HUMAN_WILDLIFE_CONFLICT]: [
    EXPORT_SECTIONS.KPI_SUMMARY,
    EXPORT_SECTIONS.CONFLICT_TRENDS,
    EXPORT_SECTIONS.HOTSPOT_MAP,
  ],
});

export const ANALYTICS_RULES = Object.freeze({
  DEFAULT_RANGE_MONTHS: 3,
  UNPATROLLED_DAYS: 14,
});

/** Viridis ramp (colour-blind safe), one colour per heatmap level 0–4 from the backend. */
export const HEAT_COLORS = Object.freeze(['#3b528b', '#2c728e', '#21918c', '#5ec962', '#fde725']);

/** Ranger GPS points on the hotspot map: an orange that stands apart from the viridis heat colours. */
export const RANGER_POINT_COLOR = '#eb6834';

/** Conflict-trend chart series colours, from the WildGuard palette. */
export const SERIES_COLORS = Object.freeze(['#0c3b2e', '#6d9773', '#bb8a52', '#c94f45']);

/** Conflict-over-time chart colours, from the WildGuard palette. */
export const CHART_COLORS = Object.freeze({
  line: '#6d9773',
  area: '#e8f0eb',
  grid: '#e4ebe6',
  peak: '#bb8a52',
});

export const LANGUAGES = Object.freeze([
  { code: 'en', label: 'English' },
  { code: 'si', label: 'සිංහල' },
  { code: 'ta', label: 'தமிழ்' },
]);

export const ROUTES = Object.freeze({
  login: '/login',
  reports: '/',
  report: (id) => `/?reportId=${encodeURIComponent(id)}`,
  saved: '/saved',
});

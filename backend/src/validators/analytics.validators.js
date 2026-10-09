const { z } = require('zod');
const { enumOf } = require('./common');
const {
  REPORT_TYPES,
  ANALYTICS_INCIDENT_TYPES,
  EXPORT_FORMATS,
  EXPORT_SECTIONS,
} = require('../constants/domain');

/** Calendar date as the manager picked it (YYYY-MM-DD, Sri Lanka time). */
const isoDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}, 'Use a valid date (YYYY-MM-DD).');

/** Shape-only checks; the business rules (order, 3-year limit, known park) live in validateFilters. */
const reportBody = z.object({
  dateFrom: isoDate,
  dateTo: isoDate,
  parkId: z.string().trim().min(1, 'Choose a park.').max(40),
  reportType: enumOf(REPORT_TYPES).default(REPORT_TYPES.HOTSPOT_MAP),
  // Community report types and ranger patrol types (UC1).
  incidentTypes: z
    .array(z.enum(ANALYTICS_INCIDENT_TYPES))
    .min(1, 'Choose at least one incident type.')
    .default([...ANALYTICS_INCIDENT_TYPES]),
  bandwidthMetres: z.number().int().min(100).max(5000).optional(),
});

const DEFAULT_SECTIONS = [
  EXPORT_SECTIONS.KPI_SUMMARY,
  EXPORT_SECTIONS.HOTSPOT_MAP,
  EXPORT_SECTIONS.COVERAGE_GAPS,
  EXPORT_SECTIONS.CONFLICT_TRENDS,
];

const exportQuery = z.object({
  format: enumOf(EXPORT_FORMATS),
  sections: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? [
            ...new Set(
              value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            ),
          ]
        : DEFAULT_SECTIONS,
    )
    .pipe(z.array(enumOf(EXPORT_SECTIONS)).min(1, 'Choose at least one section.')),
});

const reportListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

module.exports = { reportBody, exportQuery, reportListQuery, DEFAULT_SECTIONS };

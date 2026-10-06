const { randomUUID } = require('node:crypto');
const { serviceUnavailable } = require('../errors/AppError');
const { ANALYTICS_RULES, INCIDENT_TYPES } = require('../constants/domain');
const { distanceM } = require('../utils/geo');
const { DAY_MS, MINUTE_MS } = require('../utils/time');

/** Months are bucketed in Sri Lanka time (UTC+05:30). */
const LOCAL_OFFSET_MS = 330 * MINUTE_MS;
/** An incident is named after a village when it lies within this distance. */
const HOTSPOT_VILLAGE_RADIUS_M = 3000;

const monthKey = (date) => new Date(new Date(date).getTime() + LOCAL_OFFSET_MS).toISOString().slice(0, 7);

/** 'YYYY-MM' keys from dateFrom up to (but excluding) dateTo. */
function monthsBetween(dateFrom, dateTo) {
  const months = [];
  const last = monthKey(new Date(dateTo).getTime() - 1);
  let [year, month] = monthKey(dateFrom).split('-').map(Number);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key >= last) return months;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

const countBy = (items, keyOf) =>
  items.reduce((counts, item) => {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

/**
 * Step 16 (Fig 19): totals by type, sector and month, with the previous-period comparison.
 * @param {object} dataset AnalyticsDataset from the repository.
 * @param {{ id: string, name: string }[]} sectors
 * @param {string[]} months
 */
function aggregateIncidents(dataset, sectors, months) {
  const incidents = [...dataset.communityIncidents, ...dataset.patrolIncidents];
  const total = incidents.length;
  const previous = dataset.previousPeriodCount;
  const byTypeCounts = countBy(incidents, (i) => i.incidentType);
  const bySectorCounts = countBy(incidents, (i) => i.sectorId);
  const byMonthCounts = countBy(incidents, (i) => monthKey(i.occurredAt));
  return {
    totalIncidents: total,
    previousPeriodTotal: previous,
    changePercent: previous > 0 ? Math.round(((total - previous) / previous) * 100) : null,
    byType: Object.values(INCIDENT_TYPES)
      .map((type) => ({ type, count: byTypeCounts[type] ?? 0 }))
      .filter((row) => row.count > 0),
    bySector: sectors.map((s) => ({ sectorId: s.id, name: s.name, count: bySectorCounts[s.id] ?? 0 })),
    byMonth: months.map((month) => ({ month, count: byMonthCounts[month] ?? 0 })),
    communityReports: {
      received: dataset.receivedCommunityReports,
      verified: dataset.communityIncidents.length,
    },
    patrolIncidents: dataset.patrolIncidents.length,
    collarAlerts: dataset.collarAlerts.length,
    conflictEvents: incidents.filter((i) => ANALYTICS_RULES.CONFLICT_TYPES.includes(i.incidentType)).length,
    injuries: byTypeCounts[INCIDENT_TYPES.PERSON_INJURED] ?? 0,
  };
}

/**
 * Step 17: human–wildlife conflict trend, one series per conflict type.
 * @param {{ incidentType: string, occurredAt: Date }[]} incidents
 * @param {string[]} months
 */
function computeConflictTrends(incidents, months) {
  const conflict = incidents.filter((i) => ANALYTICS_RULES.CONFLICT_TYPES.includes(i.incidentType));
  const series = ANALYTICS_RULES.CONFLICT_TYPES.map((type) => {
    const counts = countBy(
      conflict.filter((i) => i.incidentType === type),
      (i) => monthKey(i.occurredAt),
    );
    return { type, counts: months.map((m) => counts[m] ?? 0) };
  });
  return {
    months,
    series,
    totals: months.map((_, index) => series.reduce((sum, s) => sum + s.counts[index], 0)),
  };
}

/**
 * Step 18: patrol coverage per sector and sectors not patrolled for too long.
 * Without UC1 patrol data the metric is reported as not available rather than 0 %.
 * @param {{ sectorId: string, startedAt: Date, endedAt: Date, hours: number }[]} tracks
 * @param {{ id: string, name: string }[]} sectors
 * @param {Date} dateTo Exclusive end of the reporting period.
 */
function computePatrolCoverage(tracks, sectors, dateTo) {
  if (tracks.length === 0) {
    return { available: false, coveragePercent: null, patrolHours: null, unpatrolledSectors: [] };
  }
  const lastPatrol = new Map();
  for (const track of tracks) {
    const ended = new Date(track.endedAt);
    if (!lastPatrol.has(track.sectorId) || lastPatrol.get(track.sectorId) < ended) {
      lastPatrol.set(track.sectorId, ended);
    }
  }
  const end = new Date(dateTo).getTime();
  const gapCutoff = end - ANALYTICS_RULES.UNPATROLLED_DAYS * DAY_MS;
  const patrolled = sectors.filter((s) => lastPatrol.has(s.id)).length;
  return {
    available: true,
    coveragePercent: sectors.length ? Math.round((patrolled / sectors.length) * 100) : 0,
    patrolHours: Math.round(tracks.reduce((sum, t) => sum + (t.hours ?? 0), 0) * 10) / 10,
    unpatrolledSectors: sectors
      .filter((s) => !lastPatrol.has(s.id) || lastPatrol.get(s.id).getTime() < gapCutoff)
      .map((s) => {
        const last = lastPatrol.get(s.id) ?? null;
        return {
          sectorId: s.id,
          name: s.name,
          lastPatrolledAt: last,
          daysSincePatrol: last ? Math.floor((end - last.getTime()) / DAY_MS) : null,
        };
      }),
  };
}

/**
 * Top-hotspot table: incidents grouped by the nearest village (or their sector).
 * @param {object[]} incidents
 * @param {{ name: string, latitude: number, longitude: number }[]} villages
 * @param {{ id: string, name: string }[]} sectors
 */
function findTopHotspots(incidents, villages, sectors, limit = ANALYTICS_RULES.TOP_HOTSPOTS) {
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));
  const areaOf = (incident) => {
    let nearest = null;
    let best = HOTSPOT_VILLAGE_RADIUS_M;
    for (const village of villages) {
      const d = distanceM(village.latitude, village.longitude, incident.latitude, incident.longitude);
      if (d <= best) {
        best = d;
        nearest = village.name;
      }
    }
    return nearest ?? sectorName.get(incident.sectorId) ?? 'Other areas';
  };
  const groups = new Map();
  for (const incident of incidents) {
    const area = areaOf(incident);
    const group = groups.get(area) ?? [];
    group.push(incident);
    groups.set(area, group);
  }
  return [...groups.entries()]
    .map(([area, items]) => {
      const types = Object.entries(countBy(items, (i) => i.incidentType)).sort((a, b) => b[1] - a[1]);
      return { area, incidents: items.length, mainType: types[0][0] };
    })
    .sort((a, b) => b.incidents - a.incidents || a.area.localeCompare(b.area))
    .slice(0, limit);
}

const dataSourceUnavailable = () =>
  serviceUnavailable('DATA_SOURCE_UNAVAILABLE', 'The report could not be generated. Your filters are kept.');

/**
 * AnalyticsReportService (Fig 11): builds a ConservationReport from the
 * analytics dataset (Fig 19 steps 8–22).
 */
class AnalyticsReportService {
  /**
   * @param {{ analyticsRepository: object, hotspotCalculator: object, logger: object, clock?: () => Date }} deps
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.clock = deps.clock ?? (() => new Date());
  }

  /**
   * @param {{ dateFrom: Date, dateTo: Date, park: object, sectors: object[], reportType: string,
   *   incidentTypes: string[], bandwidthMetres: number, label: object }} filter
   * @param {string} createdBy Park manager's user id.
   * @returns {Promise<object>} The saved report, or `{ empty: true }` when nothing matches (alternate flow A2).
   */
  async buildReport(filter, createdBy) {
    const { dateFrom, dateTo, park, sectors } = filter;
    const dataset = await this.#query({
      dateFrom,
      dateTo,
      previousFrom: new Date(dateFrom.getTime() - (dateTo.getTime() - dateFrom.getTime())),
      incidentTypes: filter.incidentTypes,
      sectorIds: sectors.map((s) => s.id),
    });

    const incidents = [...dataset.communityIncidents, ...dataset.patrolIncidents];
    if (incidents.length === 0 && dataset.collarAlerts.length === 0 && dataset.patrolTracks.length === 0) {
      return { empty: true, filter: filter.label };
    }

    const months = monthsBetween(dateFrom, dateTo);
    const points = [...incidents, ...dataset.collarAlerts].map((e) => ({
      latitude: e.latitude,
      longitude: e.longitude,
    }));
    const report = {
      id: randomUUID(),
      park: { id: park.id, name: park.name, block: park.block, boundary: park.boundary },
      createdBy,
      generatedAt: this.clock(),
      filter: filter.label,
      stats: aggregateIncidents(dataset, sectors, months),
      trends: computeConflictTrends(incidents, months),
      coverage: computePatrolCoverage(dataset.patrolTracks, sectors, dateTo),
      heatmap: this.hotspotCalculator.calculateSpatialHotspots(points, filter.bandwidthMetres, park.boundary),
      topHotspots: findTopHotspots(incidents, dataset.villages, sectors),
      // Village names and positions, used as map labels.
      landmarks: dataset.villages.map((v) => ({
        name: v.name,
        latitude: v.latitude,
        longitude: v.longitude,
      })),
      incidents: incidents.map((i) => ({
        trackingCode: i.trackingCode ?? null,
        incidentType: i.incidentType,
        occurredAt: i.occurredAt,
        villageName: i.villageName ?? null,
        sectorName: sectors.find((s) => s.id === i.sectorId)?.name ?? null,
        latitude: i.latitude,
        longitude: i.longitude,
      })),
    };

    try {
      await this.analyticsRepository.saveReport(report);
    } catch (error) {
      this.logger.error('Saving conservation report failed', { message: error.message });
      throw dataSourceUnavailable();
    }
    return report;
  }

  async #query(filter) {
    try {
      return await this.analyticsRepository.queryAnalyticsData(filter);
    } catch (error) {
      this.logger.error('Analytics data query failed', { message: error.message });
      throw dataSourceUnavailable();
    }
  }
}

module.exports = {
  AnalyticsReportService,
  aggregateIncidents,
  computeConflictTrends,
  computePatrolCoverage,
  findTopHotspots,
  monthsBetween,
  monthKey,
};

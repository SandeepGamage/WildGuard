const { CollarAlert } = require('../../models/mongo/schemas');

/** Alerts an officer closed as false alarms are not real wildlife events, so analytics leaves them out. */
const EXCLUDED_STATUSES = Object.freeze(['FALSE_ALARM']);

/**
 * Shape a stored CollarAlert (UC2) for the analytics service. Reads the fields the
 * schema actually persists: `raised_at`, GeoJSON `location.coordinates` ([lng, lat])
 * and `threat_level`. Returns null when the alert has no usable position.
 */
function toAnalyticsAlert(doc) {
  const [longitude, latitude] = doc.location?.coordinates ?? [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    occurredAt: doc.raised_at,
    latitude,
    longitude,
    severity: doc.threat_level ?? null,
  };
}

/** Builds the Mongo filter for alerts raised in the report period (`dateTo` is exclusive). */
function alertQuery(filter) {
  return {
    raised_at: { $gte: filter.dateFrom, $lt: filter.dateTo },
    status: { $nin: EXCLUDED_STATUSES },
  };
}

/** UC4 read side for collar alerts. Read-only: it never writes to the UC2 collection. */
class CollarAlertDataSource {
  /** @returns {Promise<{ occurredAt: Date, latitude: number, longitude: number, severity: string | null }[]>} */
  async listAlerts(filter) {
    const docs = await CollarAlert.find(alertQuery(filter))
      .select('raised_at location threat_level')
      .sort({ raised_at: 1 })
      .lean();
    return docs.map(toAnalyticsAlert).filter(Boolean);
  }
}

module.exports = { CollarAlertDataSource, toAnalyticsAlert, alertQuery };

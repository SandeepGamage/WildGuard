/**
 * Placeholders for the UC1 (patrol) and UC2 (collar alert) data that UC4 reads.
 * Those use cases are not merged yet, so both sources return empty lists and
 * the analytics service reports patrol coverage as "not available". When UC1
 * and UC2 land, swap these for sources that read their collections; nothing
 * else in UC4 changes.
 */
class PendingPatrolDataSource {
  /** @returns {Promise<{ sectorId: string, startedAt: Date, endedAt: Date, hours: number }[]>} */
  async listTracks(_filter) {
    return [];
  }

  /** @returns {Promise<{ incidentType: string, occurredAt: Date, latitude: number, longitude: number, sectorId: string }[]>} */
  async listIncidents(_filter) {
    return [];
  }
}

class PendingAlertDataSource {
  /** @returns {Promise<{ occurredAt: Date, latitude: number, longitude: number, severity: string }[]>} */
  async listAlerts(_filter) {
    return [];
  }
}

module.exports = { PendingPatrolDataSource, PendingAlertDataSource };

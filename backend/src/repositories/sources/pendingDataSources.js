/**
 * Empty fallbacks for the UC1 (patrol) and UC2 (collar alert) data that UC4
 * reads, used when MongoAnalyticsRepository is built without real sources.
 * The Mongo wiring passes MongoPatrolDataSource and CollarAlertDataSource.
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

class PendingTrackPointSource {
  /** @returns {Promise<{ latitude: number, longitude: number }[]>} */
  async listPoints(_filter) {
    return [];
  }
}

module.exports = { PendingPatrolDataSource, PendingAlertDataSource, PendingTrackPointSource };

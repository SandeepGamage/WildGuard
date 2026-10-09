const { DUPLICATE_RULE } = require('../constants/domain');

/** Finds an existing undecided report of the same type within 1 km and 2 hours (PostGIS). */
class DuplicateDetector {
  /** @param {{ incidentRepository: object }} deps */
  constructor({ incidentRepository }) {
    this.incidentRepository = incidentRepository;
  }

  /**
   * @param {{ incidentType: string, latitude: number, longitude: number, occurredAt: Date }} report
   * @returns {Promise<string|null>} Id of the original (root) report, or null.
   */
  detect({ incidentType, latitude, longitude, occurredAt }) {
    return this.incidentRepository.findDuplicateId({
      incidentType,
      latitude,
      longitude,
      occurredAt: occurredAt.toISOString(),
      radiusM: DUPLICATE_RULE.RADIUS_M,
      windowMinutes: DUPLICATE_RULE.WINDOW_MINUTES,
    });
  }
}

module.exports = { DuplicateDetector };

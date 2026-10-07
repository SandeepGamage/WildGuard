const { distanceM } = require('../utils/geo');
const { BREACH_SEVERITY, PROXIMITY_STATUS } = require('../constants/domain');

const SEVERITY_WEIGHT = Object.freeze({
  [BREACH_SEVERITY.CRITICAL]: 4,
  [BREACH_SEVERITY.HIGH]: 3,
  [BREACH_SEVERITY.WARNING]: 2,
  [BREACH_SEVERITY.MEDIUM]: 2,
  [BREACH_SEVERITY.LOW]: 1,
});

/**
 * Domain Service: GeofenceEngine (UC2)
 * Evaluates collar telemetry coordinates against preconfigured high-risk virtual geofences.
 * Matches SE3070 A2 Report Section 7.4.2 (Table 18) & Section 8.2.
 */
class GeofenceEngine {
  /**
   * Evaluate whether a telemetry reading breaches any risk zone (INSIDE or APPROACHING).
   *
   * @param {{ latitude: number, longitude: number }} location
   * @param {Array<object>} zones
   * @returns {{ isBreach: boolean, breachedZone: object | null, proximity: string, severity: string, distanceToCentreM: number | null, distanceToPerimeterM: number | null, checkUnavailable?: boolean }}
   */
  evaluate(location, zones = []) {
    try {
      if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        throw new Error('Invalid coordinates provided to GeofenceEngine');
      }

      if (!zones || zones.length === 0) {
        return {
          isBreach: false,
          breachedZone: null,
          proximity: PROXIMITY_STATUS.OUTSIDE,
          severity: null,
          distanceToCentreM: null,
          distanceToPerimeterM: null,
        };
      }

      const candidateBreaches = [];

      for (const zone of zones) {
        const dist = distanceM(location.latitude, location.longitude, zone.centre_lat, zone.centre_lng);
        const radius = zone.radius_metres;
        const approachBuffer = zone.approach_buffer_metres || 500;

        if (dist <= radius) {
          // Main flow: Inside risk zone -> CRITICAL severity
          candidateBreaches.push({
            zone,
            proximity: PROXIMITY_STATUS.INSIDE,
            severity: BREACH_SEVERITY.CRITICAL,
            distanceToCentreM: Math.round(dist),
            distanceToPerimeterM: Math.round(radius - dist),
            severityWeight: SEVERITY_WEIGHT[BREACH_SEVERITY.CRITICAL],
          });
        } else if (dist <= radius + approachBuffer) {
          // Main flow step 4: Approaching risk zone -> WARNING severity
          candidateBreaches.push({
            zone,
            proximity: PROXIMITY_STATUS.APPROACHING,
            severity: BREACH_SEVERITY.WARNING,
            distanceToCentreM: Math.round(dist),
            distanceToPerimeterM: Math.round(dist - radius),
            severityWeight: SEVERITY_WEIGHT[BREACH_SEVERITY.WARNING],
          });
        }
      }

      if (candidateBreaches.length === 0) {
        return {
          isBreach: false,
          breachedZone: null,
          proximity: PROXIMITY_STATUS.OUTSIDE,
          severity: null,
          distanceToCentreM: null,
          distanceToPerimeterM: null,
        };
      }

      // Sort: highest severity weight first, then closest distance
      candidateBreaches.sort((a, b) => {
        if (b.severityWeight !== a.severityWeight) {
          return b.severityWeight - a.severityWeight;
        }
        return a.distanceToCentreM - b.distanceToCentreM;
      });

      const top = candidateBreaches[0];
      return {
        isBreach: true,
        breachedZone: top.zone,
        proximity: top.proximity,
        severity: top.severity,
        distanceToCentreM: top.distanceToCentreM,
        distanceToPerimeterM: top.distanceToPerimeterM,
      };
    } catch (err) {
      // Exception E3: Geofence engine error logged, returns graceful failure indicator
      return {
        isBreach: false,
        breachedZone: null,
        proximity: PROXIMITY_STATUS.OUTSIDE,
        severity: null,
        distanceToCentreM: null,
        distanceToPerimeterM: null,
        checkUnavailable: true,
        error: err.message,
      };
    }
  }

  isInsideZone(location, zone) {
    const dist = distanceM(location.latitude, location.longitude, zone.centre_lat, zone.centre_lng);
    return dist <= zone.radius_metres;
  }
}

module.exports = { GeofenceEngine, SEVERITY_WEIGHT };

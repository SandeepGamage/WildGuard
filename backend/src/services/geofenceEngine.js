const { distanceM } = require('../utils/geo');
const { BREACH_SEVERITY } = require('../constants/domain');

const SEVERITY_WEIGHT = Object.freeze({
  [BREACH_SEVERITY.HIGH]: 3,
  [BREACH_SEVERITY.MEDIUM]: 2,
  [BREACH_SEVERITY.LOW]: 1,
});

/**
 * Domain Service: GeofenceEngine (UC2)
 * Evaluates collar telemetry coordinates against preconfigured high-risk virtual geofences.
 */
class GeofenceEngine {
  /**
   * Evaluate whether a telemetry reading breaches any geofence zone.
   * If multiple zones are breached, returns the breach with highest severity / shortest distance.
   *
   * @param {{ latitude: number, longitude: number }} location
   * @param {Array<{ id: string, name: string, centre_lat: number, centre_lng: number, radius_metres: number, severity: string, sector_id?: string, nearest_settlement?: string }>} zones
   * @returns {{ isBreach: boolean, breachedZone: object | null, distanceToCentreM: number | null, distanceToPerimeterM: number | null }}
   */
  evaluate(location, zones = []) {
    if (!zones || zones.length === 0) {
      return { isBreach: false, breachedZone: null, distanceToCentreM: null, distanceToPerimeterM: null };
    }

    const breaches = [];

    for (const zone of zones) {
      const dist = distanceM(location.latitude, location.longitude, zone.centre_lat, zone.centre_lng);
      if (dist <= zone.radius_metres) {
        breaches.push({
          zone,
          distanceToCentreM: Math.round(dist),
          distanceToPerimeterM: Math.round(zone.radius_metres - dist),
          severityWeight: SEVERITY_WEIGHT[zone.severity] || 1,
        });
      }
    }

    if (breaches.length === 0) {
      return { isBreach: false, breachedZone: null, distanceToCentreM: null, distanceToPerimeterM: null };
    }

    // Sort by highest severity weight first, then closest to center
    breaches.sort((a, b) => {
      if (b.severityWeight !== a.severityWeight) {
        return b.severityWeight - a.severityWeight;
      }
      return a.distanceToCentreM - b.distanceToCentreM;
    });

    const top = breaches[0];
    return {
      isBreach: true,
      breachedZone: top.zone,
      distanceToCentreM: top.distanceToCentreM,
      distanceToPerimeterM: top.distanceToPerimeterM,
    };
  }

  /**
   * Check if a location is within a specific zone.
   */
  isInsideZone(location, zone) {
    const dist = distanceM(location.latitude, location.longitude, zone.centre_lat, zone.centre_lng);
    return dist <= zone.radius_metres;
  }
}

module.exports = { GeofenceEngine, SEVERITY_WEIGHT };

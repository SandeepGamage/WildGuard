const { unwrap } = require('./support');

/** Data access for simulated collar/camera evidence near a report. */
class CollarRepository {
  constructor(db) {
    this.db = db;
  }

  async findNearby(latitude, longitude, radiusM) {
    const result = await this.db.rpc('nearby_collars', {
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_m: radiusM,
    });
    return unwrap(result).map((row) => ({
      code: row.code,
      name: row.name,
      distanceM: Math.round(row.distance_m),
      lastSeenAt: row.last_seen_at,
    }));
  }
}

module.exports = { CollarRepository };

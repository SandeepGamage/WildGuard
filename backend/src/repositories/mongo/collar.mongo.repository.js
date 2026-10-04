const { CollarDevice } = require('../../models/mongo/schemas');
const { distanceM } = require('./village.mongo.repository');

class MongoCollarRepository {
  async findNearby(latitude, longitude, radiusM) {
    const active = await CollarDevice.find({ is_active: true }).lean();
    const result = [];

    for (const collar of active) {
      const d = distanceM(collar.latitude, collar.longitude, latitude, longitude);
      if (d <= radiusM) {
        result.push({
          code: collar.code,
          name: collar.name,
          distanceM: Math.round(d),
          lastSeenAt: collar.last_seen_at ? collar.last_seen_at.toISOString() : new Date().toISOString(),
        });
      }
    }

    result.sort((a, b) => a.distanceM - b.distanceM);
    return result;
  }
}

module.exports = { MongoCollarRepository };

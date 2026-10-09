const { Village } = require('../../models/mongo/schemas');
const { toVillage } = require('../../models/village.model');
const { distanceM } = require('../../utils/geo');

class MongoVillageRepository {
  async listActive() {
    const docs = await Village.find({ is_active: true }).sort({ name_en: 1 }).lean();
    return docs.map(toVillage);
  }

  async findById(id) {
    const doc = await Village.findOne({ id, is_active: true }).lean();
    return toVillage(doc);
  }

  async findNearest(latitude, longitude, maxDistanceM) {
    const active = await Village.find({ is_active: true }).lean();
    if (active.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;

    for (const v of active) {
      const d = distanceM(v.latitude, v.longitude, latitude, longitude);
      if (d < minDistance) {
        minDistance = d;
        nearest = v;
      }
    }

    if (nearest && minDistance <= maxDistanceM) {
      return { id: nearest.id, distanceM: Math.round(minDistance) };
    }
    return null;
  }
}

module.exports = { MongoVillageRepository, distanceM };

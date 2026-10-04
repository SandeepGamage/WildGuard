const { Village } = require('../../models/mongo/schemas');
const { toVillage } = require('../../models/village.model');

const EARTH_RADIUS_M = 6371000;

function distanceM(aLat, aLng, bLat, bLng) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

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

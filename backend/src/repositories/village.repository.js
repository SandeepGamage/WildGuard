const { unwrap } = require('./support');
const { toVillage } = require('../models/village.model');

/** Data access for the village gazetteer. */
class VillageRepository {
  constructor(db) {
    this.db = db;
  }

  async listActive() {
    const result = await this.db
      .from('villages')
      .select('*')
      .eq('is_active', true)
      .order('name_en', { ascending: true });
    return unwrap(result).map(toVillage);
  }

  async findById(id) {
    const result = await this.db
      .from('villages')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    return toVillage(unwrap(result));
  }

  /** @returns {Promise<{ id: string, distanceM: number }|null>} */
  async findNearest(latitude, longitude, maxDistanceM) {
    const result = await this.db.rpc('nearest_village', {
      p_latitude: latitude,
      p_longitude: longitude,
      p_max_distance_m: maxDistanceM,
    });
    const row = unwrap(result)?.[0];
    return row ? { id: row.id, distanceM: row.distance_m } : null;
  }
}

module.exports = { VillageRepository };

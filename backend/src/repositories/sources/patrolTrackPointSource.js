const { PatrolTrackPoint } = require('../../models/mongo/schemas');

/**
 * UC4 read side for ranger GPS points (UC1 patrol track points), shown on the hotspot map
 * as "where rangers have been". Read-only: it never writes to the UC1 collection, and it
 * returns positions only (no ranger or patrol ids).
 */
class PatrolTrackPointSource {
  /**
   * @param {{ dateFrom: Date, dateTo: Date, bounds: { minLat: number, maxLat: number, minLng: number, maxLng: number } }} filter
   *   `dateTo` is exclusive; `bounds` is the park's bounding box.
   * @returns {Promise<{ latitude: number, longitude: number }[]>}
   */
  async listPoints({ dateFrom, dateTo, bounds }) {
    if (!bounds) return [];
    const docs = await PatrolTrackPoint.find({
      recorded_at: { $gte: dateFrom, $lt: dateTo },
      latitude: { $gte: bounds.minLat, $lte: bounds.maxLat },
      longitude: { $gte: bounds.minLng, $lte: bounds.maxLng },
    })
      .select('latitude longitude')
      .lean();
    return docs.map((d) => ({ latitude: d.latitude, longitude: d.longitude }));
  }
}

module.exports = { PatrolTrackPointSource };

const EARTH_RADIUS_M = 6371000;
const METRES_PER_DEG_LAT = 111320;

const rad = (deg) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance in metres. */
function distanceM(aLat, aLng, bLat, bLng) {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Metres per degree of longitude at a latitude. */
const metresPerDegLng = (latitude) => METRES_PER_DEG_LAT * Math.cos(rad(latitude));

/**
 * Bounding box of points, grown by a margin in metres.
 * @param {{ latitude: number, longitude: number }[]} points
 * @param {number} marginM
 */
function boundingBox(points, marginM = 0) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = marginM / METRES_PER_DEG_LAT;
  const dLng = marginM / metresPerDegLng(midLat);
  return {
    minLat: Math.min(...lats) - dLat,
    maxLat: Math.max(...lats) + dLat,
    minLng: Math.min(...lngs) - dLng,
    maxLng: Math.max(...lngs) + dLng,
  };
}

module.exports = { EARTH_RADIUS_M, METRES_PER_DEG_LAT, distanceM, metresPerDegLng, boundingBox };

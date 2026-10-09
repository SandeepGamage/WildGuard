const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in metres. */
export function distanceMeters(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Nearest village to a GPS fix, within `maxMeters`.
 * Mirrors the backend rule so the "Detected from GPS" label matches what is saved.
 * @returns {object|null}
 */
export function findNearestVillage(coords, villages, maxMeters = 20000) {
  let best = null;
  for (const village of villages) {
    if (typeof village.latitude !== 'number' || typeof village.longitude !== 'number') continue;
    const distance = distanceMeters(coords, village);
    if (distance <= maxMeters && (!best || distance < best.distance)) best = { village, distance };
  }
  return best?.village ?? null;
}

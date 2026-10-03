import * as Location from 'expo-location';

export const LOCATION_STATUS = Object.freeze({
  OK: 'OK',
  DENIED: 'DENIED',
  UNAVAILABLE: 'UNAVAILABLE',
});

const GPS_TIMEOUT_MS = 10000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Ask for foreground location permission and read one GPS fix.
 * Never throws: every failure becomes a status so reporting can continue by village.
 * @returns {Promise<{ status: string, coordinates?: { latitude: number, longitude: number } }>}
 */
export async function getCurrentCoordinates() {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return { status: LOCATION_STATUS.DENIED };

    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      GPS_TIMEOUT_MS,
    );
    return {
      status: LOCATION_STATUS.OK,
      coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch {
    return { status: LOCATION_STATUS.UNAVAILABLE };
  }
}

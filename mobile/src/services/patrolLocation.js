import * as Location from 'expo-location';
import { PATROL_RULES } from '../constants/patrol';

const FIX_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const toFix = (position) => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
  timestamp: position.timestamp,
});

/**
 * Location source for patrolling. Foreground only: it ticks while the app is open.
 * A source offers `ensurePermission()`, `getFix()` (one reading, null when unavailable)
 * and `startTicking(onFix)` which calls `onFix(fix|null)` every interval and returns a stop function.
 */
function createTicker(getFix, intervalMs) {
  return (onFix) => {
    let stopped = false;
    const tick = async () => {
      const fix = await getFix();
      if (!stopped) onFix(fix);
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  };
}

export function createDeviceLocationSource(intervalMs = PATROL_RULES.TRACK_INTERVAL_MS) {
  const getFix = async () => {
    try {
      return toFix(
        await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          FIX_TIMEOUT_MS,
        ),
      );
    } catch {
      return null;
    }
  };

  return {
    async ensurePermission() {
      const permission = await Location.requestForegroundPermissionsAsync();
      return permission.status === 'granted';
    },
    getFix,
    startTicking: createTicker(getFix, intervalMs),
  };
}

/**
 * Simulated GPS for demos and testing without walking. `controls.weakGps` makes fixes
 * inaccurate (the track skips them) and `controls.noGps` makes `getFix()` return nothing.
 */
export function createSimulatedLocationSource({
  start = { latitude: 6.3028, longitude: 81.3703 },
  intervalMs = PATROL_RULES.TRACK_INTERVAL_MS,
  controls = { weakGps: false, noGps: false },
} = {}) {
  let step = 0;
  let current = { ...start };

  const getFix = async () => {
    if (controls.noGps) return null;
    step += 1;
    current = {
      latitude: current.latitude + 0.00012 * Math.cos(step / 6),
      longitude: current.longitude + 0.00015 * Math.sin(step / 6) + 0.00005,
    };
    return { ...current, accuracy: controls.weakGps ? 120 : 8 + (step % 5), timestamp: Date.now() };
  };

  return {
    controls,
    ensurePermission: async () => true,
    getFix,
    startTicking: createTicker(getFix, intervalMs),
  };
}

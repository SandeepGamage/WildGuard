import { findNearestVillage } from '../utils/geo';
import { LOCATION_STATUS } from './location';

export const LOCATION_MODE = Object.freeze({
  GPS: 'GPS',
  /** GPS could not be used; the reporter picks a village from the list. */
  MANUAL: 'MANUAL',
});

export const MANUAL_REASON = Object.freeze({
  DENIED: 'DENIED',
  UNAVAILABLE: 'UNAVAILABLE',
  OUTSIDE_COVERAGE: 'OUTSIDE_COVERAGE',
});

/**
 * Decide how the report location is captured. GPS is used when it works and
 * falls inside the covered area; otherwise reporting continues with a village
 * list. Reporting is never blocked and coordinates are never typed by hand.
 *
 * @param {object} deps
 * @param {() => Promise<{ status: string, coordinates?: object }>} deps.getCoordinates
 * @param {object[]} deps.villages Gazetteer villages with coordinates.
 */
export async function resolveReportLocation({ getCoordinates, villages }) {
  const result = await getCoordinates();

  if (result.status === LOCATION_STATUS.DENIED) {
    return { mode: LOCATION_MODE.MANUAL, reason: MANUAL_REASON.DENIED };
  }
  if (result.status !== LOCATION_STATUS.OK) {
    return { mode: LOCATION_MODE.MANUAL, reason: MANUAL_REASON.UNAVAILABLE };
  }

  const village = findNearestVillage(result.coordinates, villages);
  if (!village) {
    return { mode: LOCATION_MODE.MANUAL, reason: MANUAL_REASON.OUTSIDE_COVERAGE };
  }
  return { mode: LOCATION_MODE.GPS, coordinates: result.coordinates, village };
}

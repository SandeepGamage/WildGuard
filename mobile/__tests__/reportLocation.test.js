import { LOCATION_STATUS } from '../src/services/location';
import { LOCATION_MODE, MANUAL_REASON, resolveReportLocation } from '../src/services/reportLocation';
import { distanceMeters, findNearestVillage } from '../src/utils/geo';

const villages = [
  { id: 'palatupana', nameEn: 'Palatupana', latitude: 6.2994, longitude: 81.3703 },
  { id: 'kirinda', nameEn: 'Kirinda', latitude: 6.2386, longitude: 81.3138 },
];

describe('GPS with village fallback', () => {
  it('uses GPS and the nearest village when location works', async () => {
    const coordinates = { latitude: 6.2995, longitude: 81.3705 };
    const result = await resolveReportLocation({
      getCoordinates: async () => ({ status: LOCATION_STATUS.OK, coordinates }),
      villages,
    });
    expect(result).toEqual({ mode: LOCATION_MODE.GPS, coordinates, village: villages[0] });
  });

  it('does not block reporting when permission is denied: the village list is used', async () => {
    const result = await resolveReportLocation({
      getCoordinates: async () => ({ status: LOCATION_STATUS.DENIED }),
      villages,
    });
    expect(result).toEqual({ mode: LOCATION_MODE.MANUAL, reason: MANUAL_REASON.DENIED });
  });

  it('falls back to the village list when GPS is unavailable', async () => {
    const result = await resolveReportLocation({
      getCoordinates: async () => ({ status: LOCATION_STATUS.UNAVAILABLE }),
      villages,
    });
    expect(result).toEqual({ mode: LOCATION_MODE.MANUAL, reason: MANUAL_REASON.UNAVAILABLE });
  });

  it('falls back to the village list when the fix is outside the covered area', async () => {
    const result = await resolveReportLocation({
      getCoordinates: async () => ({
        status: LOCATION_STATUS.OK,
        coordinates: { latitude: 7.5, longitude: 80.5 },
      }),
      villages,
    });
    expect(result).toEqual({ mode: LOCATION_MODE.MANUAL, reason: MANUAL_REASON.OUTSIDE_COVERAGE });
  });
});

describe('geo helpers', () => {
  it('measures distance in metres', () => {
    const d = distanceMeters(
      { latitude: 6.2994, longitude: 81.3703 },
      { latitude: 6.3028, longitude: 81.3703 },
    );
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(400);
  });

  it('ignores villages without coordinates and respects the radius', () => {
    expect(findNearestVillage({ latitude: 6.2994, longitude: 81.3703 }, [{ id: 'x' }])).toBeNull();
    expect(findNearestVillage({ latitude: 6.2994, longitude: 81.3703 }, villages, 100)).toBe(villages[0]);
    expect(findNearestVillage({ latitude: 6.25, longitude: 81.34 }, villages, 100)).toBeNull();
  });
});

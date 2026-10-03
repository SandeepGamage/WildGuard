import { API_ERROR_CODES, ApiError } from '../src/api/client';
import { createReportSync, SUBMIT_STATE, toApiPayload } from '../src/services/reportSync.core';
import { createMemoryPendingRepository } from './helpers/memoryPendingRepository';

const networkError = () => new ApiError(0, API_ERROR_CODES.NETWORK, 'Network request failed');
const draft = {
  incidentType: 'ELEPHANT_NEAR_VILLAGE',
  elephantCountBand: '2_5',
  occurredWhen: 'NOW',
  villageId: 'village-1',
};

function setup(overrides = {}) {
  const repository = createMemoryPendingRepository();
  let counter = 0;
  const createIncident = jest.fn().mockResolvedValue({ id: 'incident-1', trackingCode: 'C-0142' });
  const uploadPhoto = jest.fn().mockResolvedValue('user/photo.jpg');
  const sync = createReportSync({
    repository,
    createIncident,
    uploadPhoto,
    newId: () => `request-${(counter += 1)}`,
    now: () => new Date('2026-05-01T10:00:00.000Z'),
    ...overrides,
  });
  return { sync, repository, createIncident, uploadPhoto };
}

describe('report submission queue', () => {
  it('saves the report locally before any network call and removes it once sent', async () => {
    const { sync, repository, createIncident } = setup();
    createIncident.mockImplementation(async () => {
      // At the moment of the API call the report is already durable on the phone.
      expect(repository.items.size).toBe(1);
      return { id: 'incident-1', trackingCode: 'C-0142' };
    });

    const result = await sync.submit({ userId: 'user-1', draft, photo: null });

    expect(result).toEqual({
      state: SUBMIT_STATE.SENT,
      report: { id: 'incident-1', trackingCode: 'C-0142' },
    });
    expect(repository.items.size).toBe(0);
    expect(createIncident).toHaveBeenCalledWith({
      clientRequestId: 'request-1',
      incidentType: 'ELEPHANT_NEAR_VILLAGE',
      occurredWhen: 'NOW',
      elephantCountBand: '2_5',
      villageId: 'village-1',
      capturedAt: '2026-05-01T10:00:00.000Z',
    });
  });

  it('keeps the report and says QUEUED when the network is down', async () => {
    const { sync, repository, createIncident } = setup();
    createIncident.mockRejectedValue(networkError());

    const result = await sync.submit({ userId: 'user-1', draft, photo: null });

    expect(result).toEqual({ state: SUBMIT_STATE.QUEUED });
    const [item] = await sync.listPending('user-1');
    expect(item).toMatchObject({ clientRequestId: 'request-1', status: 'QUEUED', attempts: 1 });
    expect(repository.items.size).toBe(1);
  });

  it('retries the SAME client request id later, so the server can ignore duplicates', async () => {
    const { sync, createIncident } = setup();
    createIncident.mockRejectedValueOnce(networkError());
    await sync.submit({ userId: 'user-1', draft, photo: null });

    createIncident.mockResolvedValueOnce({ id: 'incident-1', trackingCode: 'C-0142' });
    const delivered = await sync.flush('user-1');

    expect(delivered).toBe(1);
    expect(createIncident.mock.calls[0][0].clientRequestId).toBe('request-1');
    expect(createIncident.mock.calls[1][0].clientRequestId).toBe('request-1');
    expect(await sync.listPending('user-1')).toEqual([]);
  });

  it('keeps the original capture time when the retry happens hours later', async () => {
    const clock = jest.fn().mockReturnValue(new Date('2026-05-01T10:00:00.000Z'));
    const { sync, createIncident } = setup({ now: clock });
    createIncident.mockRejectedValueOnce(networkError());
    await sync.submit({ userId: 'user-1', draft, photo: null });

    clock.mockReturnValue(new Date('2026-05-01T16:30:00.000Z'));
    await sync.flush('user-1');

    expect(createIncident.mock.calls[1][0].capturedAt).toBe('2026-05-01T10:00:00.000Z');
  });

  it.each([
    ['a server error', new ApiError(503, 'INTERNAL_ERROR', 'down')],
    ['a rate limit', new ApiError(429, 'RATE_LIMITED', 'slow down')],
    ['an expired session', new ApiError(401, 'UNAUTHENTICATED', 'expired')],
  ])('keeps retrying after %s', async (_name, error) => {
    const { sync, createIncident } = setup();
    createIncident.mockRejectedValue(error);
    expect((await sync.submit({ userId: 'user-1', draft, photo: null })).state).toBe(SUBMIT_STATE.QUEUED);
  });

  it('marks a report FAILED (not retried forever) when the server rejects it as invalid', async () => {
    const { sync, createIncident } = setup();
    createIncident.mockRejectedValue(new ApiError(400, 'VALIDATION_FAILED', 'bad'));

    const result = await sync.submit({ userId: 'user-1', draft, photo: null });
    expect(result).toEqual({ state: SUBMIT_STATE.FAILED, code: 'VALIDATION_FAILED' });

    createIncident.mockClear();
    await sync.flush('user-1');
    expect(createIncident).not.toHaveBeenCalled();
    expect((await sync.listPending('user-1'))[0].status).toBe('FAILED');
  });

  it("only retries the signed-in user's own queue", async () => {
    const { sync, createIncident } = setup();
    createIncident.mockRejectedValueOnce(networkError());
    await sync.submit({ userId: 'user-1', draft, photo: null });

    createIncident.mockClear();
    expect(await sync.flush('user-2')).toBe(0);
    expect(createIncident).not.toHaveBeenCalled();
  });

  describe('optional photo', () => {
    const photo = { uri: 'file:///photo.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 };

    it('uploads the photo first and attaches its storage path', async () => {
      const { sync, createIncident, uploadPhoto } = setup();
      await sync.submit({ userId: 'user-1', draft, photo });
      expect(uploadPhoto).toHaveBeenCalledWith(photo);
      expect(createIncident.mock.calls[0][0].photoPath).toBe('user/photo.jpg');
    });

    it('still sends the text report when the photo upload fails for a non-network reason', async () => {
      const { sync, createIncident, uploadPhoto } = setup();
      uploadPhoto.mockRejectedValue(new Error('payload too large'));

      const result = await sync.submit({ userId: 'user-1', draft, photo });

      expect(result.state).toBe(SUBMIT_STATE.SENT);
      expect(createIncident.mock.calls[0][0]).not.toHaveProperty('photoPath');
    });

    it('queues (instead of dropping the photo) while the network is the problem', async () => {
      const { sync, createIncident, uploadPhoto } = setup();
      uploadPhoto.mockRejectedValue(new Error('Network request failed'));

      const result = await sync.submit({ userId: 'user-1', draft, photo });

      expect(result.state).toBe(SUBMIT_STATE.QUEUED);
      expect(createIncident).not.toHaveBeenCalled();
      expect((await sync.listPending('user-1'))[0].photo).toEqual(photo);
    });

    it('sends without the photo after repeated network failures so the report is never stuck', async () => {
      const { sync, createIncident, uploadPhoto } = setup();
      uploadPhoto.mockRejectedValue(new Error('Network request failed'));

      expect((await sync.submit({ userId: 'user-1', draft, photo })).state).toBe(SUBMIT_STATE.QUEUED);
      await sync.flush('user-1');
      await sync.flush('user-1');
      expect(createIncident).not.toHaveBeenCalled();

      await sync.flush('user-1');
      expect(createIncident).toHaveBeenCalledTimes(1);
      expect(createIncident.mock.calls[0][0]).not.toHaveProperty('photoPath');
      expect(await sync.listPending('user-1')).toEqual([]);
    });
  });

  it('lets the user discard a queued report', async () => {
    const { sync, createIncident } = setup();
    createIncident.mockRejectedValue(new ApiError(400, 'VALIDATION_FAILED', 'bad'));
    await sync.submit({ userId: 'user-1', draft, photo: null });
    await sync.discard('request-1');
    expect(await sync.listPending('user-1')).toEqual([]);
  });
});

describe('toApiPayload', () => {
  it('sends GPS coordinates when no village was chosen', () => {
    expect(
      toApiPayload({
        incidentType: 'CROP_DAMAGE',
        occurredWhen: 'EARLIER_TODAY',
        coordinates: { latitude: 6.3, longitude: 81.37 },
      }),
    ).toEqual({
      incidentType: 'CROP_DAMAGE',
      occurredWhen: 'EARLIER_TODAY',
      latitude: 6.3,
      longitude: 81.37,
    });
  });

  it('only sends the elephant count for elephant reports', () => {
    const payload = toApiPayload({
      incidentType: 'CROP_DAMAGE',
      elephantCountBand: '6_PLUS',
      occurredWhen: 'NOW',
      villageId: 'v',
    });
    expect(payload).not.toHaveProperty('elephantCountBand');
  });
});

import { ApiError, API_ERROR_CODES } from '../src/api/client';
import { PATROL_ERRORS, PATROL_STATUS, SYNC_STATUS } from '../src/constants/patrol';
import { createPatrolEngine, isAccurateFix, retryDelayMs, trackDistanceMeters } from '../src/services/patrol.core';
import { createCollectionPatrolRepository } from '../src/services/patrol.repository.collection';
import { createPatrolSync, FLUSH_STATE } from '../src/services/patrolSync.core';
import { homeRouteForRole } from '../src/utils/roleRoute';

const ASSIGNMENT = { parkName: 'Yala National Park', sectorName: 'Sector 3' };
const RANGER = 'ranger-1';

function setup({ preparePhoto } = {}) {
  let data = {};
  const repository = createCollectionPatrolRepository({
    load: () => structuredClone(data),
    save: (next) => {
      data = structuredClone(next);
    },
  });
  let counter = 0;
  let clock = new Date('2026-10-07T06:00:00.000Z').getTime();
  const engine = createPatrolEngine({
    repository,
    newId: () => `id-${(counter += 1)}`,
    now: () => new Date(clock),
    preparePhoto,
  });
  return { repository, engine, advance: (ms) => (clock += ms) };
}

const fix = (overrides = {}) => ({ latitude: 6.3, longitude: 81.37, accuracy: 10, timestamp: 1, ...overrides });

describe('pure rules', () => {
  it('rejects fixes that are weak or have no accuracy (A4)', () => {
    expect(isAccurateFix(fix({ accuracy: 50 }))).toBe(true);
    expect(isAccurateFix(fix({ accuracy: 51 }))).toBe(false);
    expect(isAccurateFix(fix({ accuracy: undefined }))).toBe(false);
    expect(isAccurateFix(null)).toBe(false);
  });

  it('backs off 30 s, 2 min, then stays at 10 min (E3)', () => {
    expect([1, 2, 3, 4, 9].map(retryDelayMs)).toEqual([30000, 120000, 600000, 600000, 600000]);
  });

  it('sums the walked distance', () => {
    const a = { latitude: 6.3, longitude: 81.37 };
    const b = { latitude: 6.301, longitude: 81.37 };
    expect(trackDistanceMeters([a])).toBe(0);
    expect(trackDistanceMeters([a, b])).toBeGreaterThan(100);
    expect(trackDistanceMeters([a, b])).toBeLessThan(120);
  });

  it('routes a field ranger to the patrol interface', () => {
    expect(homeRouteForRole('FIELD_RANGER')).toBe('/start-patrol');
    expect(homeRouteForRole('PARK_MANAGER')).toBeNull();
  });
});

describe('patrol engine (UC1a / UC1b)', () => {
  it('starts one ACTIVE session and refuses a second one', async () => {
    const { engine } = setup();
    const session = await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });

    expect(session.status).toBe(PATROL_STATUS.ACTIVE);
    await expect(engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT })).rejects.toMatchObject({
      code: PATROL_ERRORS.ALREADY_ACTIVE,
    });
  });

  it('records accurate points as PENDING and skips weak ones', async () => {
    const { engine, repository } = setup();
    const session = await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });

    expect((await engine.recordFix(session.id, fix())).recorded).toBe(true);
    expect((await engine.recordFix(session.id, fix({ accuracy: 120 }))).recorded).toBe(false);
    expect((await engine.recordFix(session.id, null)).recorded).toBe(false);

    const points = await repository.listTrackPoints(session.id);
    expect(points).toHaveLength(1);
    expect(points[0].syncStatus).toBe(SYNC_STATUS.PENDING);
  });

  it('saves an incident locally with the current fix and the pending count', async () => {
    const { engine, repository } = setup();
    const session = await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });

    const result = await engine.logIncident({
      sessionId: session.id,
      incidentType: 'SNARE_POACHING',
      note: '  wire snare  ',
      fix: fix({ latitude: 6.31 }),
    });

    expect(result.locationWarning).toBe(false);
    expect(result.pendingCount).toBeGreaterThan(0);
    const [incident] = await repository.listIncidents(session.id);
    expect(incident).toMatchObject({ note: 'wire snare', latitude: 6.31, syncStatus: SYNC_STATUS.PENDING });
  });

  it('uses the last known location with a warning when there is no fix (E1)', async () => {
    const { engine, repository } = setup();
    const session = await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });
    await engine.recordFix(session.id, fix({ latitude: 6.35 }));

    const result = await engine.logIncident({ sessionId: session.id, incidentType: 'CARCASS', fix: null });

    expect(result.locationWarning).toBe(true);
    const [incident] = await repository.listIncidents(session.id);
    expect(incident.latitude).toBe(6.35);
    expect(incident.locationFixAt).toBeTruthy();
  });

  it('reports NO_LOCATION when nothing is known yet', async () => {
    const { engine } = setup();
    const session = await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });

    await expect(
      engine.logIncident({ sessionId: session.id, incidentType: 'CARCASS', fix: null }),
    ).rejects.toMatchObject({ code: PATROL_ERRORS.NO_LOCATION });
  });

  it('still saves the incident when storage is low and the photo is compressed (E2)', async () => {
    const small = { uri: 'small.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 };
    const { engine, repository } = setup({ preparePhoto: async () => ({ photo: small, storageLow: true }) });
    const session = await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });

    const result = await engine.logIncident({
      sessionId: session.id,
      incidentType: 'OTHER',
      photo: { uri: 'big.jpg', mimeType: 'image/jpeg', sizeBytes: 9_000_000 },
      fix: fix(),
    });

    expect(result.storageWarning).toBe(true);
    expect((await repository.listIncidents(session.id))[0].photo.uri).toBe('small.jpg');
  });

  it('saves without a photo (A1) and ends the patrol with a summary', async () => {
    const { engine, advance } = setup();
    const session = await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });
    await engine.recordFix(session.id, fix());
    await engine.logIncident({ sessionId: session.id, incidentType: 'OTHER', fix: fix() });
    advance(65000);

    const summary = await engine.endPatrol(session.id);

    expect(summary.session.status).toBe(PATROL_STATUS.COMPLETED);
    expect(summary.durationMs).toBe(65000);
    expect(summary.incidentCount).toBe(1);
    expect(summary.pendingCount).toBeGreaterThan(0);
    expect(await engine.getActiveSession(RANGER)).toBeNull();
  });
});

describe('patrol history', () => {
  it('lists only finished patrols, newest first, with per-patrol upload status', async () => {
    const { engine, repository, advance } = setup();
    const first = await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });
    await engine.logIncident({ sessionId: first.id, incidentType: 'OTHER', fix: fix() });
    await engine.endPatrol(first.id);
    advance(3600000);
    const second = await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });
    await engine.endPatrol(second.id);
    advance(3600000);
    await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });
    await engine.startPatrol({ rangerId: 'other-ranger', assignment: ASSIGNMENT });

    const sync = createPatrolSync({
      repository,
      syncPatrol: async (body) => ({
        trackPointIds: body.trackPoints.map((p) => p.id),
        incidentIds: body.incidents.map((i) => i.id),
      }),
      uploadPhoto: jest.fn(),
    });
    await sync.flush(RANGER);
    await engine.logIncident({ sessionId: (await engine.getActiveSession(RANGER)).id, incidentType: 'OTHER', fix: fix() });

    const history = await engine.listHistory(RANGER);

    expect(history.map((h) => h.session.id)).toEqual([second.id, first.id]);
    expect(history.every((h) => h.pendingCount === 0)).toBe(true);
    expect(history[1].incidentCount).toBe(1);
  });

  it('shows a patrol as waiting while its data is not uploaded', async () => {
    const { engine } = setup();
    const session = await engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });
    await engine.recordFix(session.id, fix());
    await engine.endPatrol(session.id);

    const [item] = await engine.listHistory(RANGER);

    expect(item.pendingCount).toBeGreaterThan(0);
  });
});

describe('patrol sync (UC1c)', () => {
  async function patrolWithData(count) {
    const ctx = setup();
    const session = await ctx.engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });
    for (let i = 0; i < count; i += 1) {
      ctx.advance(10000);
      await ctx.engine.recordFix(session.id, fix({ timestamp: i, latitude: 6.3 + i * 0.0001 }));
    }
    await ctx.engine.logIncident({ sessionId: session.id, incidentType: 'SNARE_POACHING', fix: fix() });
    await ctx.engine.endPatrol(session.id);
    return { ...ctx, session };
  }

  const ackAll = (calls) => async (body) => {
    calls.push(body);
    return {
      trackPointIds: body.trackPoints.map((p) => p.id),
      incidentIds: body.incidents.map((i) => i.id),
    };
  };

  it('uploads in batches of at most 50 and marks everything SYNCED', async () => {
    const { repository } = await patrolWithData(120);
    const calls = [];
    const sync = createPatrolSync({ repository, syncPatrol: ackAll(calls), uploadPhoto: jest.fn() });

    const result = await sync.flush(RANGER);

    expect(result.state).toBe(FLUSH_STATE.SYNCED);
    expect(Math.max(...calls.map((c) => c.trackPoints.length))).toBeLessThanOrEqual(50);
    expect(calls.reduce((n, c) => n + c.trackPoints.length, 0)).toBe(120);
    expect(calls.every((c) => c.session.status === PATROL_STATUS.COMPLETED)).toBe(true);
    expect(await repository.countPending(RANGER)).toBe(0);
  });

  it('keeps everything PENDING when the upload fails, then delivers on retry (E3)', async () => {
    const { repository } = await patrolWithData(5);
    const failing = jest.fn().mockRejectedValue(new ApiError(0, API_ERROR_CODES.NETWORK, 'down'));
    const before = await repository.countPending(RANGER);

    const failed = await createPatrolSync({ repository, syncPatrol: failing, uploadPhoto: jest.fn() }).flush(RANGER);

    expect(failed.state).toBe(FLUSH_STATE.FAILED);
    expect(await repository.countPending(RANGER)).toBe(before);

    const calls = [];
    const retried = await createPatrolSync({ repository, syncPatrol: ackAll(calls), uploadPhoto: jest.fn() }).flush(RANGER);
    expect(retried.state).toBe(FLUSH_STATE.SYNCED);
    expect(await repository.countPending(RANGER)).toBe(0);
  });

  it('only marks the ids the server acknowledged', async () => {
    const { repository, session } = await patrolWithData(3);
    const [first] = await repository.listTrackPoints(session.id);
    const sync = createPatrolSync({
      repository,
      syncPatrol: async () => ({ trackPointIds: [first.id], incidentIds: [] }),
      uploadPhoto: jest.fn(),
    });
    const pending = (await repository.countPending(RANGER)) - 0;

    await sync.flush(RANGER).catch(() => {});

    expect((await repository.listTrackPoints(session.id)).filter((p) => p.syncStatus === 'SYNCED')).toEqual([
      expect.objectContaining({ id: first.id }),
    ]);
    expect(pending).toBeGreaterThan(0);
  });

  it('uploads the photo first and attaches its storage path', async () => {
    const ctx = setup();
    const session = await ctx.engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });
    await ctx.engine.logIncident({
      sessionId: session.id,
      incidentType: 'CARCASS',
      photo: { uri: 'p.jpg', mimeType: 'image/jpeg', sizeBytes: 100 },
      fix: fix(),
    });
    const calls = [];
    const uploadPhoto = jest.fn().mockResolvedValue('ranger-1/photo.jpg');

    await createPatrolSync({ repository: ctx.repository, syncPatrol: ackAll(calls), uploadPhoto }).flush(RANGER);

    expect(uploadPhoto).toHaveBeenCalledTimes(1);
    expect(calls[0].incidents[0].photoPath).toBe('ranger-1/photo.jpg');
  });

  it('keeps the photo for a retry when the connection drops during its upload', async () => {
    const ctx = setup();
    const session = await ctx.engine.startPatrol({ rangerId: RANGER, assignment: ASSIGNMENT });
    await ctx.engine.logIncident({
      sessionId: session.id,
      incidentType: 'CARCASS',
      photo: { uri: 'p.jpg', mimeType: 'image/jpeg', sizeBytes: 100 },
      fix: fix(),
    });
    const uploadPhoto = jest.fn().mockRejectedValue(new ApiError(0, API_ERROR_CODES.NETWORK, 'down'));

    const result = await createPatrolSync({
      repository: ctx.repository,
      syncPatrol: jest.fn(),
      uploadPhoto,
    }).flush(RANGER);

    expect(result.state).toBe(FLUSH_STATE.FAILED);
    const [incident] = await ctx.repository.listIncidents(session.id);
    expect(incident.photo).not.toBeNull();
    expect(incident.attempts).toBe(1);
  });

  it('does nothing when there is nothing to send', async () => {
    const { repository } = setup();
    const syncPatrol = jest.fn();

    const result = await createPatrolSync({ repository, syncPatrol, uploadPhoto: jest.fn() }).flush(RANGER);

    expect(result.state).toBe(FLUSH_STATE.IDLE);
    expect(syncPatrol).not.toHaveBeenCalled();
  });
});

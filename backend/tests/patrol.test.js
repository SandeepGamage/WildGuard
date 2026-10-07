const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { createTestApp, bearer, TOKENS, ID } = require('./helpers/testApp');

const batch = (overrides = {}) => ({
  session: { id: randomUUID(), status: 'ACTIVE', startedAt: '2026-10-07T06:00:00.000Z' },
  trackPoints: [
    { id: randomUUID(), latitude: 6.3, longitude: 81.37, accuracyM: 12, recordedAt: '2026-10-07T06:00:10.000Z' },
  ],
  incidents: [
    {
      id: randomUUID(),
      incidentType: 'SNARE_POACHING',
      note: 'Wire snare near waterhole',
      latitude: 6.31,
      longitude: 81.38,
      occurredAt: '2026-10-07T06:05:00.000Z',
    },
  ],
  ...overrides,
});

describe('POST /api/v1/patrols/sync (UC1c)', () => {
  const send = (app, token, body) =>
    request(app).post('/api/v1/patrols/sync').set(bearer(token)).send(body);

  it('stores a batch and acknowledges the exact ids', async () => {
    const { app, state } = createTestApp();
    const body = batch();

    const res = await send(app, TOKENS.ranger, body);

    expect(res.status).toBe(200);
    expect(res.body.data.trackPointIds).toEqual([body.trackPoints[0].id]);
    expect(res.body.data.incidentIds).toEqual([body.incidents[0].id]);
    expect(state.patrolSessions[0].sectorId).toBe(ID.sector3);
  });

  it('is idempotent when the same batch is retried', async () => {
    const { app, state } = createTestApp();
    const body = batch();

    await send(app, TOKENS.ranger, body);
    const second = await send(app, TOKENS.ranger, body);

    expect(second.status).toBe(200);
    expect(state.patrolSessions).toHaveLength(1);
    expect(state.patrolTrackPoints).toHaveLength(1);
    expect(state.patrolIncidentRows).toHaveLength(1);
  });

  it('completes a session on a later sync', async () => {
    const { app, state } = createTestApp();
    const body = batch();
    await send(app, TOKENS.ranger, body);

    const done = {
      session: { ...body.session, status: 'COMPLETED', endedAt: '2026-10-07T07:00:00.000Z' },
      trackPoints: [],
      incidents: [],
    };
    const res = await send(app, TOKENS.ranger, done);

    expect(res.status).toBe(200);
    expect(state.patrolSessions[0].status).toBe('COMPLETED');
  });

  it('rejects a completed session without an end time', async () => {
    const { app } = createTestApp();
    const body = batch();
    body.session.status = 'COMPLETED';

    const res = await send(app, TOKENS.ranger, body);

    expect(res.status).toBe(400);
  });

  it('rejects more than 50 track points per batch', async () => {
    const { app } = createTestApp();
    const point = { latitude: 6.3, longitude: 81.37, recordedAt: '2026-10-07T06:00:10.000Z' };
    const body = batch({
      trackPoints: Array.from({ length: 51 }, () => ({ ...point, id: randomUUID() })),
    });

    const res = await send(app, TOKENS.ranger, body);

    expect(res.status).toBe(400);
  });

  it('is restricted to field rangers', async () => {
    const { app } = createTestApp();

    expect((await send(app, TOKENS.villagerA, batch())).status).toBe(403);
    expect((await send(app, TOKENS.officer, batch())).status).toBe(403);
    expect((await request(app).post('/api/v1/patrols/sync').send(batch())).status).toBe(401);
  });

  it("refuses a photo outside the ranger's own folder", async () => {
    const { app } = createTestApp();
    const body = batch();
    body.incidents[0].photoPath = `${ID.villagerA}/${randomUUID()}.jpg`;

    const res = await send(app, TOKENS.ranger, body);

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/patrols/photo-upload', () => {
  it('issues an upload ticket to a ranger', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/v1/patrols/photo-upload')
      .set(bearer(TOKENS.ranger))
      .send({ contentType: 'image/jpeg', sizeBytes: 1000 });

    expect(res.status).toBe(201);
    expect(res.body.data.path.startsWith(`${ID.ranger}/`)).toBe(true);
  });
});

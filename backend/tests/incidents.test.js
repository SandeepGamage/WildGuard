const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { createTestApp, bearer, TOKENS, ID } = require('./helpers/testApp');

const report = (overrides = {}) => ({
  clientRequestId: randomUUID(),
  incidentType: 'ELEPHANT_NEAR_VILLAGE',
  villageId: ID.palatupana,
  elephantCountBand: '2_5',
  occurredWhen: 'NOW',
  ...overrides,
});

const submit = (app, token, body) => request(app).post('/api/v1/incidents').set(bearer(token)).send(body);

describe('creating reports', () => {
  it('stores a valid app report with a readable tracking code and honest status', async () => {
    const { app, state } = createTestApp();
    const res = await submit(app, TOKENS.villagerA, report());

    expect(res.status).toBe(201);
    expect(res.body.data.trackingCode).toMatch(/^C-\d{4}$/);
    expect(res.body.data.progress).toBe('RECEIVED');
    expect(res.body.data.outcome).toBeNull();
    expect(res.body.data).not.toHaveProperty('status');
    expect(state.incidents[0]).toMatchObject({ source: 'APP', status: 'PENDING', urgency: 'NORMAL' });
  });

  it('derives reporter, status and tracking code on the server', async () => {
    const { app, state } = createTestApp();
    await submit(
      app,
      TOKENS.villagerA,
      report({
        reporterId: ID.villagerB,
        status: 'VERIFIED',
        trackingCode: 'C-9999',
        urgency: 'URGENT',
      }),
    );
    expect(state.incidents[0]).toMatchObject({
      reporter_id: ID.villagerA,
      status: 'PENDING',
      urgency: 'NORMAL',
    });
    expect(state.incidents[0].tracking_code).not.toBe('C-9999');
  });

  it.each([
    ['missing category', { incidentType: undefined }],
    ['unknown category', { incidentType: 'DRAGON' }],
    ['no location at all', { villageId: undefined }],
    ['bad count band', { elephantCountBand: '99' }],
    ['latitude out of range', { villageId: undefined, latitude: 123, longitude: 81 }],
    ['missing client request id', { clientRequestId: undefined }],
  ])('rejects %s', async (_name, overrides) => {
    const { app, state } = createTestApp();
    const res = await submit(app, TOKENS.villagerA, report(overrides));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(state.incidents).toHaveLength(0);
  });

  it('marks an injured-person report URGENT and notifies the liaison officers at once', async () => {
    const { app, state } = createTestApp();
    const res = await submit(
      app,
      TOKENS.villagerA,
      report({ incidentType: 'PERSON_INJURED', villageId: ID.yodakandiya }),
    );

    expect(res.status).toBe(201);
    expect(res.body.data.urgency).toBe('URGENT');
    const notified = state.notifications.map((row) => row.recipient_id);
    expect(notified).toEqual(expect.arrayContaining([ID.officer]));
    expect(notified).not.toContain(ID.officerTissa);
    expect(state.notifications[0].notification_type).toBe('URGENT_INCIDENT');
  });

  it('is idempotent: retrying the same client request id creates one incident', async () => {
    const { app, state } = createTestApp();
    const body = report();
    const first = await submit(app, TOKENS.villagerA, body);
    const retry = await submit(app, TOKENS.villagerA, body);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data.id).toBe(first.body.data.id);
    expect(retry.body.data.trackingCode).toBe(first.body.data.trackingCode);
    expect(state.incidents).toHaveLength(1);
  });

  it('links a second report of the same type within 1 km and 2 hours as a duplicate', async () => {
    const { app, state } = createTestApp();
    const first = await submit(app, TOKENS.villagerA, report());
    const second = await submit(app, TOKENS.villagerB, report());

    expect(second.status).toBe(201);
    expect(state.incidents[1]).toMatchObject({ status: 'DUPLICATE', duplicate_of_id: first.body.data.id });
    // The second reporter still gets their own tracking code and keeps their own report.
    expect(second.body.data.trackingCode).not.toBe(first.body.data.trackingCode);
    const mine = await request(app).get('/api/v1/incidents/mine').set(bearer(TOKENS.villagerB));
    expect(mine.body.data).toHaveLength(1);
  });

  it.each([
    ['a different category', { incidentType: 'CROP_DAMAGE' }],
    ['a village more than 1 km away', { villageId: ID.kirinda }],
  ])('does not treat %s as a duplicate', async (_name, overrides) => {
    const { app, state } = createTestApp();
    await submit(app, TOKENS.villagerA, report());
    await submit(app, TOKENS.villagerB, report(overrides));
    expect(state.incidents[1].status).toBe('PENDING');
  });

  it('does not treat a report from more than 2 hours earlier as a duplicate', async () => {
    const { app, state } = createTestApp();
    await submit(app, TOKENS.villagerA, report());
    await submit(app, TOKENS.villagerB, report({ occurredWhen: 'EARLIER_TODAY' }));
    expect(state.incidents[1].status).toBe('PENDING');
  });

  it('keeps the time the report was captured offline, not the time it synced', async () => {
    const { app, state } = createTestApp();
    const capturedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await submit(app, TOKENS.villagerA, report({ capturedAt }));
    expect(new Date(state.incidents[0].occurred_at).toISOString()).toBe(capturedAt);
  });

  it('resolves a GPS fix to the nearest village', async () => {
    const { app, state } = createTestApp();
    const res = await submit(
      app,
      TOKENS.villagerA,
      report({ villageId: undefined, latitude: 6.2995, longitude: 81.3705 }),
    );
    expect(res.status).toBe(201);
    expect(state.incidents[0]).toMatchObject({ village_id: ID.palatupana, call_back_required: false });
  });

  it('falls back to the registered village and flags a call-back when GPS is outside coverage', async () => {
    const { app, state } = createTestApp();
    const res = await submit(
      app,
      TOKENS.villagerA,
      report({ villageId: undefined, latitude: 7.5, longitude: 80.5 }),
    );
    expect(res.status).toBe(201);
    expect(state.incidents[0]).toMatchObject({ village_id: ID.palatupana, call_back_required: true });
  });

  it('rejects an unknown village', async () => {
    const { app } = createTestApp();
    const res = await submit(app, TOKENS.villagerA, report({ villageId: randomUUID() }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VILLAGE_NOT_FOUND');
  });

  it("refuses a photo reference that points at someone else's folder", async () => {
    const { app } = createTestApp();
    const res = await submit(
      app,
      TOKENS.villagerA,
      report({ photoPath: `${ID.villagerB}/${randomUUID()}.jpg` }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PHOTO_PATH');
  });

  it("accepts a photo reference inside the reporter's own folder", async () => {
    const { app, state } = createTestApp();
    const photoPath = `${ID.villagerA}/${randomUUID()}.jpg`;
    const res = await submit(app, TOKENS.villagerA, report({ photoPath }));
    expect(res.status).toBe(201);
    expect(state.incidents[0].photo_path).toBe(photoPath);
  });
});

describe('photo upload tickets', () => {
  it("issues a server-chosen path inside the caller's folder", async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post('/api/v1/incidents/photo-upload')
      .set(bearer(TOKENS.villagerA))
      .send({ contentType: 'image/png', sizeBytes: 1024 });
    expect(res.status).toBe(201);
    expect(res.body.data.path).toMatch(new RegExp(`^${ID.villagerA}/[0-9a-f-]{36}\\.png$`));
    expect(res.body.data.bucket).toBe('incident-photos');
  });

  it.each([
    ['a non-image type', { contentType: 'application/pdf', sizeBytes: 1000 }],
    ['an oversized file', { contentType: 'image/jpeg', sizeBytes: 6 * 1024 * 1024 }],
  ])('rejects %s', async (_name, body) => {
    const { app } = createTestApp();
    const res = await request(app)
      .post('/api/v1/incidents/photo-upload')
      .set(bearer(TOKENS.villagerA))
      .send(body);
    expect(res.status).toBe(400);
  });
});

describe('villager privacy', () => {
  it("lists only the caller's own reports", async () => {
    const { app } = createTestApp();
    await submit(app, TOKENS.villagerA, report());
    await submit(app, TOKENS.villagerB, report({ incidentType: 'CROP_DAMAGE', villageId: ID.kirinda }));

    const res = await request(app).get('/api/v1/incidents/mine').set(bearer(TOKENS.villagerA));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].incidentType).toBe('ELEPHANT_NEAR_VILLAGE');
  });

  it("hides another villager's report as not found", async () => {
    const { app } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, report());

    const res = await request(app)
      .get(`/api/v1/incidents/${created.body.data.id}`)
      .set(bearer(TOKENS.villagerB));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REPORT_NOT_FOUND');
  });

  it('shows the owner their report without officer-only fields', async () => {
    const { app } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, report());
    const res = await request(app)
      .get(`/api/v1/incidents/${created.body.data.id}`)
      .set(bearer(TOKENS.villagerA));

    expect(res.status).toBe(200);
    expect(res.body.data.progress).toBe('RECEIVED');
    for (const hidden of ['status', 'reporter', 'verification', 'notes', 'reporterPhone']) {
      expect(res.body.data).not.toHaveProperty(hidden);
    }
  });

  it('rejects a malformed report id', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/incidents/not-a-uuid').set(bearer(TOKENS.villagerA));
    expect(res.status).toBe(400);
  });
});

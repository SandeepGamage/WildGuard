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

const submit = async (app, token, overrides) =>
  (await request(app).post('/api/v1/incidents').set(bearer(token)).send(report(overrides))).body.data;

const verify = (app, token, id, body = {}) =>
  request(app)
    .post(`/api/v1/officer/incidents/${id}/verify`)
    .set(bearer(token))
    .send({ method: 'CALL_REPORTER', fieldActionRequired: false, ...body });

const reject = (app, token, id, body) =>
  request(app).post(`/api/v1/officer/incidents/${id}/reject`).set(bearer(token)).send(body);

describe('role and scope authorization', () => {
  it('blocks villagers and rangers from every officer endpoint', async () => {
    const { app } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});
    const id = created.id;

    for (const token of [TOKENS.villagerA, TOKENS.ranger]) {
      const calls = [
        request(app).get('/api/v1/officer/queue').set(bearer(token)),
        request(app).get('/api/v1/officer/map').set(bearer(token)),
        request(app).get('/api/v1/officer/history').set(bearer(token)),
        request(app).get(`/api/v1/officer/incidents/${id}`).set(bearer(token)),
        verify(app, token, id),
        reject(app, token, id, { reason: 'OTHER' }),
      ];
      for (const res of await Promise.all(calls)) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
      }
    }
  });

  it('keeps officers out of the villager reporting endpoints', async () => {
    const { app } = createTestApp();
    const res = await request(app).post('/api/v1/incidents').set(bearer(TOKENS.officer)).send(report());
    expect(res.status).toBe(403);
  });

  it('does not let a villager verify their own report', async () => {
    const { app, state } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});
    const res = await verify(app, TOKENS.villagerA, created.id);
    expect(res.status).toBe(403);
    expect(state.incidents[0].status).toBe('PENDING');
  });

  it('forbids an officer from reading or deciding reports outside their divisions', async () => {
    const { app, state } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});

    const read = await request(app)
      .get(`/api/v1/officer/incidents/${created.id}`)
      .set(bearer(TOKENS.officerTissa));
    const decide = await verify(app, TOKENS.officerTissa, created.id);
    const dismiss = await reject(app, TOKENS.officerTissa, created.id, { reason: 'OTHER' });

    for (const res of [read, decide, dismiss]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('OUT_OF_SCOPE');
    }
    expect(state.incidents[0].status).toBe('PENDING');
    expect(state.records).toHaveLength(0);
  });

  it('shows an out-of-scope officer an empty queue and map', async () => {
    const { app } = createTestApp();
    await submit(app, TOKENS.villagerA, {});
    const queue = await request(app).get('/api/v1/officer/queue').set(bearer(TOKENS.officerTissa));
    const map = await request(app).get('/api/v1/officer/map').set(bearer(TOKENS.officerTissa));
    expect(queue.body.data.items).toEqual([]);
    expect(map.body.data).toEqual([]);
  });
});

describe('verification queue', () => {
  it('lists urgent reports first and groups duplicates with a count', async () => {
    const { app } = createTestApp();
    const elephant = await submit(app, TOKENS.villagerA, {});
    await submit(app, TOKENS.villagerB, {});
    await submit(app, TOKENS.villagerB, { incidentType: 'CROP_DAMAGE', villageId: ID.kirinda });
    const injured = await submit(app, TOKENS.villagerA, {
      incidentType: 'PERSON_INJURED',
      villageId: ID.yodakandiya,
    });

    const res = await request(app).get('/api/v1/officer/queue').set(bearer(TOKENS.officer));
    const { items, counts } = res.body.data;

    expect(res.status).toBe(200);
    expect(items[0].id).toBe(injured.id);
    expect(items[0].urgency).toBe('URGENT');
    expect(items).toHaveLength(3);
    const grouped = items.find((item) => item.id === elephant.id);
    expect(grouped.groupedCount).toBe(2);
    expect(counts).toEqual({ pending: 3, urgent: 1, verified: 0 });
    for (const item of items) {
      expect(item).not.toHaveProperty('reporter');
    }
  });

  it('flags call-back reports', async () => {
    const { app } = createTestApp();
    await request(app)
      .post('/api/v1/sms/simulate')
      .send({ phone: '0771234812', message: 'ALIYA UNKNOWNPLACE' });
    const res = await request(app).get('/api/v1/officer/queue').set(bearer(TOKENS.officer));
    expect(res.body.data.items[0].callBackRequired).toBe(true);
  });

  it('opens an incident with reporter, related reports and nearby collar data', async () => {
    const { app } = createTestApp();
    const first = await submit(app, TOKENS.villagerA, {});
    await submit(app, TOKENS.villagerB, {});

    const res = await request(app).get(`/api/v1/officer/incidents/${first.id}`).set(bearer(TOKENS.officer));

    expect(res.status).toBe(200);
    expect(res.body.data.reporter).toMatchObject({ name: 'Nimali Perera', phoneMasked: '077 *** 812' });
    expect(res.body.data.related).toHaveLength(1);
    expect(res.body.data.nearbyCollars[0]).toMatchObject({ code: 'EL-07' });
    expect(res.body.data.nearbyCollars[0].distanceM).toBeGreaterThan(300);
    expect(res.body.data.nearbyCollars[0].distanceM).toBeLessThan(450);
  });

  it('resolves a duplicate id to its original report', async () => {
    const { app } = createTestApp();
    const first = await submit(app, TOKENS.villagerA, {});
    const second = await submit(app, TOKENS.villagerB, {});
    const res = await request(app).get(`/api/v1/officer/incidents/${second.id}`).set(bearer(TOKENS.officer));
    expect(res.body.data.id).toBe(first.id);
  });

  it('shows the villager "Being checked" once an officer starts the review', async () => {
    const { app } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});
    const started = await request(app)
      .post(`/api/v1/officer/incidents/${created.id}/review`)
      .set(bearer(TOKENS.officer));
    expect(started.status).toBe(200);

    const mine = await request(app).get(`/api/v1/incidents/${created.id}`).set(bearer(TOKENS.villagerA));
    expect(mine.body.data.progress).toBe('BEING_CHECKED');
  });
});

describe('verifying a report', () => {
  it('records the decision, updates grouped duplicates and tells the reporters', async () => {
    const { app, state } = createTestApp();
    const first = await submit(app, TOKENS.villagerA, {});
    const second = await submit(app, TOKENS.villagerB, {});

    const res = await verify(app, TOKENS.officer, first.id, { notes: 'Called the reporter.' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'VERIFIED',
      fieldActionRequired: false,
      markerState: 'VERIFIED',
      reportsUpdated: 2,
      fieldTeamNotified: false,
    });
    expect(state.records).toHaveLength(1);
    expect(state.records[0]).toMatchObject({
      officer_id: ID.officer,
      method: 'CALL_REPORTER',
      decision: 'VERIFIED',
    });
    expect(state.incidents.map((row) => row.status)).toEqual(['VERIFIED', 'VERIFIED']);

    const outcome = state.notifications.filter((row) => row.notification_type === 'INCIDENT_OUTCOME');
    expect(outcome.map((row) => row.recipient_id).sort()).toEqual([ID.villagerA, ID.villagerB].sort());
    expect(state.notifications.some((row) => row.notification_type === 'FIELD_ACTION')).toBe(false);

    const mine = await request(app).get(`/api/v1/incidents/${second.id}`).set(bearer(TOKENS.villagerB));
    expect(mine.body.data.progress).toBe('OUTCOME');
    expect(mine.body.data.outcome).toEqual({
      decision: 'VERIFIED',
      fieldActionRequired: false,
      rejectionReason: null,
    });
    expect(JSON.stringify(mine.body)).not.toContain('Called the reporter');
  });

  it('notifies the sector rangers when field action is required and marks the pin amber', async () => {
    const { app, state } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});

    const res = await verify(app, TOKENS.officer, created.id, { fieldActionRequired: true });
    expect(res.body.data).toMatchObject({
      markerState: 'ACTION_NEEDED',
      fieldActionRequired: true,
      fieldTeamNotified: true,
    });
    const fieldNotice = state.notifications.find((row) => row.notification_type === 'FIELD_ACTION');
    expect(fieldNotice).toMatchObject({ target_sector_id: ID.sector3, incident_id: created.id });

    const map = await request(app).get('/api/v1/officer/map').set(bearer(TOKENS.officer));
    expect(map.body.data[0]).toMatchObject({ markerState: 'ACTION_NEEDED', groupedCount: 1 });
  });

  it('still saves the decision when the field-team notification fails', async () => {
    const { app, state, repositories } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});
    repositories.notificationRepository.createMany = async () => {
      throw new Error('push provider down');
    };

    const res = await verify(app, TOKENS.officer, created.id, { fieldActionRequired: true });
    expect(res.status).toBe(200);
    expect(res.body.data.fieldTeamNotified).toBe(false);
    expect(state.incidents[0].status).toBe('VERIFIED');
  });

  it('requires a verification method', async () => {
    const { app } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});
    const res = await request(app)
      .post(`/api/v1/officer/incidents/${created.id}/verify`)
      .set(bearer(TOKENS.officer))
      .send({ fieldActionRequired: true });
    expect(res.status).toBe(400);
  });

  it('simulates an outcome SMS for reporters who used the SMS channel', async () => {
    const { app, state } = createTestApp();
    const sms = await request(app)
      .post('/api/v1/sms/simulate')
      .send({ phone: '0701112233', message: 'ALIYA PALATUPANA' });

    await verify(app, TOKENS.officer, sms.body.data.incidentId);
    const outbound = state.smsLogs.filter((log) => log.direction === 'OUTBOUND').at(-1);
    expect(outbound.message).toContain('confirmed');
    expect(outbound.phone).toBe('0701112233');
  });
});

describe('rejecting a report', () => {
  it('requires a reason', async () => {
    const { app, state } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});

    for (const body of [{}, { notes: 'no reason given' }, { reason: 'BECAUSE' }]) {
      const res = await reject(app, TOKENS.officer, created.id, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    }
    expect(state.incidents[0].status).toBe('PENDING');
    expect(state.records).toHaveLength(0);
  });

  it('removes the marker from the live map but keeps the report in history and informs the reporter', async () => {
    const { app, state } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});

    const res = await reject(app, TOKENS.officer, created.id, {
      reason: 'INSUFFICIENT_EVIDENCE',
      notes: 'Could not reach the reporter.',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');

    const map = await request(app).get('/api/v1/officer/map').set(bearer(TOKENS.officer));
    expect(map.body.data).toEqual([]);
    expect(state.incidents).toHaveLength(1);

    const history = await request(app).get('/api/v1/officer/history').set(bearer(TOKENS.officer));
    expect(history.body.data[0]).toMatchObject({ decision: 'REJECTED', trackingCode: created.trackingCode });

    const mine = await request(app).get(`/api/v1/incidents/${created.id}`).set(bearer(TOKENS.villagerA));
    expect(mine.body.data.outcome).toMatchObject({
      decision: 'REJECTED',
      rejectionReason: 'INSUFFICIENT_EVIDENCE',
    });
    expect(JSON.stringify(mine.body)).not.toContain('Could not reach');
    const notice = state.notifications.find((row) => row.notification_type === 'INCIDENT_OUTCOME');
    expect(notice.body).toContain('could not confirm');
  });
});

describe('concurrent verification', () => {
  it('lets exactly one of two simultaneous officers decide the report', async () => {
    const { app, state } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});

    const [a, b] = await Promise.all([
      verify(app, TOKENS.officer, created.id, { notes: 'officer one' }),
      verify(app, TOKENS.officerB, created.id, { notes: 'officer two', fieldActionRequired: true }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(state.records).toHaveLength(1);

    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe('INCIDENT_ALREADY_REVIEWED');
    expect(loser.body.error.details).toMatchObject({ status: 'VERIFIED' });
    expect(loser.body.error.details.reviewedByName).toBeTruthy();
  });

  it('refuses a late rejection and shows who verified the report', async () => {
    const { app, state } = createTestApp();
    const created = await submit(app, TOKENS.villagerA, {});
    await verify(app, TOKENS.officer, created.id);

    const late = await reject(app, TOKENS.officerB, created.id, { reason: 'OTHER' });
    expect(late.status).toBe(409);
    expect(late.body.error.details).toMatchObject({ status: 'VERIFIED', reviewedByName: 'N. Perera' });
    expect(state.records).toHaveLength(1);
    expect(state.incidents[0].status).toBe('VERIFIED');
  });
});

describe('history and map', () => {
  it("lists the officer's own decisions and filters by decision", async () => {
    const { app } = createTestApp();
    const a = await submit(app, TOKENS.villagerA, {});
    const b = await submit(app, TOKENS.villagerB, { incidentType: 'CROP_DAMAGE', villageId: ID.kirinda });
    await verify(app, TOKENS.officer, a.id);
    await reject(app, TOKENS.officer, b.id, { reason: 'INCORRECT_LOCATION' });

    const all = await request(app).get('/api/v1/officer/history').set(bearer(TOKENS.officer));
    const rejected = await request(app)
      .get('/api/v1/officer/history?decision=REJECTED')
      .set(bearer(TOKENS.officer));
    const other = await request(app).get('/api/v1/officer/history').set(bearer(TOKENS.officerB));

    expect(all.body.data).toHaveLength(2);
    expect(rejected.body.data).toHaveLength(1);
    expect(other.body.data).toEqual([]);
  });

  it('shows unverified, action-needed and verified markers without reporter details', async () => {
    const { app } = createTestApp();
    const a = await submit(app, TOKENS.villagerA, {});
    const b = await submit(app, TOKENS.villagerB, { incidentType: 'CROP_DAMAGE', villageId: ID.kirinda });
    await submit(app, TOKENS.villagerB, { incidentType: 'SNARE_POACHING', villageId: ID.kirinda });
    await verify(app, TOKENS.officer, a.id, { fieldActionRequired: true });
    await verify(app, TOKENS.officer, b.id);

    const res = await request(app).get('/api/v1/officer/map').set(bearer(TOKENS.officer));
    const states = res.body.data.map((marker) => marker.markerState).sort();
    expect(states).toEqual(['ACTION_NEEDED', 'UNVERIFIED', 'VERIFIED']);
    expect(JSON.stringify(res.body)).not.toMatch(/phone|reporter/i);
  });
});

describe('notifications API', () => {
  it("lets the recipient list and mark their notifications as read, but not other people's", async () => {
    const { app } = createTestApp();
    await submit(app, TOKENS.villagerA, { incidentType: 'PERSON_INJURED', villageId: ID.yodakandiya });

    const list = await request(app).get('/api/v1/notifications').set(bearer(TOKENS.officer));
    expect(list.body.data).toHaveLength(1);
    const id = list.body.data[0].id;

    const stranger = await request(app)
      .patch(`/api/v1/notifications/${id}/read`)
      .set(bearer(TOKENS.villagerA));
    expect(stranger.status).toBe(404);

    const read = await request(app).patch(`/api/v1/notifications/${id}/read`).set(bearer(TOKENS.officer));
    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toBeTruthy();
  });
});

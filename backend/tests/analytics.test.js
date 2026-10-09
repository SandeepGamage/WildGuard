const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { createTestApp, bearer, TOKENS, ID } = require('./helpers/testApp');

const PALATUPANA = { latitude: 6.2994, longitude: 81.3703 };
const KIRINDA = { latitude: 6.2386, longitude: 81.3138 };

/** Put a community incident straight into the in-memory store. */
function addIncident(state, overrides = {}) {
  const row = {
    id: randomUUID(),
    tracking_code: `C-${Math.floor(Math.random() * 9000) + 1000}`,
    reporter_id: ID.villagerA,
    reporter_phone: '0771234812',
    source: 'APP',
    incident_type: 'CROP_DAMAGE',
    status: 'VERIFIED',
    urgency: 'NORMAL',
    village_id: ID.palatupana,
    gn_division_id: ID.divPalatupana,
    sector_id: ID.sector3,
    ...PALATUPANA,
    occurred_at: '2026-07-10T06:00:00.000Z',
    created_at: '2026-07-10T06:00:00.000Z',
    duplicate_of_id: null,
    ...overrides,
  };
  state.incidents.push(row);
  return row;
}

const filters = (overrides = {}) => ({
  dateFrom: '2026-06-01',
  dateTo: '2026-08-31',
  parkId: 'yala',
  reportType: 'HOTSPOT_MAP',
  incidentTypes: ['ELEPHANT_NEAR_VILLAGE', 'CROP_DAMAGE', 'PERSON_INJURED', 'SNARE_POACHING'],
  ...overrides,
});

const generate = (app, body, token = TOKENS.manager) =>
  request(app).post('/api/v1/analytics/reports').set(bearer(token)).send(body);

const exportFile = (app, id, query) =>
  request(app)
    .get(`/api/v1/analytics/reports/${id}/export`)
    .query(query)
    .set(bearer(TOKENS.manager))
    .buffer(true)
    .parse((res, done) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });

function seedSummer(state) {
  addIncident(state, { incident_type: 'ELEPHANT_NEAR_VILLAGE', occurred_at: '2026-06-05T06:00:00Z' });
  addIncident(state, { incident_type: 'ELEPHANT_NEAR_VILLAGE', occurred_at: '2026-07-05T06:00:00Z' });
  addIncident(state, { incident_type: 'CROP_DAMAGE', occurred_at: '2026-08-05T06:00:00Z' });
  addIncident(state, { incident_type: 'PERSON_INJURED', occurred_at: '2026-08-20T06:00:00Z' });
  addIncident(state, {
    incident_type: 'SNARE_POACHING',
    village_id: ID.yodakandiya,
    sector_id: ID.sector4,
    latitude: 6.355,
    longitude: 81.392,
  });
  addIncident(state, { incident_type: 'CROP_DAMAGE', village_id: ID.kirinda, ...KIRINDA });
  // Not counted: unverified, rejected, duplicate, outside the range, outside the park, wrong type.
  addIncident(state, { status: 'PENDING' });
  addIncident(state, { status: 'REJECTED' });
  addIncident(state, { status: 'VERIFIED', duplicate_of_id: randomUUID() });
  addIncident(state, { occurred_at: '2026-09-02T06:00:00Z' });
  addIncident(state, { sector_id: 'other-park-sector' });
  addIncident(state, { incident_type: 'OTHER_ANIMAL' });
  // Previous period (Mar–May): 3 verified.
  for (const day of ['2026-03-10', '2026-04-10', '2026-05-10']) {
    addIncident(state, { occurred_at: `${day}T06:00:00Z` });
  }
}

describe('UC4 access control', () => {
  it('allows only park managers', async () => {
    const { app } = createTestApp();
    for (const token of [TOKENS.villagerA, TOKENS.officer, TOKENS.ranger]) {
      const calls = [
        request(app).get('/api/v1/analytics/parks').set(bearer(token)),
        request(app).get('/api/v1/analytics/reports').set(bearer(token)),
        generate(app, filters(), token),
        request(app).get(`/api/v1/analytics/reports/${randomUUID()}`).set(bearer(token)),
      ];
      for (const res of await Promise.all(calls)) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
      }
    }
    expect((await request(app).get('/api/v1/analytics/parks')).status).toBe(401);
  });
});

describe('GET /analytics/parks', () => {
  it('lists the park with its outline and sectors', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/v1/analytics/parks').set(bearer(TOKENS.manager));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: 'yala',
        name: 'Yala National Park',
        sectors: [
          { id: ID.sector3, name: 'Sector 3' },
          { id: ID.sector4, name: 'Sector 4' },
        ],
      }),
    ]);
    expect(res.body.data[0].boundary.length).toBeGreaterThan(2);
  });
});

describe('POST /analytics/reports – filter validation (exception E1)', () => {
  const issuesOf = (res) => res.body.error.details.issues;

  it('rejects a "to" date before the "from" date', async () => {
    const { app } = createTestApp();
    const res = await generate(app, filters({ dateFrom: '2026-08-31', dateTo: '2026-06-01' }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(issuesOf(res)).toEqual([{ field: 'body.dateTo', message: '"To" date is before "From" date.' }]);
  });

  it('rejects a range longer than 3 years', async () => {
    const { app } = createTestApp();
    const res = await generate(app, filters({ dateFrom: '2022-01-01', dateTo: '2025-01-02' }));
    expect(res.status).toBe(400);
    expect(issuesOf(res)[0].field).toBe('body.dateTo');
    const ok = await generate(app, filters({ dateFrom: '2022-01-01', dateTo: '2025-01-01' }));
    expect(ok.status).not.toBe(400);
  });

  it('requires a known park', async () => {
    const { app } = createTestApp();
    const missing = await generate(app, filters({ parkId: '' }));
    expect(issuesOf(missing)).toEqual([{ field: 'body.parkId', message: 'Choose a park.' }]);
    const unknown = await generate(app, filters({ parkId: 'wilpattu' }));
    expect(issuesOf(unknown)).toEqual([{ field: 'body.parkId', message: 'Choose a park.' }]);
  });

  it('rejects malformed dates, unknown types and an empty type list', async () => {
    const { app } = createTestApp();
    const fields = async (body) => issuesOf(await generate(app, body)).map((i) => i.field);
    expect(await fields(filters({ dateFrom: '01/06/2026' }))).toEqual(['body.dateFrom']);
    expect(await fields(filters({ dateTo: '2026-02-31' }))).toEqual(['body.dateTo']);
    expect(await fields(filters({ incidentTypes: ['RHINO_SIGHTING'] }))).toEqual(['body.incidentTypes.0']);
    expect(await fields(filters({ incidentTypes: [] }))).toEqual(['body.incidentTypes']);
  });
});

describe('POST /analytics/reports – generate', () => {
  it('builds KPIs, trends, heatmap and top hotspots from verified reports only', async () => {
    const { app, state } = createTestApp({ clock: () => new Date('2026-09-01T04:00:00Z') });
    seedSummer(state);

    const res = await generate(app, filters());
    expect(res.status).toBe(201);
    const report = res.body.data;

    expect(report.park).toMatchObject({ id: 'yala', name: 'Yala National Park' });
    expect(report.filter).toMatchObject({
      dateFrom: '2026-06-01',
      dateTo: '2026-08-31',
      reportType: 'HOTSPOT_MAP',
    });
    expect(report.generatedAt).toBe('2026-09-01T04:00:00.000Z');
    expect(report.stats.totalIncidents).toBe(6);
    expect(report.stats.previousPeriodTotal).toBe(3);
    expect(report.stats.changePercent).toBe(100);
    expect(report.stats.communityReports.verified).toBe(6);
    // Every in-park report in the range counts as received, whatever its status.
    expect(report.stats.communityReports.received).toBe(10);
    expect(report.stats.injuries).toBe(1);
    expect(report.stats.conflictEvents).toBe(5);
    expect(report.stats.bySector).toEqual([
      { sectorId: ID.sector3, name: 'Sector 3', count: 5 },
      { sectorId: ID.sector4, name: 'Sector 4', count: 1 },
    ]);

    expect(report.trends.months).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(report.trends.series.find((s) => s.type === 'ELEPHANT_NEAR_VILLAGE').counts).toEqual([1, 1, 0]);

    expect(report.coverage).toEqual({
      available: false,
      coveragePercent: null,
      patrolHours: null,
      unpatrolledSectors: [],
    });
    expect(report.heatmap.bandwidthMetres).toBe(500);
    expect(report.heatmap.cells.length).toBeGreaterThan(0);
    expect(report.topHotspots[0]).toEqual({
      area: 'Palatupana',
      incidents: 4,
      mainType: 'ELEPHANT_NEAR_VILLAGE',
    });
    expect(report.landmarks).toContainEqual({ name: 'Kirinda', ...KIRINDA });

    // Privacy: no reporter identity anywhere in the response.
    const json = JSON.stringify(report);
    expect(json).not.toContain('0771234812');
    expect(json).not.toContain(ID.villagerA);
    expect(report).not.toHaveProperty('incidents');

    expect(state.reports).toHaveLength(1);
  });

  it('honours the incident type filter and a custom bandwidth', async () => {
    const { app, state } = createTestApp();
    seedSummer(state);
    const res = await generate(app, filters({ incidentTypes: ['SNARE_POACHING'], bandwidthMetres: 800 }));
    expect(res.body.data.stats.totalIncidents).toBe(1);
    expect(res.body.data.heatmap.bandwidthMetres).toBe(800);
    expect(res.body.data.topHotspots).toEqual([
      { area: 'Yodakandiya', incidents: 1, mainType: 'SNARE_POACHING' },
    ]);
  });

  it('includes UC1 patrol sessions, patrol incidents and UC2 collar alerts', async () => {
    const { app, state } = createTestApp();
    addIncident(state);
    state.patrolTracks.push({
      sectorId: ID.sector3,
      startedAt: '2026-08-29T01:00:00Z',
      endedAt: '2026-08-29T05:00:00Z',
      hours: 4,
    });
    const patrolIncident = (incidentType, occurredAt, sectorId = ID.sector3) => ({
      incidentType,
      occurredAt: new Date(occurredAt),
      sectorId,
      ...PALATUPANA,
    });
    state.patrolIncidents.push(
      patrolIncident('SNARE_POACHING', '2026-08-29T03:00:00Z'),
      patrolIncident('CARCASS', '2026-08-29T04:00:00Z'),
      patrolIncident('SNARE_POACHING', '2026-04-10T04:00:00Z'), // previous period
    );
    state.collarAlerts.push({ occurredAt: new Date('2026-08-01T03:00:00Z'), ...KIRINDA });

    // CARCASS is not among the chosen types, so only the snare counts.
    const report = (await generate(app, filters())).body.data;
    expect(report.stats).toMatchObject({ totalIncidents: 2, patrolIncidents: 1, collarAlerts: 1 });
    expect(report.stats.previousPeriodTotal).toBe(1);

    const withCarcass = (await generate(app, filters({ incidentTypes: ['SNARE_POACHING', 'CARCASS'] }))).body
      .data;
    expect(withCarcass.stats.byType).toEqual(
      expect.arrayContaining([
        { type: 'SNARE_POACHING', count: 1 },
        { type: 'CARCASS', count: 1 },
      ]),
    );
    expect(report.coverage).toMatchObject({ available: true, coveragePercent: 50, patrolHours: 4 });
    expect(report.coverage.unpatrolledSectors).toEqual([
      expect.objectContaining({ name: 'Sector 4', lastPatrolledAt: null }),
    ]);
  });

  it('adds ranger GPS points inside the park and period to the map, without ids', async () => {
    const { app, state } = createTestApp();
    addIncident(state);
    const point = (id, latitude, longitude, recordedAt) => ({
      id,
      sessionId: 'patrol-1',
      rangerId: 'ranger-1',
      latitude,
      longitude,
      recordedAt,
    });
    state.patrolTrackPoints.push(
      point('p1', 6.3, 81.37, '2026-08-10T03:00:00Z'),
      point('p2', 6.30001, 81.37001, '2026-08-10T03:00:10Z'), // same 25 m cell as p1
      point('p3', 6.31, 81.38, '2026-08-10T04:00:00Z'),
      point('p4', 6.3, 81.37, '2025-01-10T03:00:00Z'), // before the period
      point('p5', 7.5, 80.5, '2026-08-10T03:00:00Z'), // outside the park
    );

    const created = (await generate(app, filters())).body.data;
    expect(created.patrolPoints).toEqual([
      { latitude: 6.3, longitude: 81.37 },
      { latitude: 6.31, longitude: 81.38 },
    ]);
    // Saved with the report, so a saved report shows them too.
    const fetched = await request(app)
      .get(`/api/v1/analytics/reports/${created.id}`)
      .set(bearer(TOKENS.manager));
    expect(fetched.body.data.patrolPoints).toHaveLength(2);
  });

  it('returns an empty result when nothing matches (alternate flow A2)', async () => {
    const { app, state } = createTestApp();
    seedSummer(state);
    const res = await generate(app, filters({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      empty: true,
      filter: expect.objectContaining({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }),
    });
    expect(state.reports).toHaveLength(0);
  });

  it('reports the data source as unavailable when the query fails (exception E2)', async () => {
    const { app, state } = createTestApp();
    state.failAnalyticsQuery = true;
    const res = await generate(app, filters());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DATA_SOURCE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('MongoNetworkError');
  });

  it('reports the data source as unavailable when saving fails', async () => {
    const { app, state, repositories } = createTestApp();
    addIncident(state);
    repositories.analyticsRepository.saveReport = async () => {
      throw new Error('write concern failed');
    };
    const res = await generate(app, filters());
    expect(res.status).toBe(503);
  });

  it('reports the data source as unavailable when sectors cannot be read', async () => {
    const { app, repositories } = createTestApp();
    repositories.analyticsRepository.listSectors = async () => {
      throw new Error('down');
    };
    expect((await generate(app, filters())).status).toBe(503);
    expect((await request(app).get('/api/v1/analytics/parks').set(bearer(TOKENS.manager))).status).toBe(503);
  });
});

describe('saved reports', () => {
  it('fetches a saved report by id and lists the manager’s reports', async () => {
    const { app, state } = createTestApp();
    seedSummer(state);
    const created = (await generate(app, filters())).body.data;

    const fetched = await request(app)
      .get(`/api/v1/analytics/reports/${created.id}`)
      .set(bearer(TOKENS.manager));
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.stats).toEqual(created.stats);
    expect(fetched.body.data.park.name).toBe('Yala National Park');

    const list = await request(app).get('/api/v1/analytics/reports').set(bearer(TOKENS.manager));
    expect(list.body.data).toEqual([
      expect.objectContaining({ id: created.id, parkName: 'Yala National Park', totalIncidents: 6 }),
    ]);
  });

  it('returns 404 for an unknown report', async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .get(`/api/v1/analytics/reports/${randomUUID()}`)
      .set(bearer(TOKENS.manager));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REPORT_NOT_FOUND');
  });
});

describe('GET /analytics/reports/:id/export (UC4c)', () => {
  async function withReport() {
    const ctx = createTestApp();
    seedSummer(ctx.state);
    const report = (await generate(ctx.app, filters())).body.data;
    return { ...ctx, report };
  }

  it('downloads a CSV with the chosen sections and no reporter phone numbers', async () => {
    const { app, report } = await withReport();
    const res = await exportFile(app, report.id, { format: 'CSV', sections: 'KPI_SUMMARY,INCIDENT_LIST' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="wildguard-yala-2026-06-01-to-2026-08-31.csv"',
    );
    const text = res.body.toString('utf8');
    expect(text).toContain('KPI summary');
    expect(text).toContain('Incident list');
    expect(text).not.toContain('Top hotspots');
    expect(text).not.toContain('0771234812');
  });

  it('downloads a PDF using the default sections', async () => {
    const { app, report } = await withReport();
    const res = await exportFile(app, report.id, { format: 'PDF' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    // The web dashboard reads the file name cross-origin, so the header must be exposed.
    expect(res.headers['access-control-expose-headers']).toBe('Content-Disposition');
  });

  it('validates the format and sections', async () => {
    const { app, report } = await withReport();
    expect((await exportFile(app, report.id, { format: 'DOCX' })).status).toBe(400);
    expect((await exportFile(app, report.id, { format: 'CSV', sections: 'EVERYTHING' })).status).toBe(400);
    expect((await exportFile(app, report.id, { format: 'CSV', sections: ',' })).status).toBe(400);
  });

  it('returns 404 when the report does not exist', async () => {
    const { app } = createTestApp();
    expect((await exportFile(app, randomUUID(), { format: 'CSV' })).status).toBe(404);
  });

  it('returns EXPORT_FAILED when the file cannot be generated (exception E3)', async () => {
    const { app, report, services } = await withReport();
    services.analyticsService.exportEngine.exporters.PDF = {
      export: async () => {
        throw new Error('disk full');
      },
    };
    const res = await request(app)
      .get(`/api/v1/analytics/reports/${report.id}/export`)
      .query({ format: 'PDF' })
      .set(bearer(TOKENS.manager));
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('EXPORT_FAILED');
  });
});

const request = require('supertest');
const { createTestApp, bearer, TOKENS, ID } = require('./helpers/testApp');

describe('authentication', () => {
  const { app } = createTestApp();

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
    });
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set(bearer('not-a-real-token'));
    expect(res.status).toBe(401);
  });

  it('rejects a valid Supabase user that has no profile', async () => {
    const res = await request(app).get('/api/v1/auth/me').set(bearer(TOKENS.noProfile));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('returns the role from the database profile', async () => {
    const res = await request(app).get('/api/v1/auth/me').set(bearer(TOKENS.officer));
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('COMMUNITY_LIAISON_OFFICER');
    expect(res.body.data.divisionIds).toHaveLength(3);
    expect(res.body.data.divisions.map((division) => division.name)).toEqual([
      'Palatupana',
      'Kirinda',
      'Yodakandiya',
    ]);
  });

  it('protects every officer, incident and notification route', async () => {
    const routes = [
      ['get', '/api/v1/officer/queue'],
      ['get', '/api/v1/officer/map'],
      ['get', '/api/v1/incidents/mine'],
      ['get', '/api/v1/notifications'],
    ];
    for (const [method, path] of routes) {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
    }
  });
});

describe('villager registration', () => {
  const body = {
    fullName: 'Sunil Kumara',
    phone: '+94 77 765 4321',
    villageId: ID.kirinda,
    password: 'a-long-password',
    language: 'si',
    consent: true,
  };

  it('creates a VILLAGER account even if the client asks for another role', async () => {
    const { app, authGateway } = createTestApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...body, role: 'COMMUNITY_LIAISON_OFFICER' });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('VILLAGER');
    expect(res.body.data.phone).toBe('0777654321');
    expect(authGateway.created[0].email).toBe('0777654321@phone.wildguard.example');
  });

  it('refuses a mobile number that is already registered', async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...body, phone: '0771234812' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_ALREADY_REGISTERED');
  });

  it('requires consent, a valid phone number and an 8+ character password', async () => {
    const { app } = createTestApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...body, consent: false, phone: '123', password: 'short' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.issues.map((issue) => issue.field);
    expect(fields).toEqual(expect.arrayContaining(['body.consent', 'body.phone', 'body.password']));
  });

  it('does not leak internal details on unexpected failures', async () => {
    const { app, authGateway } = createTestApp();
    authGateway.createUser = async () => {
      throw new Error('secret connection string leaked');
    };
    const res = await request(app).post('/api/v1/auth/register').send(body);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

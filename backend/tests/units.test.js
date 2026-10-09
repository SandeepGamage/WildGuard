const { normalizePhone, maskPhone } = require('../src/utils/phone');
const { editDistance } = require('../src/utils/text');
const { loadConfig } = require('../src/config/env');
const { reportProgress, markerState } = require('../src/models/incident.model');
const { createTestApp, ID } = require('./helpers/testApp');
const request = require('supertest');

describe('phone helpers', () => {
  it.each([
    ['0771234567', '0771234567'],
    ['+94 77 123 4567', '0771234567'],
    ['94771234567', '0771234567'],
    ['077-123-4567', '0771234567'],
  ])('normalises %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([['12345'], ['abc'], [''], [null], ['07712345678']])('rejects %p', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it('masks all but the first three and last three digits', () => {
    expect(maskPhone('0771234812')).toBe('077 *** 812');
    expect(maskPhone(null)).toBeNull();
  });
});

describe('text helpers', () => {
  it('computes edit distance', () => {
    expect(editDistance('kirinda', 'kirinda')).toBe(0);
    expect(editDistance('kirinda', 'kirnda')).toBe(1);
    expect(editDistance('kirinda', 'palatupana')).toBeGreaterThan(3);
  });
});

describe('status mapping', () => {
  it('maps internal status to Received / Being checked / Outcome', () => {
    expect(reportProgress({ status: 'PENDING', reviewStartedAt: null })).toBe('RECEIVED');
    expect(reportProgress({ status: 'DUPLICATE', reviewStartedAt: null })).toBe('RECEIVED');
    expect(reportProgress({ status: 'DUPLICATE', reviewStartedAt: '2026-01-01' })).toBe('BEING_CHECKED');
    expect(reportProgress({ status: 'UNDER_REVIEW' })).toBe('BEING_CHECKED');
    expect(reportProgress({ status: 'VERIFIED' })).toBe('OUTCOME');
    expect(reportProgress({ status: 'REJECTED' })).toBe('OUTCOME');
  });

  it('maps marker colours by verification state', () => {
    expect(markerState({ status: 'PENDING' })).toBe('UNVERIFIED');
    expect(markerState({ status: 'VERIFIED', fieldActionRequired: true })).toBe('ACTION_NEEDED');
    expect(markerState({ status: 'VERIFIED', fieldActionRequired: false })).toBe('VERIFIED');
  });
});

describe('configuration', () => {
  it('enables the SMS simulator outside production only by default', () => {
    expect(loadConfig({ NODE_ENV: 'development' }).smsSimulatorEnabled).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production' }).smsSimulatorEnabled).toBe(false);
    expect(loadConfig({ NODE_ENV: 'production', SMS_SIMULATOR_ENABLED: 'true' }).smsSimulatorEnabled).toBe(
      true,
    );
  });

  it('splits the CORS allow-list', () => {
    expect(loadConfig({ CORS_ORIGINS: 'http://a.test, http://b.test' }).corsOrigins).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });
});

describe('platform behaviour', () => {
  const { app } = createTestApp();

  it('reports health without authentication', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('lists villages for the sign-up picker', async () => {
    const res = await request(app).get('/api/v1/villages');
    expect(res.body.data.map((village) => village.id)).toContain(ID.palatupana);
    expect(res.body.data[0]).not.toHaveProperty('aliases');
  });

  it('returns a JSON 404 for unknown routes and a 400 for broken JSON', async () => {
    expect((await request(app).get('/api/v1/nope')).body.error.code).toBe('ROUTE_NOT_FOUND');
    const broken = await request(app)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"oops"');
    expect(broken.status).toBe(400);
    expect(broken.body.error.code).toBe('INVALID_JSON');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

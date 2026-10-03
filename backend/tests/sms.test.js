const request = require('supertest');
const { createTestApp, ID } = require('./helpers/testApp');
const { MessageParser } = require('../src/services/sms/messageParser');

const simulate = (app, body) => request(app).post('/api/v1/sms/simulate').send(body);

describe('SMS simulator', () => {
  it('creates a pending report from "ALIYA PALATUPANA" and acknowledges it with a tracking code', async () => {
    const { app, state } = createTestApp();
    const res = await simulate(app, { phone: '0701112233', message: 'ALIYA PALATUPANA' });

    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(true);
    expect(res.body.data.trackingCode).toMatch(/^C-\d{4}$/);
    expect(res.body.data.reply).toContain(res.body.data.trackingCode);
    expect(res.body.data.reply).toContain('An officer will check it.');
    expect(state.incidents[0]).toMatchObject({
      source: 'SMS',
      status: 'PENDING',
      incident_type: 'ELEPHANT_NEAR_VILLAGE',
      village_id: ID.palatupana,
      reporter_id: null,
      call_back_required: false,
    });
    expect(state.smsLogs.map((log) => log.direction)).toEqual(['INBOUND', 'OUTBOUND']);
  });

  it('accepts lower case, extra spaces, a typo in the place name and Sinhala keywords', async () => {
    const { app, state } = createTestApp();
    await simulate(app, { phone: '0701112233', message: '  aliya   palatupana ' });
    await simulate(app, { phone: '0701112233', message: 'ALIYA PALATUPNA' });
    const sinhala = await simulate(app, { phone: '0701112233', message: 'අලියා කිරින්ද' });

    expect(sinhala.body.data.accepted).toBe(true);
    expect(state.incidents.filter((row) => row.village_id === ID.palatupana)).toHaveLength(2);
    expect(state.incidents.filter((row) => row.village_id === ID.kirinda)).toHaveLength(1);
  });

  it('groups an SMS report with an earlier report of the same herd as a duplicate', async () => {
    const { app, state } = createTestApp();
    await simulate(app, { phone: '0701112233', message: 'ALIYA PALATUPANA' });
    const second = await simulate(app, { phone: '0709998877', message: 'ELEPHANT PALATUPANA' });

    expect(second.body.data.duplicate).toBe(true);
    expect(state.incidents[1].status).toBe('DUPLICATE');
  });

  it('replies with the format and an example in all three languages for an invalid SMS', async () => {
    const { app, state } = createTestApp();
    const res = await simulate(app, { phone: '0701112233', message: 'HELLO THERE' });

    expect(res.status).toBe(200);
    expect(res.body.data.accepted).toBe(false);
    expect(res.body.data.reply).toContain('Send: ALIYA <village>');
    expect(res.body.data.reply).toContain('යවන්න');
    expect(res.body.data.reply).toContain('அனுப்புக');
    expect(res.body.data.reply).toContain('ALIYA PALATUPANA');
    expect(state.incidents).toHaveLength(0);
  });

  it('flags a call-back and uses the registered village when the place is not recognised', async () => {
    const { app, state } = createTestApp();
    const res = await simulate(app, { phone: '0771234812', message: 'ALIYA SOMEWHERE' });

    expect(res.body.data.accepted).toBe(true);
    expect(res.body.data.callBackRequired).toBe(true);
    expect(res.body.data.reply).toContain('may call you back');
    expect(state.incidents[0]).toMatchObject({
      village_id: ID.palatupana,
      reporter_id: ID.villagerA,
      call_back_required: true,
      raw_location_text: 'SOMEWHERE',
    });
  });

  it('creates no incident when the place is unknown and the sender is not registered', async () => {
    const { app, state } = createTestApp();
    const res = await simulate(app, { phone: '0701112233', message: 'ALIYA SOMEWHERE' });

    expect(res.body.data.accepted).toBe(false);
    expect(res.body.data.reply).toContain('Place not recognised');
    expect(state.incidents).toHaveLength(0);
  });

  it('rejects an invalid phone number and an empty message', async () => {
    const { app } = createTestApp();
    expect((await simulate(app, { phone: 'abc', message: 'ALIYA PALATUPANA' })).status).toBe(400);
    expect((await simulate(app, { phone: '0701112233', message: '' })).status).toBe(400);
  });

  it('is not mounted when the simulator is disabled', async () => {
    const { app } = createTestApp({ smsSimulatorEnabled: false });
    const res = await simulate(app, { phone: '0701112233', message: 'ALIYA PALATUPANA' });
    expect(res.status).toBe(404);
  });

  it('acknowledges and queues the report when the database save fails, then saves it on retry', async () => {
    const { app, state, services } = createTestApp();
    state.failNextInsert = true;

    const res = await simulate(app, { phone: '0701112233', message: 'ALIYA PALATUPANA' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ accepted: true, queued: true, trackingCode: null });
    expect(res.body.data.reply).toContain('An officer will check it.');
    expect(state.incidents).toHaveLength(0);
    expect(services.pendingQueue.size).toBe(1);

    await services.pendingQueue.flush();
    expect(state.incidents).toHaveLength(1);
    expect(services.pendingQueue.size).toBe(0);
    services.pendingQueue.stop();
  });
});

describe('MessageParser', () => {
  const parser = new MessageParser();

  it('splits keyword and place and reports the keyword language', () => {
    expect(parser.parse('ALIYA PALATUPANA')).toEqual({
      ok: true,
      incidentType: 'ELEPHANT_NEAR_VILLAGE',
      language: 'si',
      replyLanguage: null,
      locationText: 'PALATUPANA',
    });
    expect(parser.parse('YANAI Kirinda')).toMatchObject({ language: 'ta', locationText: 'Kirinda' });
    expect(parser.parse('யானை Kirinda')).toMatchObject({ language: 'ta', replyLanguage: 'ta' });
    expect(parser.parse('ELEPHANT Kirinda')).toMatchObject({ language: 'en' });
  });

  it('keeps multi-word place names together', () => {
    expect(parser.parse('ALIYA Tissa Maha Rama').locationText).toBe('Tissa Maha Rama');
  });

  it.each([[''], ['   '], ['HELLO'], [null]])('rejects %p', (message) => {
    expect(parser.parse(message).ok).toBe(false);
  });
});

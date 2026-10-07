const request = require('supertest');
const { createTestApp } = require('./helpers/testApp');
const {
  ALERT_STATUS,
  BREACH_SEVERITY,
  RESPONSE_ACTION,
  ZONE_TYPE,
  PROXIMITY_STATUS,
} = require('../src/constants/domain');

describe('UC2: Real-time Wildlife Hazard & Collar Alert Management (SE3070 A2 Report / IT23594586)', () => {
  let app;
  let services;

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
    services = testApp.services;
  });

  describe('Screenshot 1: Collar simulation in HazardMonitoringController', () => {
    it('simulates collar telemetry and executes geofence checks across risk zones', async () => {
      // 1. Farmland breach reading
      const breachReading = {
        collarId: 'EL-07',
        animalLabel: 'Collared Elephant EL-07',
        latitude: 6.2994,
        longitude: 81.3703,
        recordedAt: new Date().toISOString(),
      };

      const res = await request(app).post('/api/v1/collar/telemetry').send(breachReading).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isBreach).toBe(true);
      expect(res.body.data.alert).toBeDefined();
      expect(res.body.data.alert.collar_id).toBe('EL-07');
      expect(res.body.data.alert.zone_name).toContain('Palatupana');
    });

    it('suppresses duplicate alerts (A2) by updating existing open alert location without dispatch storm', async () => {
      const reading1 = {
        collarId: 'EL-07',
        animalLabel: 'Collared Elephant EL-07',
        latitude: 6.2994,
        longitude: 81.3703,
      };
      const res1 = await request(app).post('/api/v1/collar/telemetry').send(reading1).expect(200);
      const alertId = res1.body.data.alert.id;

      const reading2 = {
        collarId: 'EL-07',
        animalLabel: 'Collared Elephant EL-07',
        latitude: 6.3005,
        longitude: 81.3712,
      };
      const res2 = await request(app).post('/api/v1/collar/telemetry').send(reading2).expect(200);

      expect(res2.body.data.alert.id).toBe(alertId);
      expect(res2.body.data.alert.latitude).toBe(6.3005);
      expect(res2.body.data.isDuplicateSuppressed).toBe(true);
    });

    it('logs silent telemetry without active alarms when animal is in safe zone (A1)', async () => {
      const safeReading = {
        collarId: 'EL-07',
        animalLabel: 'Collared Elephant EL-07',
        latitude: 6.45,
        longitude: 81.5,
        recordedAt: new Date().toISOString(),
      };

      const res = await request(app).post('/api/v1/collar/telemetry').send(safeReading).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isBreach).toBe(false);
      expect(res.body.data.alert).toBeNull();
      expect(res.body.data.message).toContain('Safe zone');
    });
  });

  describe('Screenshot 2: Alert on dashboard with status timeline (O1 & UC2e)', () => {
    it('creates alert with 5-stage status timeline and logs village early-warning SMS (UC2e)', async () => {
      // Ingest breach in Palatupana Farmland / Village perimeter
      const res = await request(app).post('/api/v1/collar/telemetry').send({
        collarId: 'EL-07',
        animalLabel: 'Collared Elephant EL-07',
        latitude: 6.2994,
        longitude: 81.3703,
      }).expect(200);

      const alert = res.body.data.alert;
      expect(alert).toBeDefined();

      // Timeline verification (O1)
      expect(Array.isArray(alert.status_timeline)).toBe(true);
      const timelineStatuses = alert.status_timeline.map((t) => t.status);
      expect(timelineStatuses).toContain('RAISED');
      expect(timelineStatuses).toContain('VILLAGE_SMS_SENT');

      // Village SMS verification (UC2e)
      expect(alert.village_sms).toBeDefined();
      expect(alert.village_sms.sent).toBe(true);
      expect(alert.village_sms.sample_message).toContain('WILDGUARD ALERT');
    });
  });

  describe('Screenshot 3: Nearest-responder dispatch (O4 & UC2b)', () => {
    it('auto-dispatches nearest responder using patrol positions and updates timeline on 3m acknowledgement', async () => {
      const breachRes = await request(app).post('/api/v1/collar/telemetry').send({
        collarId: 'EL-07',
        animalLabel: 'Collared Elephant EL-07',
        latitude: 6.241, // Close to RESP-01 (lat 6.241, lng 81.315)
        longitude: 81.315,
      }).expect(200);

      const alertId = breachRes.body.data.alert.id;
      const dispatch = breachRes.body.data.alert.dispatch;

      expect(dispatch).toBeDefined();
      expect(dispatch.responder_name).toContain('R. M. Bandara');
      expect(dispatch.distance_m).toBeLessThan(100);

      // Responder acknowledges within 3 minutes (O4)
      const ackRes = await request(app)
        .post(`/api/v1/collar/alerts/${alertId}/respond`)
        .send({
          responderId: dispatch.responder_id,
          notes: 'Unit arriving in jeep with searchlights.',
        })
        .expect(200);

      expect(ackRes.body.success).toBe(true);
      expect(ackRes.body.data.alert.status).toBe(ALERT_STATUS.ACKNOWLEDGED);

      const timeline = ackRes.body.data.alert.status_timeline.map((t) => t.status);
      expect(timeline).toContain('ACKNOWLEDGED');
    });
  });

  describe('Screenshot 4: Escalation and manual responder assignment (O2, UC2d & E2)', () => {
    it('escalates alert on timeout/unavailability and lists candidates for manual assignment', async () => {
      const breachRes = await request(app).post('/api/v1/collar/telemetry').send({
        collarId: 'EL-07',
        latitude: 6.2994,
        longitude: 81.3703,
      }).expect(200);
      const alertId = breachRes.body.data.alert.id;

      // Escalate alert (E2)
      const escRes = await request(app)
        .post(`/api/v1/collar/alerts/${alertId}/escalate`)
        .send({ reason: 'Responder incommunicado / timeout expired (E2)' })
        .expect(200);

      expect(escRes.body.data.escalated).toBe(true);
      expect(escRes.body.data.alert.status).toBe(ALERT_STATUS.ESCALATED);

      // Fetch candidates list for escalation panel (O2)
      const candRes = await request(app).get(`/api/v1/collar/alerts/${alertId}/candidates`).expect(200);
      expect(Array.isArray(candRes.body.data)).toBe(true);
      expect(candRes.body.data.length).toBeGreaterThan(0);
      expect(candRes.body.data[0].distanceM).toBeDefined();

      // Officer manually reassigns responder
      const assignRes = await request(app)
        .post(`/api/v1/collar/alerts/${alertId}/assign-responder`)
        .send({
          responderId: 'RESP-02',
          officerId: 'OFF-01',
          officerNotes: 'Manually re-routed patrol vehicle from beat station.',
        })
        .expect(200);

      expect(assignRes.body.data.alert.status).toBe(ALERT_STATUS.DISPATCHED);
      expect(assignRes.body.data.alert.dispatch.responder_id).toBe('RESP-02');
    });
  });

  describe('Screenshot 5: Camera-trap review queue (O3, UC2c & A3)', () => {
    it('queues low confidence (<0.80) detections for Operations Officer review and raises alert on approval', async () => {
      // 1. Upload low confidence camera trap image
      const trapRes = await request(app).post('/api/v1/collar/camera-trap').send({
        trapId: 'TRAP-04',
        imageUrl: 'https://example.com/elephant_night.jpg',
        latitude: 6.2994,
        longitude: 81.3703,
        species: 'Asian Elephant',
        confidence: 0.65, // < 0.80 -> triggers O3 review queue
        isThreat: true,
      }).expect(200);

      expect(trapRes.body.data.queuedForReview).toBe(true);
      const reviewId = trapRes.body.data.reviewId;
      expect(reviewId).toBeDefined();

      // 2. Fetch pending queue (O3)
      const pendingRes = await request(app).get('/api/v1/collar/camera-trap/pending').expect(200);
      expect(pendingRes.body.data.length).toBeGreaterThan(0);

      // 3. Officer reviews image and confirms threat (O3 action)
      const reviewActionRes = await request(app)
        .post(`/api/v1/collar/camera-trap/${reviewId}/review`)
        .send({
          officerId: 'OFF-01',
          species: 'Asian Elephant (Bull)',
          isThreat: true,
          notes: 'Verified visual of lone bull near village irrigation canal.',
        })
        .expect(200);

      expect(reviewActionRes.body.data.alertRaised).toBe(true);
      expect(reviewActionRes.body.data.alert).toBeDefined();
      expect(reviewActionRes.body.data.alert.animal_label).toContain('TRAP-04');
    });

    it('auto-raises alert when camera trap AI confidence is >= 0.80 with threat', async () => {
      const trapRes = await request(app).post('/api/v1/collar/camera-trap').send({
        trapId: 'TRAP-09',
        imageUrl: 'https://example.com/clear_elephant.jpg',
        latitude: 6.2994,
        longitude: 81.3703,
        species: 'Asian Elephant',
        confidence: 0.94, // >= 0.80 -> auto-raised
        isThreat: true,
      }).expect(200);

      expect(trapRes.body.data.autoRaised).toBe(true);
      expect(trapRes.body.data.alert).toBeDefined();
    });
  });

  describe('Screenshot 6: Collar signal lost & Alert resolution with reason (E1 & Table 18 Step 10)', () => {
    it('flags silent collar (>30 min) as Signal Lost and displays last known position', async () => {
      const sigRes = await request(app)
        .post('/api/v1/collar/devices/COL-402/simulate-signal-lost')
        .expect(200);

      expect(sigRes.body.data.signalLost).toBe(true);
      expect(sigRes.body.data.lastKnownLocation).toBeDefined();
    });

    it('resolves alert with mandatory resolution reason (Table 18 Step 10)', async () => {
      const breachRes = await request(app).post('/api/v1/collar/telemetry').send({
        collarId: 'EL-07',
        latitude: 6.2994,
        longitude: 81.3703,
      }).expect(200);
      const alertId = breachRes.body.data.alert.id;

      // Resolving without reason must fail
      await request(app)
        .post(`/api/v1/collar/alerts/${alertId}/resolve`)
        .send({ reason: '' })
        .expect(400);

      // Resolving with proper reason succeeds
      const resRes = await request(app)
        .post(`/api/v1/collar/alerts/${alertId}/resolve`)
        .send({
          reason: 'Elephant guided back to park boundary safely using thunder flashes and vehicle escort.',
          officerId: 'OFF-01',
          notes: 'No crop damage reported; villagers calm.',
        })
        .expect(200);

      expect(resRes.body.data.success).toBe(true);
      expect(resRes.body.data.alert.status).toBe(ALERT_STATUS.RESOLVED);
      expect(resRes.body.data.alert.resolution_reason).toContain('Elephant guided back');
      
      const timeline = resRes.body.data.alert.status_timeline.map((t) => t.status);
      expect(timeline).toContain('RESOLVED');
    });
  });

  describe('Backwards Compatibility & Audit Trail', () => {
    it('supports legacy acknowledgeAlert and markFalseAlarm actions', async () => {
      const breachRes = await request(app).post('/api/v1/collar/telemetry').send({
        collarId: 'EL-07',
        latitude: 6.2994,
        longitude: 81.3703,
      });
      const alertId = breachRes.body.data.alert.id;

      const falseAlarmRes = await request(app)
        .post(`/api/v1/collar/alerts/${alertId}/false-alarm`)
        .send({
          officerId: 'OFF-01',
          notes: 'Stationary GPS multipath signal drift near rocky outcrop.',
        })
        .expect(200);

      expect(falseAlarmRes.body.data.alert.status).toBe(ALERT_STATUS.FALSE_ALARM);
    });

    it('returns geofence zones, tracked collars, and audit trail', async () => {
      const zones = await request(app).get('/api/v1/collar/zones').expect(200);
      expect(zones.body.data.length).toBeGreaterThan(0);

      const collars = await request(app).get('/api/v1/collar/devices').expect(200);
      expect(Array.isArray(collars.body.data)).toBe(true);

      const audit = await request(app).get('/api/v1/collar/alerts/audit-trail').expect(200);
      expect(Array.isArray(audit.body.data)).toBe(true);
    });
  });
});

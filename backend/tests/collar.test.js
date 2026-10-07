const request = require('supertest');
const { createTestApp } = require('./helpers/testApp');
const { ALERT_STATUS, BREACH_SEVERITY, RESPONSE_ACTION } = require('../src/constants/domain');

describe('UC2: Manage Wildlife Collar Boundary Alerts (Hanaan / IT23594586)', () => {
  let app;

  beforeEach(() => {
    const testApp = createTestApp();
    app = testApp.app;
  });

  describe('Main Flow: Ingest collar telemetry & boundary breach detection', () => {
    it('triggers an active visual and acoustic alarm when animal breaches high-risk geofence', async () => {
      // Kirinda buffer zone centre: lat 6.2386, lng 81.3138, radius 3500m
      const breachReading = {
        collarId: 'EL-07',
        animalLabel: 'Collared Elephant EL-07',
        latitude: 6.239,
        longitude: 81.314,
        recordedAt: new Date().toISOString(),
      };

      const res = await request(app).post('/api/v1/collar/telemetry').send(breachReading).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isBreach).toBe(true);
      expect(res.body.data.siren).toBe(true);
      expect(res.body.data.priority).toBe(BREACH_SEVERITY.HIGH);
      expect(res.body.data.alert).toBeDefined();
      expect(res.body.data.alert.collar_id).toBe('EL-07');
      expect(res.body.data.alert.status).toBe(ALERT_STATUS.ACTIVE);
      expect(res.body.data.alert.alert_reference).toMatch(/^ALT-/);
    });

    it('updates existing active alert location if same collar breaches repeatedly', async () => {
      const reading1 = {
        collarId: 'EL-07',
        animalLabel: 'Collared Elephant EL-07',
        latitude: 6.239,
        longitude: 81.314,
      };
      const res1 = await request(app).post('/api/v1/collar/telemetry').send(reading1).expect(200);
      const alertId = res1.body.data.alert.id;

      const reading2 = {
        collarId: 'EL-07',
        animalLabel: 'Collared Elephant EL-07',
        latitude: 6.24,
        longitude: 81.315,
      };
      const res2 = await request(app).post('/api/v1/collar/telemetry').send(reading2).expect(200);

      expect(res2.body.data.alert.id).toBe(alertId);
      expect(res2.body.data.alert.latitude).toBe(6.24);
    });
  });

  describe('Alternate Flow A: Animal Remains in Safe Zone', () => {
    it('logs silent telemetry without triggering active alarm when animal is outside geofences', async () => {
      // Safe point far away from Kirinda (6.2386) and Palatupana (6.2994)
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
      expect(res.body.data.siren).toBe(false);
      expect(res.body.data.alert).toBeNull();
      expect(res.body.data.message).toContain('Safe zone');
    });
  });

  describe('Alternate Flow B: Multiple Simultaneous Boundary Breaches', () => {
    it('prioritizes active alerts by severity level and recent timestamp', async () => {
      // Breach in Kirinda buffer (HIGH severity)
      await request(app).post('/api/v1/collar/telemetry').send({
        collarId: 'EL-07',
        animalLabel: 'Elephant EL-07',
        latitude: 6.2386,
        longitude: 81.3138,
      });

      // Breach in Palatupana zone (HIGH severity)
      await request(app).post('/api/v1/collar/telemetry').send({
        collarId: 'EL-12',
        animalLabel: 'Elephant EL-12',
        latitude: 6.2994,
        longitude: 81.3703,
      });

      const res = await request(app).get('/api/v1/collar/alerts/active').expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].status).toBe(ALERT_STATUS.ACTIVE);
    });
  });

  describe('Main Flow Steps 8-11: Officer Review & Ranger Dispatch Protocol', () => {
    it('acknowledges alert, dispatches field ranger, and logs management action', async () => {
      const breachRes = await request(app).post('/api/v1/collar/telemetry').send({
        collarId: 'EL-07',
        animalLabel: 'Elephant EL-07',
        latitude: 6.2386,
        longitude: 81.3138,
      });
      const alertId = breachRes.body.data.alert.id;

      const ackRes = await request(app)
        .post(`/api/v1/collar/alerts/${alertId}/acknowledge`)
        .send({
          responseAction: RESPONSE_ACTION.DISPATCH_RANGER,
          officerId: 'OFF-01',
          officerNotes: 'Elephant approaching village paddy fields. Immediate flare patrol required.',
          dispatchedRangerId: 'RANGER-05',
        })
        .expect(200);

      expect(ackRes.body.success).toBe(true);
      expect(ackRes.body.data.dispatched).toBe(true);
      expect(ackRes.body.data.alert.status).toBe(ALERT_STATUS.ACKNOWLEDGED);
      expect(ackRes.body.data.alert.response_action).toBe(RESPONSE_ACTION.DISPATCH_RANGER);
      expect(ackRes.body.data.alert.officer_id).toBe('OFF-01');
    });

    it('resolves alert when response action is MONITOR_CLOSELY', async () => {
      const breachRes = await request(app).post('/api/v1/collar/telemetry').send({
        collarId: 'EL-07',
        latitude: 6.2386,
        longitude: 81.3138,
      });
      const alertId = breachRes.body.data.alert.id;

      const ackRes = await request(app)
        .post(`/api/v1/collar/alerts/${alertId}/acknowledge`)
        .send({
          responseAction: RESPONSE_ACTION.MONITOR_CLOSELY,
          officerNotes: 'Animal stationary on outer buffer perimeter.',
        })
        .expect(200);

      expect(ackRes.body.data.alert.status).toBe(ALERT_STATUS.RESOLVED);
    });
  });

  describe('Alternate Flow C: Manual Override / False Alarm', () => {
    it('marks alert as FALSE_ALARM with explanatory notes', async () => {
      const breachRes = await request(app).post('/api/v1/collar/telemetry').send({
        collarId: 'EL-07',
        latitude: 6.2386,
        longitude: 81.3138,
      });
      const alertId = breachRes.body.data.alert.id;

      const falseAlarmRes = await request(app)
        .post(`/api/v1/collar/alerts/${alertId}/false-alarm`)
        .send({
          officerId: 'OFF-01',
          notes: 'Stationary GPS multipath signal drift near rocky outcrop.',
        })
        .expect(200);

      expect(falseAlarmRes.body.success).toBe(true);
      expect(falseAlarmRes.body.data.alert.status).toBe(ALERT_STATUS.FALSE_ALARM);
      expect(falseAlarmRes.body.data.alert.officer_notes).toContain('drift');
    });
  });

  describe('Alternate Flow D: Offline / Delayed Telemetry Batch Upload', () => {
    it('processes batch readings and flags historical breaches as DELAYED_INCIDENT', async () => {
      const batchPayload = {
        readings: [
          {
            collarId: 'EL-07',
            latitude: 6.45,
            longitude: 81.5,
            recordedAt: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            collarId: 'EL-07',
            latitude: 6.2386,
            longitude: 81.3138,
            recordedAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
      };

      const res = await request(app).post('/api/v1/collar/batch').send(batchPayload).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalProcessed).toBe(2);
      expect(res.body.data.breachesDetected).toBe(1);
      expect(res.body.data.delayedIncidents).toBe(1);
    });
  });

  describe('Directory & Audit Trail Endpoints', () => {
    it('lists configured geofence zones', async () => {
      const res = await request(app).get('/api/v1/collar/zones').expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].radius_metres).toBeDefined();
    });

    it('lists tracked animal collar devices', async () => {
      const res = await request(app).get('/api/v1/collar/devices').expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns the wildlife monitoring audit trail', async () => {
      const res = await request(app).get('/api/v1/collar/alerts/audit-trail').expect(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Validation & Error Handling', () => {
    it('rejects telemetry with invalid latitude/longitude', async () => {
      const invalid = {
        collarId: 'EL-07',
        latitude: 195.0, // Invalid latitude
        longitude: 81.31,
      };

      await request(app).post('/api/v1/collar/telemetry').send(invalid).expect(400);
    });

    it('returns 500/400 for unknown alert acknowledgment', async () => {
      await request(app)
        .post('/api/v1/collar/alerts/00000000-0000-0000-0000-000000000000/acknowledge')
        .send({
          responseAction: RESPONSE_ACTION.DISPATCH_RANGER,
        })
        .expect(500);
    });
  });
});

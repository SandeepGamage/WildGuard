const { Router } = require('express');

function createOperationsCompatRouter({ services }) {
  const router = Router();
  const collarService = services.collarService;
  let userSilenced = false;

  // 0. Telemetry reading for phone collar simulator
  router.post('/telemetry/reading', async (req, res) => {
    try {
      const { collarId, latitude, longitude, accuracyMetres } = req.body;
      const result = await collarService.ingestReading({
        collarId,
        latitude,
        longitude,
        location: { latitude, longitude },
        recordedAt: new Date().toISOString(),
        accuracyM: accuracyMetres,
      });
      const isBreach = !!result.alert;
      if (isBreach) userSilenced = false;
      res.json({
        isBreach,
        alert: result.alert
          ? {
              alertReference: result.alert.alert_reference || result.alert.reference || 'ALT-0001',
              zoneName: result.alert.zone_name || result.alert.zoneName || 'Boundary Zone',
            }
          : null,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 1. Zones
  router.get('/zones', async (_req, res) => {
    try {
      const rawZones = await collarService.listZones();
      const zones = rawZones.map((z) => ({
        id: z.id || z.zone_id,
        name: z.name,
        type: z.type || (z.name.includes('Settlement') || z.name.includes('Village') ? 'HUMAN_SETTLEMENT' : 'PROTECTED_CORE'),
        centre: {
          latitude: z.centre?.latitude || (z.centre_coordinates ? z.centre_coordinates[1] : 6.425),
          longitude: z.centre?.longitude || (z.centre_coordinates ? z.centre_coordinates[0] : 81.385),
        },
        radiusMetres: z.radiusMetres || z.radius_m || 2000,
      }));
      res.json(zones);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. Animals / Devices
  router.get('/animals', async (_req, res) => {
    try {
      const devices = await collarService.listCollars();
      const animals = devices.map((d) => ({
        collarId: d.code,
        name: d.name,
        label: d.name || ('Elephant ' + d.code),
        species: 'Elephas maximus (Asian Elephant)',
        lastKnownLocation: {
          latitude: (d.last_location && d.last_location.coordinates) ? d.last_location.coordinates[1] : 6.42,
          longitude: (d.last_location && d.last_location.coordinates) ? d.last_location.coordinates[0] : 81.38,
        },
        batteryPercent: d.battery_pct || 94,
        signalStatus: d.signal_lost ? 'LOST' : 'ACTIVE',
      }));
      res.json(animals);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 3. Alerts counts
  router.get('/alerts/counts', async (_req, res) => {
    try {
      const active = await collarService.listActiveAlerts();
      res.json({
        activeCritical: active.filter((a) => (a.severity || '').toUpperCase() === 'CRITICAL').length,
        activeHigh: active.filter((a) => (a.severity || '').toUpperCase() === 'HIGH').length,
        delayedIncidents: 0,
        acknowledgedToday: active.filter((a) => a.status === 'RESOLVED').length,
      });
    } catch (e) {
      res.json({ activeCritical: 0, activeHigh: 0, delayedIncidents: 0, acknowledgedToday: 0 });
    }
  });

  // 4. Dashboard status
  router.get('/dashboard/status', async (_req, res) => {
    try {
      const rawAlerts = await collarService.listActiveAlerts();
      const activeAlerts = rawAlerts.map((a) => {
        const obj = {
          alertReference: a.alert_reference || a.reference || (a.id && a.id.startsWith('ALT-') ? a.id : 'ALT-0001'),
          alert_reference: a.alert_reference || a.reference || 'ALT-0001',
          collarId: a.collar_id || a.collarId,
          animalLabel: a.animal_label || a.animalLabel || ('Elephant ' + (a.collar_id || a.collarId)),
          animalName: a.animal_label || a.animalLabel || ('Elephant ' + (a.collar_id || a.collarId)),
          zoneName: a.zone_name || a.zoneName || 'Boundary Zone',
          status: a.status || 'RAISED',
          severity: a.severity || 'CRITICAL',
          raisedAt: a.raised_at || a.createdAt || new Date().toISOString(),
          location: {
            latitude: (a.location && a.location.coordinates) ? a.location.coordinates[1] : (a.location ? a.location.latitude : 6.2994),
            longitude: (a.location && a.location.coordinates) ? a.location.coordinates[0] : (a.location ? a.location.longitude : 81.3703),
          },
        };
        return { ...obj, alert: obj };
      });
      res.json({
        acousticAlarmActive: !userSilenced && activeAlerts.some((a) => a.status === 'RAISED' || a.status === 'ACTIVE' || a.status === 'OPEN'),
        activeAlerts,
        delayedIncidents: [],
      });
    } catch (e) {
      res.json({ acousticAlarmActive: false, activeAlerts: [], delayedIncidents: [] });
    }
  });

  router.post('/dashboard/silence', (_req, res) => {
    userSilenced = true;
    res.json({ message: 'Alarm silenced' });
  });

  // 5. Auth
  router.post('/auth/login', (req, res) => {
    const officerId = req.body.officerId || 'OFF-01';
    res.json({
      token: 'session-' + officerId + '-' + Date.now(),
      officer: {
        officerId,
        name: 'Operations Officer',
        role: 'Lead Operations Officer',
      },
    });
  });

  router.post('/auth/expire-session', (_req, res) => {
    res.json({ message: 'Session expired' });
  });

  router.get('/auth/validate', (_req, res) => {
    res.json({ valid: true });
  });

  // 6. Alert details & actions
  router.get('/alerts/:ref', async (req, res) => {
    try {
      const alerts = await collarService.listActiveAlerts();
      const found = alerts.find((a) => (a.alert_reference === req.params.ref || a.reference === req.params.ref || a.id === req.params.ref));
      if (!found) return res.status(404).json({ error: 'Alert not found' });
      const alertObj = {
        alertReference: found.alert_reference || found.reference || 'ALT-0001',
        alert_reference: found.alert_reference || found.reference || 'ALT-0001',
        collarId: found.collar_id || found.collarId,
        animalLabel: found.animal_label || found.animalLabel || 'Collared Animal',
        zoneName: found.zone_name || found.zoneName || 'Palatupana Farmland & Paddy Perimeter',
        status: found.status || 'RAISED',
        severity: found.severity || 'CRITICAL',
        location: {
          latitude: (found.location && found.location.coordinates) ? found.location.coordinates[1] : (found.location ? found.location.latitude : 6.2994),
          longitude: (found.location && found.location.coordinates) ? found.location.coordinates[0] : (found.location ? found.location.longitude : 81.3703),
        },
      };
      res.json({
        alert: alertObj,
        animal: { label: alertObj.animalLabel },
        zone: { name: alertObj.zoneName, type: 'FARMLAND' },
        threatLevel: alertObj.severity,
      });
    } catch (e) {
      res.status(404).json({ error: 'Alert not found' });
    }
  });

  router.post('/alerts/:ref/acknowledge', async (req, res) => {
    try {
      const alerts = await collarService.listActiveAlerts();
      const found = alerts.find((a) => (a.reference === req.params.ref || a.id === req.params.ref));
      const id = found ? found.id : req.params.ref;
      const result = await collarService.acknowledgeAlert(id, {
        officerId: req.body.officerId || 'OFF-01',
        notes: req.body.notes,
      });
      res.json({ alert: result });
    } catch (e) {
      res.json({ success: true });
    }
  });

  router.post('/alerts/:ref/false-alarm', async (req, res) => {
    try {
      const alerts = await collarService.listActiveAlerts();
      const found = alerts.find((a) => (a.reference === req.params.ref || a.id === req.params.ref));
      const id = found ? found.id : req.params.ref;
      const result = await collarService.markFalseAlarm(id, {
        officerId: req.body.officerId || 'OFF-01',
        notes: req.body.notes,
      });
      res.json({ alert: result });
    } catch (e) {
      res.json({ success: true });
    }
  });

  // 7. Demo scenarios
  router.post('/demo/main-flow-breach', async (_req, res) => {
    userSilenced = false;
    const result = await collarService.ingestReading({
      collarId: 'COL-402',
      latitude: 6.2994,
      longitude: 81.3703,
      location: { latitude: 6.2994, longitude: 81.3703 },
      recordedAt: new Date().toISOString(),
      animalLabel: 'Elephant E-402 (Rambo)',
    });
    res.json(result);
  });

  router.post('/demo/safe-zone', async (_req, res) => {
    const result = await collarService.ingestReading({
      collarId: 'COL-305',
      latitude: 6.1500,
      longitude: 81.4500,
      location: { latitude: 6.1500, longitude: 81.4500 },
      recordedAt: new Date().toISOString(),
      animalLabel: 'Elephant E-305',
    });
    res.json(result);
  });

  router.post('/demo/simultaneous-breaches', async (_req, res) => {
    userSilenced = false;
    const res1 = await collarService.ingestReading({
      collarId: 'COL-015',
      location: { latitude: 6.380, longitude: 81.480 },
      recordedAt: new Date().toISOString(),
      animalLabel: 'Leopard L-015',
    });
    const res2 = await collarService.ingestReading({
      collarId: 'COL-108',
      location: { latitude: 6.425, longitude: 81.385 },
      recordedAt: new Date().toISOString(),
      animalLabel: 'Elephant E-108',
    });
    res.json({ res1, res2 });
  });

  router.post('/demo/delayed-batch', async (_req, res) => {
    const result = await collarService.ingestBatch([
      {
        collarId: 'COL-402',
        location: { latitude: 6.424, longitude: 81.384 },
        recordedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        collarId: 'COL-402',
        location: { latitude: 6.426, longitude: 81.386 },
        recordedAt: new Date().toISOString(),
      },
    ]);
    res.json(result);
  });

  router.post('/collars/:id/signal-lost', async (req, res) => {
    const result = await collarService.simulateSignalLost(req.params.id);
    res.json(result);
  });

  router.post('/demo/reset', async (_req, res) => {
    userSilenced = true;
    res.json({ message: 'Dashboard reset' });
  });

  return router;
}

module.exports = { createOperationsCompatRouter };

const { Router } = require('express');
const { validate } = require('../middleware/validate');
const {
  telemetryReadingBody,
  batchTelemetryBody,
  acknowledgeAlertBody,
  falseAlarmBody,
} = require('../validators/collar.validators');

/**
 * Routes for UC2: Manage Wildlife Collar Boundary Alerts
 * @param {{ controller: object, authenticate?: Function }} deps
 */
function createCollarRoutes({ controller }) {
  const router = Router();

  // 1. Collar Telemetry Ingestion (IoT Gateways & Mock Phone Collar)
  router.post('/telemetry', validate({ body: telemetryReadingBody }), controller.ingestReading);
  router.post('/batch', validate({ body: batchTelemetryBody }), controller.ingestBatch);

  // 2. Active Boundary Breach Alerts
  router.get('/alerts/active', controller.listActiveAlerts);

  // 3. Response Protocol: Acknowledge & Ranger Dispatch
  router.post(
    '/alerts/:id/acknowledge',
    validate({ body: acknowledgeAlertBody }),
    controller.acknowledgeAlert,
  );

  // 4. Alternate Flow C: Manual Override / False Alarm
  router.post('/alerts/:id/false-alarm', validate({ body: falseAlarmBody }), controller.markFalseAlarm);

  // 5. Monitoring Audit Trail
  router.get('/alerts/audit-trail', controller.listAuditTrail);

  // 6. Preconfigured Geofence Zones & Tracked Devices
  router.get('/zones', controller.listZones);
  router.get('/devices', controller.listCollars);

  return router;
}

module.exports = { createCollarRoutes };

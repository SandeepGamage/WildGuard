const { Router } = require('express');
const { validate } = require('../middleware/validate');
const {
  telemetryReadingBody,
  batchTelemetryBody,
  acknowledgeDispatchBody,
  manualAssignBody,
  resolveAlertBody,
  cameraTrapBody,
  cameraReviewBody,
  acknowledgeAlertBody,
  falseAlarmBody,
} = require('../validators/collar.validators');

/**
 * Routes for UC2: Real-time Wildlife Hazard & Collar Alert Management
 * Matches SE3070 A2 Report Section 7.4.2 & Section 8.2.
 * @param {{ controller: object, authenticate?: Function }} deps
 */
function createCollarRoutes({ controller }) {
  const router = Router();

  // 1. Collar Telemetry Ingestion (Screenshot 1: Collar simulation in HazardMonitoringController)
  router.post('/telemetry', validate({ body: telemetryReadingBody }), controller.ingestReading);
  router.post('/batch', validate({ body: batchTelemetryBody }), controller.ingestBatch);

  // 2. Active Boundary Breach Alerts (Screenshot 2: Alert on dashboard with status timeline O1)
  router.get('/alerts/active', controller.listActiveAlerts);

  // 3. Responder Dispatch & Acknowledgement (Screenshot 3: O4 responder dispatch & 3m ack)
  router.post(
    '/alerts/:id/respond',
    validate({ body: acknowledgeDispatchBody }),
    controller.acknowledgeDispatch,
  );

  // 4. Escalation & Manual Assignment (Screenshot 4: O2 escalation panel & candidate responders)
  router.post('/alerts/:id/escalate', controller.escalateAlert);
  router.get('/alerts/:id/candidates', controller.listCandidateResponders);
  router.post(
    '/alerts/:id/assign-responder',
    validate({ body: manualAssignBody }),
    controller.manualAssignResponder,
  );

  // 5. Camera-Trap Review (Screenshot 5: O3 camera-trap detection & review queue)
  router.post('/camera-trap', validate({ body: cameraTrapBody }), controller.handleCameraTrap);
  router.get('/camera-trap/pending', controller.listPendingCameraTraps);
  router.post(
    '/camera-trap/:id/review',
    validate({ body: cameraReviewBody }),
    controller.reviewCameraTrap,
  );

  // 6. Signal Lost & Resolution with reason (Screenshot 6: E1 signal lost & resolve)
  router.get('/devices/health', controller.checkCollarHealth);
  router.post('/devices/:id/simulate-signal-lost', controller.simulateSignalLost);
  router.post(
    '/alerts/:id/resolve',
    validate({ body: resolveAlertBody }),
    controller.resolveAlert,
  );

  // Backwards-compatible routes
  router.post(
    '/alerts/:id/acknowledge',
    validate({ body: acknowledgeAlertBody }),
    controller.acknowledgeAlert,
  );
  router.post('/alerts/:id/false-alarm', validate({ body: falseAlarmBody }), controller.markFalseAlarm);
  router.get('/alerts/audit-trail', controller.listAuditTrail);
  router.get('/zones', controller.listZones);
  router.get('/devices', controller.listCollars);

  return router;
}

module.exports = { createCollarRoutes };

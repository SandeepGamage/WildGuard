const { z } = require('zod');
const { latitude, longitude, enumOf } = require('./common');
const { RESPONSE_ACTION } = require('../constants/domain');

const telemetryReadingBody = z.object({
  collarId: z.string().min(1, 'collarId is required'),
  animalLabel: z.string().optional(),
  latitude,
  longitude,
  recordedAt: z.string().datetime().or(z.date()).optional(),
  isDelayed: z.boolean().optional(),
});

const batchTelemetryBody = z.object({
  readings: z.array(telemetryReadingBody).min(1, 'At least one reading is required in batch'),
});

const acknowledgeDispatchBody = z.object({
  responderId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const manualAssignBody = z.object({
  responderId: z.string().min(1, 'responderId is required'),
  officerId: z.string().optional(),
  officerNotes: z.string().max(1000).optional(),
});

const resolveAlertBody = z.object({
  reason: z.string().min(3, 'Resolution reason is mandatory (SE3070 Table 18 Step 10)'),
  officerId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

const cameraTrapBody = z.object({
  trapId: z.string().min(1, 'trapId is required'),
  imageUrl: z.string().optional(),
  latitude,
  longitude,
  species: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  isThreat: z.boolean().optional(),
});

const cameraReviewBody = z.object({
  officerId: z.string().optional(),
  species: z.string().optional(),
  isThreat: z.boolean(),
  notes: z.string().max(1000).optional(),
});

const acknowledgeAlertBody = z.object({
  responseAction: enumOf(RESPONSE_ACTION),
  officerId: z.string().optional(),
  officerNotes: z.string().max(1000).optional(),
  dispatchedRangerId: z.string().optional(),
});

const falseAlarmBody = z.object({
  officerId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

module.exports = {
  telemetryReadingBody,
  batchTelemetryBody,
  acknowledgeDispatchBody,
  manualAssignBody,
  resolveAlertBody,
  cameraTrapBody,
  cameraReviewBody,
  acknowledgeAlertBody,
  falseAlarmBody,
};

const { z } = require('zod');
const { uuid, latitude, longitude, enumOf } = require('./common');
const { INCIDENT_TYPES, ELEPHANT_COUNT_BANDS, OCCURRED_WHEN, PHOTO_RULES } = require('../constants/domain');

const createIncidentBody = z
  .object({
    clientRequestId: uuid,
    incidentType: enumOf(INCIDENT_TYPES),
    villageId: uuid.optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    elephantCountBand: enumOf(ELEPHANT_COUNT_BANDS).optional(),
    occurredWhen: enumOf(OCCURRED_WHEN).default(OCCURRED_WHEN.NOW),
    capturedAt: z.iso.datetime({ offset: true }).optional(),
    photoPath: z.string().min(1).max(200).optional(),
  })
  .refine((value) => value.villageId || (value.latitude !== undefined && value.longitude !== undefined), {
    message: 'Provide a village or a GPS position.',
    path: ['villageId'],
  });

const photoUploadBody = z.object({
  contentType: z.enum(Object.keys(PHOTO_RULES.ALLOWED_TYPES)),
  sizeBytes: z.number().int().min(1).max(PHOTO_RULES.MAX_BYTES),
});

module.exports = { createIncidentBody, photoUploadBody };

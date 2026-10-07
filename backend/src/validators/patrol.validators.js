const { z } = require('zod');
const { uuid, latitude, longitude, enumOf } = require('./common');
const { PATROL_STATUS, PATROL_INCIDENT_TYPES, PATROL_RULES } = require('../constants/domain');

const timestamp = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

const sessionInput = z.object({
  id: uuid,
  status: enumOf(PATROL_STATUS),
  startedAt: timestamp,
  endedAt: timestamp.optional(),
});

const trackPointInput = z.object({
  id: uuid,
  latitude,
  longitude,
  accuracyM: z.number().min(0).max(10000).optional(),
  recordedAt: timestamp,
});

const incidentInput = z.object({
  id: uuid,
  incidentType: enumOf(PATROL_INCIDENT_TYPES),
  note: z.string().trim().max(PATROL_RULES.MAX_NOTE_LENGTH).optional(),
  latitude,
  longitude,
  locationWarning: z.boolean().default(false),
  locationFixAt: timestamp.optional(),
  occurredAt: timestamp,
  photoPath: z.string().min(1).max(200).optional(),
});

const syncPatrolBody = z.object({
  session: sessionInput,
  trackPoints: z.array(trackPointInput).max(PATROL_RULES.MAX_BATCH).default([]),
  incidents: z.array(incidentInput).max(PATROL_RULES.MAX_BATCH).default([]),
});

module.exports = { syncPatrolBody };

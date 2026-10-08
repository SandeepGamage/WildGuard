import { Bone, Dog, Footprints, Skull, TriangleAlert, Cable } from 'lucide-react-native';

/** UC1 rules from the revised scenario (section 7.4.1). */
export const PATROL_RULES = Object.freeze({
  TRACK_INTERVAL_MS: 10000,
  /** A fix less accurate than this is not recorded (A4). */
  MAX_ACCURACY_M: 50,
  BATCH_SIZE: 50,
  /** Automatic retry back-off after a failed upload (E3): 30 s, 2 min, then 10 min. */
  RETRY_DELAYS_MS: Object.freeze([30000, 120000, 600000]),
  /** Below this much free space the photo is compressed (E2). */
  LOW_STORAGE_BYTES: 200 * 1024 * 1024,
  COMPRESSED_WIDTH: 800,
  COMPRESSED_QUALITY: 0.4,
  END_HOLD_MS: 1500,
  MAX_NOTE_LENGTH: 500,
});

export const PATROL_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED' });

export const SYNC_STATUS = Object.freeze({ PENDING: 'PENDING', SYNCED: 'SYNCED' });

export const PATROL_ERRORS = Object.freeze({
  ALREADY_ACTIVE: 'PATROL_ALREADY_ACTIVE',
  NO_LOCATION: 'PATROL_NO_LOCATION',
  PERMISSION: 'PATROL_PERMISSION_DENIED',
});

/** Demo assignment: until a backend assignment endpoint exists, the ranger patrols seeded Sector 3. */
export const DEMO_ASSIGNMENT = Object.freeze({
  parkName: 'Yala National Park',
  sectorName: 'Sector 3',
  intervalMs: PATROL_RULES.TRACK_INTERVAL_MS,
});

export const PATROL_INCIDENT_TYPES = Object.freeze({
  SNARE_POACHING: 'SNARE_POACHING',
  CARCASS: 'CARCASS',
  ELEPHANT_SIGHTING: 'ELEPHANT_SIGHTING',
  ILLEGAL_ACTIVITY: 'ILLEGAL_ACTIVITY',
  OTHER_ANIMAL: 'OTHER_ANIMAL',
  OTHER: 'OTHER',
});

/** Presentation metadata per patrol incident type. */
export const PATROL_INCIDENT_META = Object.freeze([
  { type: PATROL_INCIDENT_TYPES.SNARE_POACHING, labelKey: 'patrol.types.SNARE_POACHING', Icon: Cable },
  { type: PATROL_INCIDENT_TYPES.CARCASS, labelKey: 'patrol.types.CARCASS', Icon: Skull },
  { type: PATROL_INCIDENT_TYPES.ELEPHANT_SIGHTING, labelKey: 'patrol.types.ELEPHANT_SIGHTING', Icon: Footprints },
  { type: PATROL_INCIDENT_TYPES.ILLEGAL_ACTIVITY, labelKey: 'patrol.types.ILLEGAL_ACTIVITY', Icon: TriangleAlert },
  { type: PATROL_INCIDENT_TYPES.OTHER_ANIMAL, labelKey: 'patrol.types.OTHER_ANIMAL', Icon: Dog },
  { type: PATROL_INCIDENT_TYPES.OTHER, labelKey: 'patrol.types.OTHER', Icon: Bone },
]);

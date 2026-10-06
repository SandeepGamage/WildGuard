export const USER_ROLES = Object.freeze({
  VILLAGER: 'VILLAGER',
  COMMUNITY_LIAISON_OFFICER: 'COMMUNITY_LIAISON_OFFICER',
  FIELD_RANGER: 'FIELD_RANGER',
  /** Uses the separate web dashboard (web/); the phone app has no screens for this role. */
  PARK_MANAGER: 'PARK_MANAGER',
});

export const LANGUAGES = Object.freeze({ EN: 'en', SI: 'si', TA: 'ta' });

/** Native names shown in the language switcher. */
export const LANGUAGE_OPTIONS = Object.freeze([
  { code: LANGUAGES.EN, badge: 'EN', nativeName: 'English' },
  { code: LANGUAGES.SI, badge: 'SI', nativeName: 'සිංහල' },
  { code: LANGUAGES.TA, badge: 'TA', nativeName: 'தமிழ்' },
]);

export const INCIDENT_TYPES = Object.freeze({
  ELEPHANT_NEAR_VILLAGE: 'ELEPHANT_NEAR_VILLAGE',
  CROP_DAMAGE: 'CROP_DAMAGE',
  PROPERTY_DAMAGE: 'PROPERTY_DAMAGE',
  PERSON_INJURED: 'PERSON_INJURED',
  SNARE_POACHING: 'SNARE_POACHING',
  OTHER_ANIMAL: 'OTHER_ANIMAL',
});

export const URGENCY = Object.freeze({ NORMAL: 'NORMAL', URGENT: 'URGENT' });

export const INCIDENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  DUPLICATE: 'DUPLICATE',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

/** Villager-facing progress: Received -> Being checked -> Outcome. */
export const REPORT_PROGRESS = Object.freeze({
  RECEIVED: 'RECEIVED',
  BEING_CHECKED: 'BEING_CHECKED',
  OUTCOME: 'OUTCOME',
});

export const ELEPHANT_COUNT_BANDS = Object.freeze({ ONE: '1', TWO_TO_FIVE: '2_5', SIX_PLUS: '6_PLUS' });

export const OCCURRED_WHEN = Object.freeze({ NOW: 'NOW', EARLIER_TODAY: 'EARLIER_TODAY' });

export const VERIFICATION_METHODS = Object.freeze({
  CALL_REPORTER: 'CALL_REPORTER',
  SITE_VISIT: 'SITE_VISIT',
  PHOTO_REVIEW: 'PHOTO_REVIEW',
  SENSOR_DATA: 'SENSOR_DATA',
});

export const REJECTION_REASONS = Object.freeze({
  DUPLICATE_OR_RESOLVED: 'DUPLICATE_OR_RESOLVED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  INCORRECT_LOCATION: 'INCORRECT_LOCATION',
  OTHER: 'OTHER',
});

export const VERIFICATION_DECISIONS = Object.freeze({ VERIFIED: 'VERIFIED', REJECTED: 'REJECTED' });

export const MARKER_STATES = Object.freeze({
  UNVERIFIED: 'UNVERIFIED',
  ACTION_NEEDED: 'ACTION_NEEDED',
  VERIFIED: 'VERIFIED',
});

export const EMERGENCY_NUMBER = '1990';

export const PHOTO_RULES = Object.freeze({
  MAX_BYTES: 5 * 1024 * 1024,
  QUALITY: 0.6,
  MAX_DIMENSION: 1600,
});

/** Sri Lanka centre, used when no location is known yet. */
export const DEFAULT_MAP_REGION = Object.freeze({
  latitude: 6.3,
  longitude: 81.35,
  latitudeDelta: 0.25,
  longitudeDelta: 0.25,
});

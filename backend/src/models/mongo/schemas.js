const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, sparse: true, index: true },
    password_hash: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['VILLAGER', 'COMMUNITY_LIAISON_OFFICER', 'FIELD_RANGER', 'PARK_MANAGER'],
    },
    full_name: { type: String, required: true },
    is_active: { type: Boolean, default: true },
  signal_lost: { type: Boolean, default: false },
  battery_pct: { type: Number, default: 95 },
  last_heartbeat: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const ProfileSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    full_name: { type: String, required: true },
    phone: { type: String, sparse: true, index: true },
    role: { type: String, required: true },
    language: { type: String, default: 'en' },
    registered_village_id: { type: String, default: null },
    sector_id: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    division_ids: { type: [String], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const VillageSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name_en: { type: String, required: true },
    name_si: { type: String, default: null },
    name_ta: { type: String, default: null },
    aliases: { type: [String], default: [] },
    gn_division_id: { type: String, required: true, index: true },
    sector_id: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);
VillageSchema.index({ location: '2dsphere' });

const GnDivisionSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  sector_id: { type: String, required: true },
});

const SectorSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  park: { type: String, required: true },
});

const CollarDeviceSchema = new Schema({
  id: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
  last_seen_at: { type: Date, default: Date.now },
  is_active: { type: Boolean, default: true },
});
CollarDeviceSchema.index({ location: '2dsphere' });

const CommunityIncidentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    tracking_code: { type: String, required: true, index: true },
    client_request_id: { type: String, default: null },
    reporter_id: { type: String, default: null, index: true },
    reporter_phone: { type: String, default: null },
    source: { type: String, default: 'APP' },
    incident_type: { type: String, required: true, index: true },
    status: { type: String, required: true, default: 'PENDING', index: true },
    urgency: { type: String, default: 'NORMAL' },
    village_id: { type: String, default: null },
    gn_division_id: { type: String, default: null, index: true },
    sector_id: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    raw_location_text: { type: String, default: null },
    elephant_count_band: { type: String, default: null },
    occurred_when: { type: String, default: 'NOW' },
    occurred_at: { type: Date, default: Date.now, index: true },
    photo_path: { type: String, default: null },
    duplicate_of_id: { type: String, default: null, index: true },
    call_back_required: { type: Boolean, default: false },
    field_action_required: { type: Boolean, default: false },
    review_started_at: { type: Date, default: null },
    captured_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);
CommunityIncidentSchema.index({ location: '2dsphere' });
CommunityIncidentSchema.index(
  { reporter_id: 1, client_request_id: 1 },
  { unique: true, partialFilterExpression: { client_request_id: { $type: 'string' } } },
);

const VerificationRecordSchema = new Schema({
  id: { type: String, required: true, unique: true },
  incident_id: { type: String, required: true, index: true },
  officer_id: { type: String, required: true, index: true },
  decision: { type: String, required: true },
  method: { type: String, default: null },
  notes: { type: String, default: null },
  rejection_reason: { type: String, default: null },
  field_action_required: { type: Boolean, default: false },
  verified_at: { type: Date, default: Date.now, index: true },
});

const NotificationSchema = new Schema({
  id: { type: String, required: true, unique: true },
  recipient_id: { type: String, default: null, index: true },
  target_sector_id: { type: String, default: null, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  incident_id: { type: String, default: null },
  read_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now, index: true },
});

const SmsLogSchema = new Schema({
  direction: { type: String, required: true },
  phone: { type: String, required: true },
  message: { type: String, required: true },
  parsed_type: { type: String, default: null },
  parsed_location: { type: String, default: null },
  incident_id: { type: String, default: null },
  status: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

const SequenceSchema = new Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 142 },
});

/** A generated UC4 report. Stored so export can fetch it by id (SQ4-04). */
const ConservationReportSchema = new Schema({
  id: { type: String, required: true, unique: true },
  park_id: { type: String, required: true },
  created_by: { type: String, required: true, index: true },
  generated_at: { type: Date, default: Date.now, index: true },
  filter: { type: Schema.Types.Mixed, required: true },
  stats: { type: Schema.Types.Mixed, required: true },
  trends: { type: Schema.Types.Mixed, required: true },
  coverage: { type: Schema.Types.Mixed, required: true },
  heatmap: { type: Schema.Types.Mixed, default: null },
  top_hotspots: { type: [Schema.Types.Mixed], default: [] },
  landmarks: { type: [Schema.Types.Mixed], default: [] },
  /** Thinned ranger GPS positions (no ids), for the map's "where rangers have been" layer. */
  patrol_points: { type: [Schema.Types.Mixed], default: [] },
  incidents: { type: [Schema.Types.Mixed], default: [] },
});

/**
 * UC2 GeofenceZone: predefined high-risk geographic boundary buffer.
 */
const GeofenceZoneSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['FARMLAND', 'VILLAGE', 'ROAD', 'RAILWAY', 'BUFFER', 'CORE', 'SETTLEMENT_BOUNDARY', 'CORRIDOR'],
    default: 'FARMLAND',
  },
  centre_lat: { type: Number, required: true },
  centre_lng: { type: Number, required: true },
  radius_metres: { type: Number, required: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  risk_level: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], default: 'HIGH' },
  description: { type: String, default: '' },
  village_ids: { type: [String], default: [] },
  created_at: { type: Date, default: Date.now },
});

/**
 * UC2 CollarAlert: real-time geofence boundary breach or mortality alert.
 */
const CollarAlertSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    alert_reference: { type: String, required: true, index: true },
    collar_id: { type: String, required: true, index: true },
    animal_label: { type: String, default: 'Wild Elephant' },
    zone_id: { type: String, default: null },
    zone_name: { type: String, default: 'Boundary Zone' },
    threat_level: { type: String, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], default: 'CRITICAL' },
    status: {
      type: String,
      enum: ['RAISED', 'ACKNOWLEDGED', 'DISPATCHED', 'ESCALATED', 'RESOLVED', 'FALSE_ALARM', 'ACTIVE', 'OPEN', 'VILLAGE_SMS_SENT', 'DELAYED_INCIDENT'],
      default: 'RAISED',
      index: true,
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    distance_to_boundary_m: { type: Number, default: 0 },
    direction_heading: { type: Number, default: null },
    speed_kmh: { type: Number, default: 0 },
    assigned_responder_id: { type: String, default: null },
    assigned_responder_name: { type: String, default: null },
    dispatched_at: { type: Date, default: null },
    acknowledged_at: { type: Date, default: null },
    resolved_at: { type: Date, default: null },
    resolution_reason: { type: String, default: null },
    officer_notes: { type: String, default: '' },
    escalation_reason: { type: String, default: null },
    village_warning_broadcast: { type: Boolean, default: false },
    acoustic_alarm_triggered: { type: Boolean, default: false },
    timeline: {
      type: [
        {
          status: { type: String, required: true },
          timestamp: { type: Date, default: Date.now },
          details: { type: String, default: '' },
          actor: { type: String, default: 'System' },
        },
      ],
      default: [],
    },
    audit_trail: { type: [Schema.Types.Mixed], default: [] },
    raised_at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

/**
 * UC2 CameraTrapReview: sub-threshold AI camera trap detections.
 */
const CameraTrapReviewSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    camera_id: { type: String, required: true },
    location_name: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    image_url: { type: String, required: true },
    detected_species: { type: String, default: 'Elephant' },
    confidence_score: { type: Number, required: true },
    status: { type: String, enum: ['PENDING_REVIEW', 'VERIFIED_THREAT', 'DISMISSED_NOISE'], default: 'PENDING_REVIEW' },
    reviewer_officer_id: { type: String, default: null },
    reviewed_at: { type: Date, default: null },
    alert_generated_id: { type: String, default: null },
    captured_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

/**
 * UC2 CollarTelemetryLog: raw historical GPS tracking logs.
 */
const CollarTelemetryLogSchema = new Schema({
  id: { type: String, required: true, unique: true },
  collar_id: { type: String, required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  recorded_at: { type: Date, default: Date.now, index: true },
  is_delayed: { type: Boolean, default: false },
});

/** UC1 – a ranger's patrol. The id is generated on the phone so uploads are idempotent. */
const PatrolSessionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    ranger_id: { type: String, required: true, index: true },
    sector_id: { type: String, required: true, index: true },
    status: { type: String, required: true },
    started_at: { type: Date, required: true, index: true },
    ended_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

const PatrolTrackPointSchema = new Schema({
  id: { type: String, required: true, unique: true },
  patrol_id: { type: String, required: true, index: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  recorded_at: { type: Date, required: true, index: true },
});

const PatrolIncidentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    patrol_id: { type: String, required: true, index: true },
    type: { type: String, required: true },
    notes: { type: String, default: null },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    occurred_at: { type: Date, required: true, index: true },
    photo_path: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

// Guard against duplicate model compiling in watch/hot-reload
const getModel = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

module.exports = {
  User: getModel('User', UserSchema),
  Profile: getModel('Profile', ProfileSchema),
  Village: getModel('Village', VillageSchema),
  GnDivision: getModel('GnDivision', GnDivisionSchema),
  Sector: getModel('Sector', SectorSchema),
  CollarDevice: getModel('CollarDevice', CollarDeviceSchema),
  CommunityIncident: getModel('CommunityIncident', CommunityIncidentSchema),
  VerificationRecord: getModel('VerificationRecord', VerificationRecordSchema),
  Notification: getModel('Notification', NotificationSchema),
  SmsLog: getModel('SmsLog', SmsLogSchema),
  Sequence: getModel('Sequence', SequenceSchema),
  ConservationReport: getModel('ConservationReport', ConservationReportSchema),
  GeofenceZone: getModel('GeofenceZone', GeofenceZoneSchema),
  CollarAlert: getModel('CollarAlert', CollarAlertSchema),
  CameraTrapReview: getModel('CameraTrapReview', CameraTrapReviewSchema),
  CollarTelemetryLog: getModel('CollarTelemetryLog', CollarTelemetryLogSchema),
  PatrolSession: getModel('PatrolSession', PatrolSessionSchema),
  PatrolTrackPoint: getModel('PatrolTrackPoint', PatrolTrackPointSchema),
  PatrolIncident: getModel('PatrolIncident', PatrolIncidentSchema),
};

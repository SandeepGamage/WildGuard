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
      enum: ['VILLAGER', 'COMMUNITY_LIAISON_OFFICER', 'FIELD_RANGER'],
    },
    full_name: { type: String, required: true },
    is_active: { type: Boolean, default: true },
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
CommunityIncidentSchema.index({ reporter_id: 1, client_request_id: 1 }, { unique: true, sparse: true });

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
};

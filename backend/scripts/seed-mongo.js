require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const { loadConfig } = require('../src/config/env');
const { connectMongo, disconnectMongo } = require('../src/config/database');
const {
  User,
  Profile,
  Village,
  GnDivision,
  Sector,
  CollarDevice,
  CommunityIncident,
  VerificationRecord,
  Sequence,
} = require('../src/models/mongo/schemas');
const { phoneToLoginEmail } = require('../src/utils/phone');
const { createLogger } = require('../src/utils/logger');

const ID = {
  sector3: '00000000-0000-4000-8000-000000000003',
  sector4: '00000000-0000-4000-8000-000000000004',
  divPalatupana: '00000000-0000-4000-8000-0000000000a1',
  divKirinda: '00000000-0000-4000-8000-0000000000a2',
  divYodakandiya: '00000000-0000-4000-8000-0000000000a3',
  divTissa: '00000000-0000-4000-8000-0000000000a4',
  palatupana: '00000000-0000-4000-8000-0000000000b1',
  kirinda: '00000000-0000-4000-8000-0000000000b2',
  yodakandiya: '00000000-0000-4000-8000-0000000000b3',
  tissa: '00000000-0000-4000-8000-0000000000b4',
  debarawewa: '00000000-0000-4000-8000-0000000000b5',
  collar1: '00000000-0000-4000-8000-0000000000c1',
  collar2: '00000000-0000-4000-8000-0000000000c2',
};

const SECTORS = [
  { id: ID.sector3, name: 'Sector 3', park: 'Yala National Park' },
  { id: ID.sector4, name: 'Sector 4', park: 'Yala National Park' },
];

const GN_DIVISIONS = [
  { id: ID.divPalatupana, name: 'Palatupana', sector_id: ID.sector3 },
  { id: ID.divKirinda, name: 'Kirinda', sector_id: ID.sector3 },
  { id: ID.divYodakandiya, name: 'Yodakandiya', sector_id: ID.sector4 },
  { id: ID.divTissa, name: 'Tissamaharama', sector_id: ID.sector4 },
];

const VILLAGES = [
  {
    id: ID.palatupana,
    name_en: 'Palatupana',
    name_si: 'පලටුපාන',
    name_ta: null,
    aliases: ['palatupana', 'palatupaana', 'පලටුපාන'],
    gn_division_id: ID.divPalatupana,
    sector_id: ID.sector3,
    latitude: 6.2994,
    longitude: 81.3703,
    location: { type: 'Point', coordinates: [81.3703, 6.2994] },
    is_active: true,
  },
  {
    id: ID.kirinda,
    name_en: 'Kirinda',
    name_si: 'කිරින්ද',
    name_ta: null,
    aliases: ['kirinda', 'kirinde', 'කිරින්ද'],
    gn_division_id: ID.divKirinda,
    sector_id: ID.sector3,
    latitude: 6.2386,
    longitude: 81.3138,
    location: { type: 'Point', coordinates: [81.3138, 6.2386] },
    is_active: true,
  },
  {
    id: ID.yodakandiya,
    name_en: 'Yodakandiya',
    name_si: 'යෝධකණ්ඩිය',
    name_ta: null,
    aliases: ['yodakandiya', 'yodhakandiya', 'යෝධකණ්ඩිය'],
    gn_division_id: ID.divYodakandiya,
    sector_id: ID.sector4,
    latitude: 6.355,
    longitude: 81.392,
    location: { type: 'Point', coordinates: [81.392, 6.355] },
    is_active: true,
  },
  {
    id: ID.tissa,
    name_en: 'Tissamaharama',
    name_si: 'තිස්සමහාරාම',
    name_ta: null,
    aliases: ['tissamaharama', 'tissa', 'තිස්සමහාරාම'],
    gn_division_id: ID.divTissa,
    sector_id: ID.sector4,
    latitude: 6.2836,
    longitude: 81.2889,
    location: { type: 'Point', coordinates: [81.2889, 6.2836] },
    is_active: true,
  },
  {
    id: ID.debarawewa,
    name_en: 'Debarawewa',
    name_si: 'දෙබරවැව',
    name_ta: null,
    aliases: ['debarawewa', 'debarawava', 'දෙබරවැව'],
    gn_division_id: ID.divTissa,
    sector_id: ID.sector4,
    latitude: 6.308,
    longitude: 81.275,
    location: { type: 'Point', coordinates: [81.275, 6.308] },
    is_active: true,
  },
];

const COLLARS = [
  {
    id: ID.collar1,
    code: 'EL-07',
    name: 'Collared elephant EL-07',
    latitude: 6.3028,
    longitude: 81.3703,
    location: { type: 'Point', coordinates: [81.3703, 6.3028] },
    last_seen_at: new Date(),
    is_active: true,
  },
  {
    id: ID.collar2,
    code: 'EL-12',
    name: 'Collared elephant EL-12',
    latitude: 6.242,
    longitude: 81.314,
    location: { type: 'Point', coordinates: [81.314, 6.242] },
    last_seen_at: new Date(),
    is_active: true,
  },
];

const DEMO_USERS = [
  {
    key: 'nimali',
    fullName: 'Nimali Perera',
    phone: '0771234812',
    role: 'VILLAGER',
    villageId: ID.palatupana,
  },
  {
    key: 'kasun',
    fullName: 'Kasun Silva',
    phone: '0712345678',
    role: 'VILLAGER',
    villageId: ID.kirinda,
  },
  {
    key: 'saman',
    fullName: 'Saman Kumara',
    phone: '0752345678',
    role: 'VILLAGER',
    villageId: ID.yodakandiya,
  },
  {
    key: 'officer',
    fullName: 'N. Perera',
    email: 'officer.perera@wildguard.example',
    role: 'COMMUNITY_LIAISON_OFFICER',
    divisions: [ID.divPalatupana, ID.divKirinda, ID.divYodakandiya],
  },
  {
    key: 'officerTissa',
    fullName: 'A. Fernando',
    email: 'officer.fernando@wildguard.example',
    role: 'COMMUNITY_LIAISON_OFFICER',
    divisions: [ID.divTissa],
  },
  {
    key: 'ranger',
    fullName: 'R. M. Bandara',
    email: 'ranger.bandara@wildguard.example',
    role: 'FIELD_RANGER',
    sectorId: ID.sector3,
  },
];

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000);
const hoursAgo = (hours) => minutesAgo(hours * 60);
const daysAgo = (days) => hoursAgo(days * 24);

async function seedReferenceData() {
  for (const s of SECTORS) {
    await Sector.updateOne({ id: s.id }, { $set: s }, { upsert: true });
  }
  for (const gn of GN_DIVISIONS) {
    await GnDivision.updateOne({ id: gn.id }, { $set: gn }, { upsert: true });
  }
  for (const v of VILLAGES) {
    await Village.updateOne({ id: v.id }, { $set: v }, { upsert: true });
  }
  for (const c of COLLARS) {
    await CollarDevice.updateOne({ id: c.id }, { $set: c }, { upsert: true });
  }
  await Sequence.updateOne(
    { name: 'incident_tracking_code' },
    { $setOnInsert: { seq: 148 } },
    { upsert: true },
  );
}

async function ensureUser(spec, password, domain) {
  const email = spec.email || phoneToLoginEmail(spec.phone, domain);
  const passwordHash = await bcrypt.hash(password, 10);

  let user = await User.findOne({
    $or: [{ email: email.toLowerCase() }, ...(spec.phone ? [{ phone: spec.phone }] : [])],
  });

  if (!user) {
    const id = spec.id || require('node:crypto').randomUUID();
    user = await User.create({
      id,
      email: email.toLowerCase(),
      phone: spec.phone || null,
      password_hash: passwordHash,
      role: spec.role,
      full_name: spec.fullName,
      is_active: true,
    });
  } else {
    user.password_hash = passwordHash;
    user.full_name = spec.fullName;
    await user.save();
  }

  await Profile.updateOne(
    { id: user.id },
    {
      $set: {
        id: user.id,
        full_name: spec.fullName,
        phone: spec.phone || null,
        role: spec.role,
        language: 'en',
        registered_village_id: spec.villageId || null,
        sector_id: spec.sectorId || null,
        division_ids: spec.divisions || [],
        is_active: true,
      },
    },
    { upsert: true },
  );

  return { ...spec, id: user.id, email };
}

const villageCoords = (id) =>
  ({
    [ID.palatupana]: { latitude: 6.2994, longitude: 81.3703 },
    [ID.kirinda]: { latitude: 6.2386, longitude: 81.3138 },
    [ID.yodakandiya]: { latitude: 6.355, longitude: 81.392 },
    [ID.tissa]: { latitude: 6.2836, longitude: 81.2889 },
  })[id];

async function insertIncident(values) {
  let existing = await CommunityIncident.findOne({ tracking_code: values.tracking_code });
  if (existing) return existing.id;

  const id = require('node:crypto').randomUUID();
  const v = VILLAGES.find((vil) => vil.id === values.village_id);
  const doc = await CommunityIncident.create({
    id,
    source: 'APP',
    status: 'PENDING',
    urgency: 'NORMAL',
    occurred_when: 'NOW',
    gn_division_id: v?.gn_division_id || null,
    sector_id: v?.sector_id || null,
    location:
      values.longitude != null && values.latitude != null
        ? { type: 'Point', coordinates: [values.longitude, values.latitude] }
        : undefined,
    ...values,
  });
  return doc.id;
}

async function addRecord(incidentId, officerId, values) {
  const existing = await VerificationRecord.findOne({ incident_id: incidentId });
  if (existing) return;
  await VerificationRecord.create({
    id: require('node:crypto').randomUUID(),
    incident_id: incidentId,
    officer_id: officerId,
    ...values,
  });
}

async function seedIncidents(users) {
  const base = (code, villageId, extra) => ({
    tracking_code: code,
    village_id: villageId,
    ...villageCoords(villageId),
    ...extra,
  });

  await insertIncident(
    base('C-0143', ID.yodakandiya, {
      reporter_id: users.saman.id,
      incident_type: 'PERSON_INJURED',
      urgency: 'URGENT',
      occurred_at: minutesAgo(5),
      created_at: minutesAgo(5),
    }),
  );

  const elephantRoot = await insertIncident(
    base('C-0142', ID.palatupana, {
      reporter_id: users.nimali.id,
      incident_type: 'ELEPHANT_NEAR_VILLAGE',
      elephant_count_band: '2_5',
      status: 'UNDER_REVIEW',
      review_started_at: minutesAgo(3),
      occurred_at: minutesAgo(12),
      created_at: minutesAgo(12),
    }),
  );

  await insertIncident(
    base('C-0144', ID.palatupana, {
      reporter_id: users.kasun.id,
      incident_type: 'ELEPHANT_NEAR_VILLAGE',
      elephant_count_band: '2_5',
      status: 'DUPLICATE',
      duplicate_of_id: elephantRoot,
      review_started_at: minutesAgo(3),
      occurred_at: minutesAgo(8),
      created_at: minutesAgo(8),
    }),
  );

  await insertIncident(
    base('C-0145', ID.palatupana, {
      reporter_phone: '0701234567',
      source: 'SMS',
      incident_type: 'ELEPHANT_NEAR_VILLAGE',
      status: 'DUPLICATE',
      duplicate_of_id: elephantRoot,
      review_started_at: minutesAgo(3),
      occurred_at: minutesAgo(6),
      created_at: minutesAgo(6),
    }),
  );

  await insertIncident(
    base('C-0146', ID.kirinda, {
      reporter_id: users.kasun.id,
      incident_type: 'CROP_DAMAGE',
      occurred_at: minutesAgo(58),
      created_at: minutesAgo(58),
    }),
  );

  await insertIncident(
    base('C-0147', ID.palatupana, {
      reporter_phone: '0701234567',
      source: 'SMS',
      incident_type: 'SNARE_POACHING',
      call_back_required: true,
      raw_location_text: 'WEWA ROAD',
      occurred_at: minutesAgo(82),
      created_at: minutesAgo(82),
    }),
  );

  await insertIncident(
    base('C-0108', ID.yodakandiya, {
      reporter_id: users.nimali.id,
      incident_type: 'OTHER_ANIMAL',
      occurred_at: daysAgo(2),
      created_at: daysAgo(2),
    }),
  );

  await insertIncident(
    base('C-0148', ID.tissa, {
      reporter_id: users.kasun.id,
      incident_type: 'CROP_DAMAGE',
      occurred_at: minutesAgo(30),
      created_at: minutesAgo(30),
    }),
  );

  const snare = await insertIncident(
    base('C-0098', ID.palatupana, {
      reporter_phone: '0709876543',
      source: 'SMS',
      incident_type: 'SNARE_POACHING',
      status: 'VERIFIED',
      field_action_required: true,
      occurred_at: daysAgo(2),
      created_at: daysAgo(2),
    }),
  );
  await addRecord(snare, users.officer.id, {
    decision: 'VERIFIED',
    method: 'PHOTO_REVIEW',
    notes: 'Snare confirmed from photo.',
    field_action_required: true,
    verified_at: daysAgo(2),
  });

  const crop = await insertIncident(
    base('C-0119', ID.kirinda, {
      reporter_id: users.kasun.id,
      incident_type: 'CROP_DAMAGE',
      status: 'VERIFIED',
      occurred_at: daysAgo(1),
      created_at: daysAgo(1),
    }),
  );
  await addRecord(crop, users.officer.id, {
    decision: 'VERIFIED',
    method: 'CALL_REPORTER',
    notes: 'Called the farmer.',
    verified_at: hoursAgo(26),
  });

  const nimaliCrop = await insertIncident(
    base('C-0125', ID.kirinda, {
      reporter_id: users.nimali.id,
      incident_type: 'CROP_DAMAGE',
      status: 'VERIFIED',
      occurred_at: daysAgo(1),
      created_at: daysAgo(1),
    }),
  );
  await addRecord(nimaliCrop, users.officer.id, {
    decision: 'VERIFIED',
    method: 'SITE_VISIT',
    notes: 'Visited the field.',
    verified_at: hoursAgo(20),
  });

  const rejected = await insertIncident(
    base('C-0106', ID.yodakandiya, {
      reporter_id: users.saman.id,
      incident_type: 'OTHER_ANIMAL',
      status: 'REJECTED',
      occurred_at: daysAgo(1),
      created_at: daysAgo(1),
    }),
  );
  await addRecord(rejected, users.officer.id, {
    decision: 'REJECTED',
    rejection_reason: 'INSUFFICIENT_EVIDENCE',
    notes: 'No sign of an animal.',
    verified_at: hoursAgo(27),
  });
}

async function seedMongo(config, logger) {
  await connectMongo(config.mongodbUri, logger);

  logger.info('Seeding MongoDB reference data (sectors, divisions, villages, collars)...');
  await seedReferenceData();

  const password = config.demoUserPassword || 'password123';
  logger.info('Seeding MongoDB demo accounts...');
  const users = {};
  for (const spec of DEMO_USERS) {
    users[spec.key] = await ensureUser(spec, password, config.phoneLoginEmailDomain);
    logger.info(`User ready: ${spec.fullName} (${spec.role})`);
  }

  logger.info('Seeding MongoDB demo incidents & verifications...');
  await seedIncidents(users);

  logger.info('MongoDB database seeding complete!');
  return { users, password };
}

if (require.main === module) {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  seedMongo(config, logger)
    .then(({ users, password }) => {
      console.log('\n=============================================');
      console.log('WildGuard LK MongoDB Data Ready. Sign in with:');
      console.log('  Villager  : 0771234812            (Nimali Perera)');
      console.log(`  Officer   : ${users.officer.email}   (N. Perera, 3 GN divisions)`);
      console.log(`  Officer 2 : ${users.officerTissa.email}  (A. Fernando, Tissamaharama only)`);
      console.log(`  Password  : ${password}`);
      console.log('=============================================\n');
      return disconnectMongo();
    })
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedMongo, seedReferenceData };

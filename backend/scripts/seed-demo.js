/**
 * Creates the demo accounts and sample incidents for the university demonstration.
 *
 * Prerequisites: all migrations and supabase/seed.sql applied, and backend/.env
 * filled in (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_USER_PASSWORD).
 * Safe to run more than once: existing users and incidents are left alone.
 */
require('dotenv').config({ quiet: true });

const { loadConfig } = require('../src/config/env');
const { createAdminClient } = require('../src/config/supabase');
const { phoneToLoginEmail } = require('../src/utils/phone');

const config = loadConfig();
const db = createAdminClient(config);

const ID = {
  sector3: '00000000-0000-4000-8000-000000000003',
  divPalatupana: '00000000-0000-4000-8000-0000000000a1',
  divKirinda: '00000000-0000-4000-8000-0000000000a2',
  divYodakandiya: '00000000-0000-4000-8000-0000000000a3',
  divTissa: '00000000-0000-4000-8000-0000000000a4',
  palatupana: '00000000-0000-4000-8000-0000000000b1',
  kirinda: '00000000-0000-4000-8000-0000000000b2',
  yodakandiya: '00000000-0000-4000-8000-0000000000b3',
  tissa: '00000000-0000-4000-8000-0000000000b4',
};

const DEMO_USERS = [
  {
    key: 'nimali',
    fullName: 'Nimali Perera',
    phone: '0771234812',
    role: 'VILLAGER',
    villageId: ID.palatupana,
  },
  { key: 'kasun', fullName: 'Kasun Silva', phone: '0712345678', role: 'VILLAGER', villageId: ID.kirinda },
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

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();
const hoursAgo = (hours) => minutesAgo(hours * 60);
const daysAgo = (days) => hoursAgo(days * 24);

function check(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function findAuthUserByEmail(email) {
  for (let page = 1; page < 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const match = data.users.find((user) => user.email === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(spec) {
  const email = spec.email ?? phoneToLoginEmail(spec.phone, config.phoneLoginEmailDomain);
  let user = await findAuthUserByEmail(email);
  if (!user) {
    const created = await db.auth.admin.createUser({
      email,
      password: config.demoUserPassword,
      email_confirm: true,
      user_metadata: { full_name: spec.fullName },
    });
    if (created.error) throw new Error(`createUser ${email}: ${created.error.message}`);
    user = created.data.user;
  }

  check(
    await db.from('profiles').upsert({
      id: user.id,
      full_name: spec.fullName,
      phone: spec.phone ?? null,
      role: spec.role,
      language: 'en',
      registered_village_id: spec.villageId ?? null,
      sector_id: spec.sectorId ?? null,
    }),
    `profile ${spec.fullName}`,
  );

  if (spec.divisions) {
    check(
      await db
        .from('officer_gn_divisions')
        .upsert(spec.divisions.map((gn_division_id) => ({ officer_id: user.id, gn_division_id }))),
      `divisions ${spec.fullName}`,
    );
  }
  return { ...spec, id: user.id, email };
}

async function insertIncident(values) {
  const existing = check(
    await db.from('community_incidents').select('id').eq('tracking_code', values.tracking_code).maybeSingle(),
    `lookup ${values.tracking_code}`,
  );
  if (existing) return existing.id;

  const row = check(
    await db
      .from('community_incidents')
      .insert({
        source: 'APP',
        status: 'PENDING',
        urgency: 'NORMAL',
        occurred_when: 'NOW',
        ...values,
      })
      .select('id')
      .single(),
    `incident ${values.tracking_code}`,
  );
  return row.id;
}

async function addRecord(incidentId, officerId, values) {
  const existing = check(
    await db.from('verification_records').select('id').eq('incident_id', incidentId).maybeSingle(),
    'record lookup',
  );
  if (existing) return;
  check(
    await db
      .from('verification_records')
      .insert({ incident_id: incidentId, officer_id: officerId, ...values }),
    'verification record',
  );
}

const village = (id) =>
  ({
    [ID.palatupana]: { latitude: 6.2994, longitude: 81.3703 },
    [ID.kirinda]: { latitude: 6.2386, longitude: 81.3138 },
    [ID.yodakandiya]: { latitude: 6.355, longitude: 81.392 },
    [ID.tissa]: { latitude: 6.2836, longitude: 81.2889 },
  })[id];

async function seedIncidents(users) {
  const base = (code, villageId, extra) => ({
    tracking_code: code,
    village_id: villageId,
    ...village(villageId),
    ...extra,
  });

  // Queue: urgent injury, grouped elephant reports, crop damage, call-back snare, other animal.
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

  // Outside the main officer's divisions: only A. Fernando can see this one.
  await insertIncident(
    base('C-0148', ID.tissa, {
      reporter_id: users.kasun.id,
      incident_type: 'CROP_DAMAGE',
      occurred_at: minutesAgo(30),
      created_at: minutesAgo(30),
    }),
  );

  // History / map: verified with action, verified without action, rejected.
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

async function main() {
  if (!config.demoUserPassword || config.demoUserPassword.length < 8) {
    throw new Error('Set DEMO_USER_PASSWORD (at least 8 characters) in backend/.env first.');
  }

  const users = {};
  for (const spec of DEMO_USERS) {
    users[spec.key] = await ensureUser(spec);
    console.log(`user ready: ${spec.fullName} (${spec.role})`);
  }
  await seedIncidents(users);

  console.log('\nDemo data ready. Sign in with:');
  console.log('  Villager  : 0771234812            (Nimali Perera)');
  console.log(`  Officer   : ${users.officer.email}   (N. Perera, 3 GN divisions)`);
  console.log(`  Officer 2 : ${users.officerTissa.email}  (A. Fernando, Tissamaharama only)`);
  console.log('  Password  : the value of DEMO_USER_PASSWORD');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

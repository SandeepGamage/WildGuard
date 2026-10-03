const { loadConfig } = require('../../src/config/env');
const { buildServices } = require('../../src/container');
const { createApp } = require('../../src/app');
const { createLogger } = require('../../src/utils/logger');
const { createInMemoryRepositories } = require('./inMemoryRepositories');

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
  villagerA: '11111111-1111-4111-8111-111111111111',
  villagerB: '22222222-2222-4222-8222-222222222222',
  officer: '33333333-3333-4333-8333-333333333333',
  officerTissa: '44444444-4444-4444-8444-444444444444',
  officerB: '66666666-6666-4666-8666-666666666666',
  ranger: '55555555-5555-4555-8555-555555555555',
};

const TOKENS = {
  villagerA: 'token-villager-a',
  villagerB: 'token-villager-b',
  officer: 'token-officer',
  officerB: 'token-officer-b',
  officerTissa: 'token-officer-tissa',
  ranger: 'token-ranger',
  noProfile: 'token-no-profile',
};

const villages = [
  {
    id: ID.palatupana,
    nameEn: 'Palatupana',
    nameSi: 'පලටුපාන',
    aliases: ['palatupana', 'palatupaana'],
    gnDivisionId: ID.divPalatupana,
    sectorId: ID.sector3,
    latitude: 6.2994,
    longitude: 81.3703,
  },
  {
    id: ID.kirinda,
    nameEn: 'Kirinda',
    nameSi: 'කිරින්ද',
    aliases: ['kirinda'],
    gnDivisionId: ID.divKirinda,
    sectorId: ID.sector3,
    latitude: 6.2386,
    longitude: 81.3138,
  },
  {
    id: ID.yodakandiya,
    nameEn: 'Yodakandiya',
    aliases: ['yodakandiya'],
    gnDivisionId: ID.divYodakandiya,
    sectorId: ID.sector4,
    latitude: 6.355,
    longitude: 81.392,
  },
  {
    id: ID.tissa,
    nameEn: 'Tissamaharama',
    aliases: ['tissamaharama'],
    gnDivisionId: ID.divTissa,
    sectorId: ID.sector4,
    latitude: 6.2836,
    longitude: 81.2889,
  },
];

const makeProfile = (overrides) => ({
  fullName: 'Test User',
  phone: null,
  language: 'en',
  registeredVillageId: null,
  sectorId: null,
  isActive: true,
  divisionIds: [],
  ...overrides,
});

const makeProfiles = () => [
  makeProfile({
    id: ID.villagerA,
    fullName: 'Nimali Perera',
    phone: '0771234812',
    role: 'VILLAGER',
    registeredVillageId: ID.palatupana,
  }),
  makeProfile({
    id: ID.villagerB,
    fullName: 'Kasun Silva',
    phone: '0712345678',
    role: 'VILLAGER',
    registeredVillageId: ID.kirinda,
  }),
  makeProfile({
    id: ID.officer,
    fullName: 'N. Perera',
    role: 'COMMUNITY_LIAISON_OFFICER',
    divisions: [
      { id: ID.divPalatupana, name: 'Palatupana' },
      { id: ID.divKirinda, name: 'Kirinda' },
      { id: ID.divYodakandiya, name: 'Yodakandiya' },
    ],
    divisionIds: [ID.divPalatupana, ID.divKirinda, ID.divYodakandiya],
  }),
  makeProfile({
    id: ID.officerB,
    fullName: 'S. Jayasinghe',
    role: 'COMMUNITY_LIAISON_OFFICER',
    divisionIds: [ID.divPalatupana, ID.divKirinda],
  }),
  makeProfile({
    id: ID.officerTissa,
    fullName: 'A. Fernando',
    role: 'COMMUNITY_LIAISON_OFFICER',
    divisionIds: [ID.divTissa],
  }),
  makeProfile({
    id: ID.ranger,
    fullName: 'R. M. Bandara',
    role: 'FIELD_RANGER',
    sectorId: ID.sector3,
  }),
];

const collars = [{ code: 'EL-07', name: 'Collared elephant EL-07', latitude: 6.3028, longitude: 81.3703 }];

/** Maps fake bearer tokens to auth identities (stands in for Supabase Auth). */
function createFakeAuthGateway(profiles) {
  const identities = {
    [TOKENS.villagerA]: ID.villagerA,
    [TOKENS.villagerB]: ID.villagerB,
    [TOKENS.officer]: ID.officer,
    [TOKENS.officerB]: ID.officerB,
    [TOKENS.officerTissa]: ID.officerTissa,
    [TOKENS.ranger]: ID.ranger,
    [TOKENS.noProfile]: '99999999-9999-4999-8999-999999999999',
  };
  return {
    created: [],
    async verifyAccessToken(token) {
      const id = identities[token];
      return id ? { id, email: `${id}@test.example` } : null;
    },
    async createUser({ email }) {
      const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(profiles.length).padStart(12, '0')}`;
      this.created.push({ id, email });
      return { id };
    },
    async deleteUser() {},
  };
}

/**
 * Build the real Express app wired to in-memory repositories.
 * @param {{ smsSimulatorEnabled?: boolean, clock?: () => Date }} [options]
 */
function createTestApp(options = {}) {
  const profiles = makeProfiles();
  const { repositories, state } = createInMemoryRepositories({ villages, profiles, collars });
  const authGateway = createFakeAuthGateway(profiles);
  const config = {
    ...loadConfig({ NODE_ENV: 'test', SMS_SIMULATOR_ENABLED: 'true', RATE_LIMIT_MAX: '1000' }),
    ...(options.smsSimulatorEnabled === false ? { smsSimulatorEnabled: false } : {}),
  };
  const logger = createLogger('error', { silent: true });
  const services = buildServices({
    config,
    logger,
    repositories,
    authGateway,
    clock: options.clock,
    smsRetryMs: 10,
  });
  const app = createApp({ config, services, logger });
  return { app, state, services, repositories, authGateway };
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { createTestApp, bearer, ID, TOKENS };

const { createAdminClient } = require('./supabase');
const { connectMongo } = require('./database');
const { PhotoStorageRepository } = require('../repositories/photoStorage.repository');
const { MongoVillageRepository } = require('../repositories/mongo/village.mongo.repository');
const { MongoProfileRepository } = require('../repositories/mongo/profile.mongo.repository');
const { MongoIncidentRepository } = require('../repositories/mongo/incident.mongo.repository');
const { MongoVerificationRepository } = require('../repositories/mongo/verification.mongo.repository');
const { MongoNotificationRepository } = require('../repositories/mongo/notification.mongo.repository');
const { MongoSmsLogRepository } = require('../repositories/mongo/smsLog.mongo.repository');
const {
  MongoCollarRepository,
  MongoAlertDataSource,
} = require('../repositories/mongo/collar.mongo.repository');
const { MongoAuthGateway } = require('../repositories/mongo/authGateway.mongo.repository');
const { MongoAnalyticsRepository } = require('../repositories/mongo/analytics.mongo.repository');

/**
 * Creates MongoDB-backed repositories and authentication gateway.
 * Only photo storage continues using Supabase Storage.
 *
 * @param {object} deps
 * @param {object} deps.config Configuration object.
 * @param {object} deps.logger Logger instance.
 */
async function createMongoDependencies({ config, logger }) {
  await connectMongo(config.mongodbUri, logger);

  let supabaseClient = null;
  let photoStorageRepository = null;
  if (config.supabase.url && config.supabase.serviceRoleKey) {
    try {
      supabaseClient = createAdminClient(config);
      photoStorageRepository = new PhotoStorageRepository(supabaseClient, config.supabase.storageBucket);
    } catch (err) {
      logger.warn('Supabase storage client init warning', { message: err.message });
    }
  }

  const authGateway = new MongoAuthGateway({
    jwtSecret: config.jwtSecret,
    phoneLoginEmailDomain: config.phoneLoginEmailDomain,
  });

  const repositories = {
    incidentRepository: new MongoIncidentRepository(),
    profileRepository: new MongoProfileRepository(),
    villageRepository: new MongoVillageRepository(),
    verificationRepository: new MongoVerificationRepository(),
    notificationRepository: new MongoNotificationRepository(),
    smsLogRepository: new MongoSmsLogRepository(),
    collarRepository: new MongoCollarRepository(),
    analyticsRepository: new MongoAnalyticsRepository({ alertDataSource: new MongoAlertDataSource() }),
    photoStorageRepository,
  };

  return { repositories, authGateway };
}

module.exports = { createMongoDependencies };

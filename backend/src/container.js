const { CollarService } = require('./services/collar.service');
const { AuthService } = require('./services/auth.service');
const { VillageService } = require('./services/village.service');
const { LocationResolver } = require('./services/locationResolver');
const { DuplicateDetector } = require('./services/duplicateDetector');
const { PhotoService } = require('./services/photo.service');
const { NotificationService } = require('./services/notification.service');
const { IncidentService } = require('./services/incident.service');
const { OfficerService } = require('./services/officer.service');
const { MessageParser } = require('./services/sms/messageParser');
const { SmsResponseService } = require('./services/sms/smsResponse.service');
const { SmsService } = require('./services/sms/sms.service');
const { PendingSubmissionQueue } = require('./services/sms/pendingSubmissionQueue');
const { createSimulatedPushAdapter } = require('./services/push/simulatedPushAdapter');
const { GISMappingService } = require('./services/gisMapping.service');
const { AnalyticsReportService } = require('./services/analyticsReport.service');
const { AnalyticsService } = require('./services/analytics.service');
const { ExportEngine } = require('./services/export/exportEngine');
const { MapTileSource } = require('./services/export/mapTiles');
const { PatrolService } = require('./services/patrol.service');

/**
 * Wire services to repositories. Nothing here knows about Supabase: the
 * repositories (real or in-memory) are passed in, which keeps persistence
 * replaceable and tests database-free.
 *
 * @param {object} deps
 * @param {object} deps.config Parsed environment config.
 * @param {object} deps.logger
 * @param {object} deps.repositories incident, profile, village, verification, notification, smsLog, collar,
 *   photoStorage, analytics
 * @param {object} deps.authGateway
 * @param {object} [deps.pushAdapter] Defaults to the simulated (logging) adapter.
 * @param {() => Date} [deps.clock]
 * @param {number} [deps.smsRetryMs]
 */
function buildServices({ config, logger, repositories, authGateway, pushAdapter, clock, smsRetryMs }) {
  const {
    incidentRepository,
    profileRepository,
    villageRepository,
    verificationRepository,
    notificationRepository,
    smsLogRepository,
    collarRepository,
    photoStorageRepository,
    analyticsRepository,
    patrolRepository,
  } = repositories;

  const authService = new AuthService({
    authGateway,
    profileRepository,
    villageRepository,
    phoneLoginEmailDomain: config.phoneLoginEmailDomain,
  });
  const villageService = new VillageService({ villageRepository });
  const locationResolver = new LocationResolver({ villageRepository });
  const duplicateDetector = new DuplicateDetector({ incidentRepository });
  const photoService = new PhotoService({
    photoStorageRepository,
    bucket: config.supabase.storageBucket,
  });
  const notificationService = new NotificationService({
    notificationRepository,
    profileRepository,
    pushAdapter: pushAdapter ?? createSimulatedPushAdapter(logger),
  });
  const smsResponseService = new SmsResponseService({ smsLogRepository });

  const incidentService = new IncidentService({
    incidentRepository,
    verificationRepository,
    villageRepository,
    locationResolver,
    duplicateDetector,
    notificationService,
    photoService,
    logger,
    clock,
  });
  const officerService = new OfficerService({
    incidentRepository,
    verificationRepository,
    collarRepository,
    notificationService,
    smsResponseService,
    photoService,
    logger,
    clock,
  });

  const pendingQueue = new PendingSubmissionQueue({
    submit: (command) => incidentService.submit(command),
    logger,
    retryMs: smsRetryMs,
  });
  const smsService = new SmsService({
    messageParser: new MessageParser(),
    locationResolver,
    incidentService,
    smsResponseService,
    smsLogRepository,
    profileRepository,
    villageRepository,
    pendingQueue,
    logger,
  });

  // UC1 – patrol tracking and incident logging.
  const patrolService = new PatrolService({ patrolRepository, photoService });

  // UC4 – conservation analytics and hotspot mapping.
  const analyticsReportService = new AnalyticsReportService({
    analyticsRepository,
    hotspotCalculator: new GISMappingService(),
    logger,
    clock,
  });
  const analyticsService = new AnalyticsService({
    analyticsRepository,
    analyticsReportService,
    exportEngine: new ExportEngine({
      logger,
      tileSource: config.mapTileUrl ? new MapTileSource({ urlTemplate: config.mapTileUrl, logger }) : null,
    }),
    logger,
  });

  // UC2: Wildlife Collar Boundary Alerts (Hanaan / IT23594586)
  const collarService = new CollarService({
    collarRepository,
    notificationService,
    logger,
    clock,
  });

  return {
    authService,
    villageService,
    incidentService,
    officerService,
    notificationService,
    photoService,
    smsService,
    pendingQueue,
    patrolService,
    analyticsService,
    collarService,
  };
}

module.exports = { buildServices };

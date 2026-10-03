const { createClient } = require('@supabase/supabase-js');
const { IncidentRepository } = require('../repositories/incident.repository');
const { ProfileRepository } = require('../repositories/profile.repository');
const { VillageRepository } = require('../repositories/village.repository');
const { VerificationRepository } = require('../repositories/verification.repository');
const { NotificationRepository } = require('../repositories/notification.repository');
const { SmsLogRepository } = require('../repositories/smsLog.repository');
const { CollarRepository } = require('../repositories/collar.repository');
const { PhotoStorageRepository } = require('../repositories/photoStorage.repository');
const { AuthGateway } = require('../repositories/authGateway.repository');

/**
 * Create the server-side Supabase client (service role). This key must never
 * be sent to, or bundled in, the mobile app. Sessions are not persisted because
 * the backend is stateless.
 * @param {{ supabase: { url: string, serviceRoleKey: string } }} config
 */
function createAdminClient(config) {
  const { url, serviceRoleKey } = config.supabase;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

/** Build every Supabase-backed repository and the auth gateway. */
function createSupabaseDependencies(config) {
  const db = createAdminClient(config);
  return {
    authGateway: new AuthGateway(db),
    repositories: {
      incidentRepository: new IncidentRepository(db),
      profileRepository: new ProfileRepository(db),
      villageRepository: new VillageRepository(db),
      verificationRepository: new VerificationRepository(db),
      notificationRepository: new NotificationRepository(db),
      smsLogRepository: new SmsLogRepository(db),
      collarRepository: new CollarRepository(db),
      photoStorageRepository: new PhotoStorageRepository(db, config.supabase.storageBucket),
    },
  };
}

module.exports = { createAdminClient, createSupabaseDependencies };

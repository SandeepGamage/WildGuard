const { createClient } = require('@supabase/supabase-js');

/**
 * Create the server-side Supabase client (service role) strictly for photo storage.
 * All application data, authentication, and accounts are stored in MongoDB.
 *
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

module.exports = { createAdminClient };

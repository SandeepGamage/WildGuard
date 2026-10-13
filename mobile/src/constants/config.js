import Constants from 'expo-constants';

const DEV_API_PORT = 5000;
const API_PATH = '/api/v1';

/**
 * Backend base URL. An explicit EXPO_PUBLIC_API_URL always wins; otherwise, in
 * development, reuse the host the phone already reaches Metro on (the dev
 * machine's current LAN IP), so switching Wi-Fi networks needs no edit.
 */
function resolveApiUrl() {
  const explicit = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:${DEV_API_PORT}${API_PATH}` : '';
}

/**
 * Runtime configuration. Expo inlines EXPO_PUBLIC_* values at bundle time, so
 * only public values live here. Server secrets (service role key, database
 * credentials) must never be added to the mobile app.
 */
export const config = {
  apiUrl: resolveApiUrl(),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  phoneEmailDomain: process.env.EXPO_PUBLIC_PHONE_EMAIL_DOMAIN ?? 'phone.wildguard.example',
  demoMode: process.env.EXPO_PUBLIC_DEMO_MODE === 'true',
};

export const isBackendConfigured = () => Boolean(config.supabaseUrl && config.supabaseAnonKey);

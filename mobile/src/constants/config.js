/**
 * Runtime configuration. Expo inlines EXPO_PUBLIC_* values at bundle time, so
 * only public values live here. Server secrets (service role key, database
 * credentials) must never be added to the mobile app.
 */
export const config = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, ''),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  phoneEmailDomain: process.env.EXPO_PUBLIC_PHONE_EMAIL_DOMAIN ?? 'phone.wildguard.example',
  demoMode: process.env.EXPO_PUBLIC_DEMO_MODE === 'true',
};

export const isBackendConfigured = () => Boolean(config.supabaseUrl && config.supabaseAnonKey);

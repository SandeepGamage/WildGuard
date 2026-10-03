import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { config } from '../constants/config';

/**
 * Supabase client for authentication and signed photo uploads. It uses the
 * public anon key only; all data access goes through the backend API.
 * Placeholders keep the app renderable (with a clear error) before .env is filled in.
 */
export const supabase = createClient(
  config.supabaseUrl || 'http://localhost:54321',
  config.supabaseAnonKey || 'not-configured',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/** Current access token, or null when signed out. */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

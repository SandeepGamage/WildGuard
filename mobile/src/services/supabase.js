import AsyncStorage from '@react-native-async-storage/async-storage';
const { createClient } = require('@supabase/supabase-js');
import { config } from '../constants/config';

export const TOKEN_STORAGE_KEY = 'wildguard_auth_token';

/**
 * Supabase client configured strictly for photo uploads to the storage bucket.
 * All application data, authentication, and accounts are stored in MongoDB.
 */
export const supabase = createClient(
  config.supabaseUrl || 'http://localhost:54321',
  config.supabaseAnonKey || 'not-configured',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

/** Current JWT access token from AsyncStorage, or null when signed out. */
export async function getAccessToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Store the JWT token on login. */
export async function setStoredToken(token) {
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/** Clear the JWT token on logout. */
export async function clearStoredToken() {
  try {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

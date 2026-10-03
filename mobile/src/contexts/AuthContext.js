import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { getMe, registerVillager } from '../api/auth.api';
import { setUnauthorizedHandler } from '../api/client';
import { isBackendConfigured } from '../constants/config';
import i18n from '../i18n';
import { supabase } from '../services/supabase';
import { accountToLoginEmail, normalizePhone } from '../utils/phone';

export const AUTH_STATUS = Object.freeze({
  LOADING: 'loading',
  SIGNED_OUT: 'signedOut',
  SIGNED_IN: 'signedIn',
  ERROR: 'error',
});

export const AUTH_ERRORS = Object.freeze({
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
});

const SIGNED_OUT_STATE = { status: AUTH_STATUS.SIGNED_OUT, profile: null, error: null };
const ACCOUNT_REJECTED_CODES = ['PROFILE_NOT_FOUND', 'ACCOUNT_DISABLED'];

const AuthContext = createContext(null);

/**
 * Owns the Supabase session and the backend profile (role). The role always
 * comes from /auth/me, never from the device.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: AUTH_STATUS.LOADING, profile: null, error: null });

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    setState(SIGNED_OUT_STATE);
  }, [queryClient]);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await getMe();
      setState({ status: AUTH_STATUS.SIGNED_IN, profile, error: null });
    } catch (error) {
      if (ACCOUNT_REJECTED_CODES.includes(error.code)) {
        await signOut();
        return;
      }
      setState({ status: AUTH_STATUS.ERROR, profile: null, error });
    }
  }, [signOut]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) loadProfile();
      else setState(SIGNED_OUT_STATE);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setState(SIGNED_OUT_STATE);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  const signIn = useCallback(
    async (account, password) => {
      const email = accountToLoginEmail(account);
      
      // TEST ENVIRONMENT BYPASS
      if (__DEV__) {
        if (email === 'v@gmail.com' && password === '123456789') {
          setState({
            status: AUTH_STATUS.SIGNED_IN,
            profile: { id: 'demo-villager', role: 'VILLAGER', fullName: 'Demo Villager', email },
            error: null,
          });
          return;
        }
        if (email === 'o@gmail.com' && password === '123456789') {
          setState({
            status: AUTH_STATUS.SIGNED_IN,
            profile: { id: 'demo-officer', role: 'COMMUNITY_LIAISON_OFFICER', fullName: 'Demo Officer', email },
            error: null,
          });
          return;
        }
      }

      if (!isBackendConfigured())
        throw Object.assign(new Error('not configured'), { code: AUTH_ERRORS.NOT_CONFIGURED });
      
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.status === 400 || error.status === 401 || /invalid/i.test(error.message)) {
          throw Object.assign(error, { code: AUTH_ERRORS.INVALID_CREDENTIALS });
        }
        throw error;
      }
      await loadProfile();
    },
    [loadProfile],
  );

  const signUp = useCallback(
    async ({ fullName, phone, villageId, password }) => {
      if (!isBackendConfigured())
        throw Object.assign(new Error('not configured'), { code: AUTH_ERRORS.NOT_CONFIGURED });
      await registerVillager({
        fullName,
        phone: normalizePhone(phone),
        villageId,
        password,
        language: i18n.language,
        consent: true,
      });
      await signIn(phone, password);
    },
    [signIn],
  );

  const value = useMemo(
    () => ({ ...state, signIn, signUp, signOut, reload: loadProfile }),
    [state, signIn, signUp, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

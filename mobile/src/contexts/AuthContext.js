import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, registerVillager, loginUser } from '../api/auth.api';
import { setUnauthorizedHandler } from '../api/client';
import { isBackendConfigured } from '../constants/config';
import i18n from '../i18n';
import { setStoredToken, clearStoredToken, getAccessToken } from '../services/supabase';
import { normalizePhone } from '../utils/phone';

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
 * Owns the authentication session and the backend profile (role). The role always
 * comes from /auth/me, never from the device.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: AUTH_STATUS.LOADING, profile: null, error: null });

  const signOut = useCallback(async () => {
    await clearStoredToken();
    queryClient.clear();
    setState(SIGNED_OUT_STATE);
  }, [queryClient]);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await getMe();
      setState({ status: AUTH_STATUS.SIGNED_IN, profile, error: null });
    } catch (error) {
      if (ACCOUNT_REJECTED_CODES.includes(error?.code)) {
        await signOut();
        return;
      }
      setState({ status: AUTH_STATUS.ERROR, profile: null, error });
    }
  }, [signOut]);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await getAccessToken();
      if (!active) return;
      if (token) {
        await loadProfile();
      } else {
        setState(SIGNED_OUT_STATE);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadProfile]);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const signIn = useCallback(
    async (account, password) => {
      if (!isBackendConfigured()) {
        throw Object.assign(new Error('not configured'), { code: AUTH_ERRORS.NOT_CONFIGURED });
      }

      try {
        const res = await loginUser({ account, password });
        if (res?.accessToken) {
          await setStoredToken(res.accessToken);
          if (res.profile) {
            setState({ status: AUTH_STATUS.SIGNED_IN, profile: res.profile, error: null });
            return;
          }
          await loadProfile();
          return;
        }
      } catch (err) {
        if (err.status === 400 || err.status === 401 || err.code === 'INVALID_CREDENTIALS') {
          throw Object.assign(err, { code: AUTH_ERRORS.INVALID_CREDENTIALS });
        }
        throw err;
      }
      await loadProfile();
    },
    [loadProfile],
  );

  const signUp = useCallback(
    async ({ fullName, phone, villageId, password }) => {
      if (!isBackendConfigured()) {
        throw Object.assign(new Error('not configured'), { code: AUTH_ERRORS.NOT_CONFIGURED });
      }
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

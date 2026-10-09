import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, login } from '../api/auth.api';
import { ApiError, setUnauthorizedHandler } from '../api/client';
import { clearToken, getToken, setToken } from '../api/token';
import { USER_ROLES } from '../constants';

export const AUTH_STATUS = Object.freeze({
  LOADING: 'loading',
  SIGNED_OUT: 'signedOut',
  SIGNED_IN: 'signedIn',
});

const AuthContext = createContext(null);

const notManager = () => new ApiError(403, 'NOT_MANAGER', 'This dashboard is for park managers.');

/**
 * Owns the session. The role always comes from the backend (/auth/login, /auth/me);
 * only park managers are let in, and the backend enforces the same rule on every call.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState(() => ({
    status: getToken() ? AUTH_STATUS.LOADING : AUTH_STATUS.SIGNED_OUT,
    profile: null,
  }));

  const signOut = useCallback(() => {
    clearToken();
    queryClient.clear();
    setState({ status: AUTH_STATUS.SIGNED_OUT, profile: null });
  }, [queryClient]);

  // Restore a saved session on page load.
  useEffect(() => {
    if (!getToken()) return undefined;
    let active = true;
    getMe()
      .then((profile) => {
        if (!active) return;
        if (profile.role === USER_ROLES.PARK_MANAGER) {
          setState({ status: AUTH_STATUS.SIGNED_IN, profile });
        } else {
          signOut();
        }
      })
      .catch(() => active && signOut());
    return () => {
      active = false;
    };
  }, [signOut]);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  /** @throws {ApiError} INVALID_CREDENTIALS, NOT_MANAGER, NETWORK_ERROR, ... */
  const signIn = useCallback(async (account, password) => {
    const result = await login({ account, password });
    if (result.profile?.role !== USER_ROLES.PARK_MANAGER) throw notManager();
    setToken(result.accessToken);
    setState({ status: AUTH_STATUS.SIGNED_IN, profile: result.profile });
  }, []);

  const value = useMemo(() => ({ ...state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

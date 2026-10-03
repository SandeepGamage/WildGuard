import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getMe, registerVillager } from '../src/api/auth.api';
import { ApiError } from '../src/api/client';
import { AUTH_ERRORS, AUTH_STATUS, AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { supabase } from '../src/services/supabase';

jest.mock('../src/api/auth.api');
jest.mock('../src/constants/config', () => ({
  config: { phoneEmailDomain: 'phone.wildguard.example', demoMode: false, apiUrl: 'http://api.test' },
  isBackendConfigured: () => true,
}));

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

const villagerProfile = { id: 'u1', role: 'VILLAGER', fullName: 'Nimali Perera', divisionIds: [] };
const officerProfile = {
  id: 'u2',
  role: 'COMMUNITY_LIAISON_OFFICER',
  fullName: 'N. Perera',
  divisionIds: ['d1'],
};

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  });

  it('starts signed out when there is no stored session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe(AUTH_STATUS.SIGNED_OUT));
    expect(getMe).not.toHaveBeenCalled();
  });

  it('restores a stored session and loads the role from the backend', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    getMe.mockResolvedValue(officerProfile);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe(AUTH_STATUS.SIGNED_IN));
    expect(result.current.profile.role).toBe('COMMUNITY_LIAISON_OFFICER');
  });

  it('signs in with a mobile number mapped to the pseudo-email and loads the profile', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: null });
    getMe.mockResolvedValue(villagerProfile);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe(AUTH_STATUS.SIGNED_OUT));

    await act(async () => {
      await result.current.signIn('077 123 4567', 'secret-password');
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: '0771234567@phone.wildguard.example',
      password: 'secret-password',
    });
    expect(result.current.status).toBe(AUTH_STATUS.SIGNED_IN);
    expect(result.current.profile.role).toBe('VILLAGER');
  });

  it('reports invalid credentials without signing in', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('Invalid login credentials'), { status: 400 }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe(AUTH_STATUS.SIGNED_OUT));

    let failure;
    await act(async () => {
      failure = await result.current.signIn('officer@wildguard.example', 'wrong').catch((error) => error);
    });

    expect(failure.code).toBe(AUTH_ERRORS.INVALID_CREDENTIALS);
    expect(result.current.status).toBe(AUTH_STATUS.SIGNED_OUT);
  });

  it('signs the user out when the backend says the account has no profile', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    getMe.mockRejectedValue(new ApiError(403, 'PROFILE_NOT_FOUND', 'x'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe(AUTH_STATUS.SIGNED_OUT));
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('shows a retryable error state when the backend cannot be reached at startup', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    getMe.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'x'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe(AUTH_STATUS.ERROR));
    getMe.mockResolvedValue(villagerProfile);
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.status).toBe(AUTH_STATUS.SIGNED_IN);
  });

  it('registers a villager (role assigned by the server) and then signs in', async () => {
    registerVillager.mockResolvedValue({});
    supabase.auth.signInWithPassword.mockResolvedValue({ error: null });
    getMe.mockResolvedValue(villagerProfile);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe(AUTH_STATUS.SIGNED_OUT));

    await act(async () => {
      await result.current.signUp({
        fullName: 'Nimali Perera',
        phone: '077 123 4567',
        villageId: 'v1',
        password: 'long-password',
      });
    });

    const body = registerVillager.mock.calls[0][0];
    expect(body).toMatchObject({ phone: '0771234567', villageId: 'v1', consent: true });
    expect(body).not.toHaveProperty('role');
    expect(result.current.status).toBe(AUTH_STATUS.SIGNED_IN);
  });

  it('clears the session on sign out', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    getMe.mockResolvedValue(villagerProfile);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe(AUTH_STATUS.SIGNED_IN));

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(result.current.status).toBe(AUTH_STATUS.SIGNED_OUT);
    expect(result.current.profile).toBeNull();
  });
});

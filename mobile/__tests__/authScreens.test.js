import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import CreateAccountScreen from '../app/(auth)/create-account';
import LanguageScreen from '../app/(auth)/language';
import SignInScreen from '../app/(auth)/sign-in';
import WelcomeScreen from '../app/(auth)/welcome';
import Index from '../app/index';
import { AUTH_ERRORS, useAuth } from '../src/contexts/AuthContext';
import { useVillages } from '../src/hooks/useVillages';
import i18n from '../src/i18n';
import { isOnboarded } from '../src/services/onboarding';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() },
    Redirect: ({ href }) => <Text testID="redirect">{href}</Text>,
  };
});
jest.mock('../src/contexts/AuthContext', () => ({
  AUTH_STATUS: { LOADING: 'loading', SIGNED_OUT: 'signedOut', SIGNED_IN: 'signedIn', ERROR: 'error' },
  AUTH_ERRORS: { NOT_CONFIGURED: 'NOT_CONFIGURED', INVALID_CREDENTIALS: 'INVALID_CREDENTIALS' },
  useAuth: jest.fn(),
}));
jest.mock('../src/hooks/useVillages');
jest.mock('../src/constants/config', () => ({
  config: { demoMode: true, apiUrl: '', phoneEmailDomain: 'phone.wildguard.example' },
  isBackendConfigured: () => true,
}));

const type = (id, value) => fireEvent.changeText(screen.getByTestId(id), value);

describe('welcome and language', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('starts the onboarding and offers the demo SMS simulator in demo mode', () => {
    renderScreen(<WelcomeScreen />);
    expect(screen.getByText("Built for communities near Sri Lanka's protected areas")).toBeTruthy();
    fireEvent.press(screen.getByTestId('get-started'));
    expect(router.push).toHaveBeenCalledWith('/language');

    fireEvent.press(screen.getByTestId('demo-sms-link'));
    expect(router.push).toHaveBeenCalledWith('/sms-simulator');
  });

  it('lets the villager pick a language, remembers onboarding and goes to sign-in', async () => {
    renderScreen(<LanguageScreen />);
    expect(screen.getByText('Choose language')).toBeTruthy();

    fireEvent.press(screen.getByTestId('language-option-si'));
    await waitFor(() => expect(i18n.language).toBe('si'));
    fireEvent.press(screen.getByTestId('language-option-en'));
    await waitFor(() => expect(i18n.language).toBe('en'));

    fireEvent.press(screen.getByTestId('language-continue'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/sign-in'));
    expect(await isOnboarded()).toBe(true);
  });
});

describe('sign in', () => {
  let signIn;
  beforeEach(() => {
    jest.clearAllMocks();
    signIn = jest.fn();
    useAuth.mockReturnValue({ signIn });
  });

  it('validates before calling the server', async () => {
    renderScreen(<SignInScreen />);
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    expect(await screen.findByText('Enter your mobile number or email.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in with the account and password', async () => {
    signIn.mockResolvedValue();
    renderScreen(<SignInScreen />);
    type('field-account', '077 123 4567');
    type('field-password', 'secret-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('077 123 4567', 'secret-password'));
  });

  it.each([
    [AUTH_ERRORS.INVALID_CREDENTIALS, 'The account or password is not correct.'],
    [
      AUTH_ERRORS.NOT_CONFIGURED,
      'The app is not connected to the server yet. Add your Supabase details to mobile/.env.',
    ],
    ['NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.'],
  ])('shows a friendly message for %s', async (code, message) => {
    signIn.mockRejectedValue(Object.assign(new Error('raw backend message'), { code }));
    renderScreen(<SignInScreen />);
    type('field-account', 'officer@wildguard.example');
    type('field-password', 'wrong');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByText('raw backend message')).toBeNull();
  });

  it('links to account creation and the demo SMS simulator', () => {
    renderScreen(<SignInScreen />);
    fireEvent.press(screen.getByTestId('go-create-account'));
    expect(router.push).toHaveBeenCalledWith('/create-account');
    expect(screen.getByText('Staff accounts are assigned by the organization.')).toBeTruthy();
  });
});

describe('create account', () => {
  let signUp;
  beforeEach(() => {
    jest.clearAllMocks();
    signUp = jest.fn();
    useAuth.mockReturnValue({ signUp });
    useVillages.mockReturnValue({
      data: [
        { id: 'v-kirinda', nameEn: 'Kirinda', nameSi: null, nameTa: null },
        { id: 'v-palatupana', nameEn: 'Palatupana', nameSi: null, nameTa: null },
      ],
      isLoading: false,
      isError: false,
    });
  });

  it('shows every missing field and does not register', async () => {
    renderScreen(<CreateAccountScreen />);
    fireEvent.press(screen.getByTestId('create-account-submit'));

    expect(await screen.findByText('Enter your full name.')).toBeTruthy();
    expect(screen.getByText('Enter a valid mobile number, e.g. 077 123 4567.')).toBeTruthy();
    expect(screen.getByText('Choose your village.')).toBeTruthy();
    expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();
    expect(screen.getByText('Please agree to continue.')).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('registers a community reporter with the chosen village and consent', async () => {
    signUp.mockResolvedValue();
    renderScreen(<CreateAccountScreen />);

    type('field-fullName', 'Nimali Perera');
    type('field-phone', '077 123 4567');
    fireEvent.press(screen.getByTestId('village-select'));
    fireEvent.press(await screen.findByTestId('village-option-v-palatupana'));
    type('field-password', 'long-enough-password');
    fireEvent.press(screen.getByTestId('consent'));
    fireEvent.press(screen.getByTestId('create-account-submit'));

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(signUp.mock.calls[0][0]).toEqual({
      fullName: 'Nimali Perera',
      phone: '077 123 4567',
      villageId: 'v-palatupana',
      password: 'long-enough-password',
      consent: true,
    });
  });

  it('explains when the number is already registered', async () => {
    signUp.mockRejectedValue(Object.assign(new Error('x'), { code: 'PHONE_ALREADY_REGISTERED' }));
    renderScreen(<CreateAccountScreen />);
    type('field-fullName', 'Nimali Perera');
    type('field-phone', '0771234567');
    fireEvent.press(screen.getByTestId('village-select'));
    fireEvent.press(await screen.findByTestId('village-option-v-kirinda'));
    type('field-password', 'long-enough-password');
    fireEvent.press(screen.getByTestId('consent'));
    fireEvent.press(screen.getByTestId('create-account-submit'));
    expect(await screen.findByText('This mobile number is already registered. Try signing in.')).toBeTruthy();
  });
});

describe('entry route', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  const state = (value) => useAuth.mockReturnValue({ reload: jest.fn(), signOut: jest.fn(), ...value });

  it('shows the welcome flow to a first-time signed-out user', async () => {
    state({ status: 'signedOut' });
    renderScreen(<Index />);
    expect((await screen.findByTestId('redirect')).props.children).toBe('/welcome');
  });

  it('goes straight to sign-in once onboarding was completed', async () => {
    await AsyncStorage.setItem('wildguard.onboarded', 'true');
    state({ status: 'signedOut' });
    renderScreen(<Index />);
    expect((await screen.findByTestId('redirect')).props.children).toBe('/sign-in');
  });

  it.each([
    ['VILLAGER', '/home'],
    ['COMMUNITY_LIAISON_OFFICER', '/queue'],
  ])('sends a signed-in %s to their own interface', async (role, route) => {
    state({ status: 'signedIn', profile: { role } });
    renderScreen(<Index />);
    expect((await screen.findByTestId('redirect')).props.children).toBe(route);
  });

  it('does not open an interface for a role without a mobile UI and offers sign out', async () => {
    const signOut = jest.fn();
    state({ status: 'signedIn', profile: { role: 'FIELD_RANGER' }, signOut });
    renderScreen(<Index />);
    expect(await screen.findByText('You do not have access to this.')).toBeTruthy();
    fireEvent.press(screen.getByText('Sign out'));
    expect(signOut).toHaveBeenCalled();
  });

  it('points a park manager to the web dashboard', async () => {
    state({ status: 'signedIn', profile: { role: 'PARK_MANAGER' }, signOut: jest.fn() });
    renderScreen(<Index />);
    expect(await screen.findByText(/The Park Manager dashboard is a web app/)).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('offers retry when the profile could not be loaded', async () => {
    const reload = jest.fn();
    state({ status: 'error', error: { code: 'NETWORK_ERROR' }, reload });
    renderScreen(<Index />);
    expect(
      await screen.findByText('Could not reach the server. Check your connection and try again.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Try again'));
    expect(reload).toHaveBeenCalled();
  });

  it('shows a loading state while the session is restored', async () => {
    state({ status: 'loading' });
    renderScreen(<Index />);
    expect(screen.getByTestId('loading-state')).toBeTruthy();
    await act(async () => {}); // let the onboarding flag lookup settle
  });
});

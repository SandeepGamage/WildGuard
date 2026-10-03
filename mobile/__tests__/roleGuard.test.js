import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { RoleGuard } from '../src/components/navigation/RoleGuard';
import { useAuth } from '../src/contexts/AuthContext';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => {
  const { Text: RNText } = require('react-native');
  return { Redirect: ({ href }) => <RNText testID="redirect">{href}</RNText> };
});

jest.mock('../src/contexts/AuthContext', () => ({
  AUTH_STATUS: { LOADING: 'loading', SIGNED_OUT: 'signedOut', SIGNED_IN: 'signedIn', ERROR: 'error' },
  useAuth: jest.fn(),
}));

const signedIn = (role) => useAuth.mockReturnValue({ status: 'signedIn', profile: { role } });
const guard = (role) => (
  <RoleGuard role={role}>
    <Text>role content</Text>
  </RoleGuard>
);

describe('role-based navigation guard', () => {
  it('renders the interface for the matching role', () => {
    signedIn('VILLAGER');
    renderScreen(guard('VILLAGER'));
    expect(screen.getByText('role content')).toBeTruthy();
  });

  it('sends a villager away from the liaison-officer interface to their own home', () => {
    signedIn('VILLAGER');
    renderScreen(guard('COMMUNITY_LIAISON_OFFICER'));
    expect(screen.queryByText('role content')).toBeNull();
    expect(screen.getByTestId('redirect').props.children).toBe('/home');
  });

  it('sends a liaison officer away from the villager interface to the queue', () => {
    signedIn('COMMUNITY_LIAISON_OFFICER');
    renderScreen(guard('VILLAGER'));
    expect(screen.queryByText('role content')).toBeNull();
    expect(screen.getByTestId('redirect').props.children).toBe('/queue');
  });

  it('sends signed-out users to the entry route', () => {
    useAuth.mockReturnValue({ status: 'signedOut', profile: null });
    renderScreen(guard('VILLAGER'));
    expect(screen.getByTestId('redirect').props.children).toBe('/');
  });

  it('shows a loading state while the session is being restored', () => {
    useAuth.mockReturnValue({ status: 'loading', profile: null });
    renderScreen(guard('VILLAGER'));
    expect(screen.getByTestId('loading-state')).toBeTruthy();
    expect(screen.queryByText('role content')).toBeNull();
  });
});

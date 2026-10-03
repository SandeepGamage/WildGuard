import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';
import MapScreen from '../app/(liaison)/map';
import { IncidentMap } from '../src/components/maps/IncidentMap';
import { MapLegend } from '../src/components/maps/MapLegend';
import { MARKER_STYLE } from '../src/components/maps/markerStyle';
import { AppTabBar } from '../src/components/navigation/AppTabBar';
import { MARKER_STATES } from '../src/constants/domain';
import { useOfficerMap } from '../src/hooks/useOfficerData';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() },
}));
jest.mock('../src/hooks/useOfficerData');

const village = { id: 'v1', nameEn: 'Palatupana', nameSi: null, nameTa: null };
const marker = (overrides) => ({
  id: 'm1',
  trackingCode: 'C-0142',
  incidentType: 'ELEPHANT_NEAR_VILLAGE',
  markerState: MARKER_STATES.UNVERIFIED,
  status: 'PENDING',
  groupedCount: 1,
  latitude: 6.3,
  longitude: 81.37,
  village,
  createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
  verifiedAt: null,
  ...overrides,
});

describe('bottom navigation', () => {
  const routes = [
    { key: 'a', name: 'queue' },
    { key: 'b', name: 'map' },
    { key: 'c', name: 'history' },
    { key: 'd', name: 'profile' },
    { key: 'e', name: 'hidden' },
  ];
  const descriptors = Object.fromEntries(
    routes.map((route) => [
      route.key,
      {
        options: {
          title: route.name === 'queue' ? 'Queue' : route.name[0].toUpperCase() + route.name.slice(1),
          href: route.name === 'hidden' ? null : undefined,
          tabBarIcon: () => <Text>icon-{route.name}</Text>,
        },
      },
    ]),
  );

  it('shows the four destinations, marks the active one and hides href:null routes', () => {
    const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
    renderScreen(
      <AppTabBar state={{ index: 0, routes }} descriptors={descriptors} navigation={navigation} />,
    );

    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByTestId('tab-queue').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('tab-map').props.accessibilityState.selected).toBe(false);
    expect(screen.queryByTestId('tab-hidden')).toBeNull();
  });

  it('navigates when another tab is pressed', () => {
    const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
    renderScreen(
      <AppTabBar state={{ index: 0, routes }} descriptors={descriptors} navigation={navigation} />,
    );

    fireEvent.press(screen.getByTestId('tab-history'));
    expect(navigation.navigate).toHaveBeenCalledWith('history', undefined);
  });
});

describe('live map markers', () => {
  it('gives every state its own colour, glyph and text label (not colour alone)', () => {
    const states = Object.values(MARKER_STATES);
    expect(new Set(states.map((state) => MARKER_STYLE[state].color)).size).toBe(3);
    expect(new Set(states.map((state) => MARKER_STYLE[state].Icon)).size).toBe(3);
    expect(new Set(states.map((state) => MARKER_STYLE[state].labelKey)).size).toBe(3);
  });

  it('uses grey for unverified, amber for action needed and green for verified', () => {
    expect(MARKER_STYLE.UNVERIFIED.color).toBe('#7B8985');
    expect(MARKER_STYLE.ACTION_NEEDED.color).toBe('#FFBA00');
    expect(MARKER_STYLE.VERIFIED.color).toBe('#3E8E5E');
  });

  it('shows a legend with the three labelled states', () => {
    renderScreen(<MapLegend />);
    expect(screen.getByText('Unverified')).toBeTruthy();
    expect(screen.getByText('Action')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it('shows a count on grouped duplicate reports', () => {
    renderScreen(
      <IncidentMap markers={[marker({ groupedCount: 3 })]} selectedId={null} onSelect={jest.fn()} />,
    );
    expect(screen.getByText('3')).toBeTruthy();
  });
});

describe('officer map screen', () => {
  beforeEach(() => jest.clearAllMocks());
  const ready = (data) =>
    useOfficerMap.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: jest.fn(),
    });

  it('shows the selected report with its status and opens the incident', () => {
    ready([
      marker({
        markerState: MARKER_STATES.ACTION_NEEDED,
        status: 'VERIFIED',
        verifiedAt: new Date(Date.now() - 8 * 60000).toISOString(),
      }),
    ]);
    renderScreen(<MapScreen />);

    expect(screen.getByText('Community map')).toBeTruthy();
    expect(screen.getByText('C-0142 · Elephant near village')).toBeTruthy();
    expect(screen.getByText('ACTION')).toBeTruthy();
    expect(screen.getByText('Palatupana · verified 8 mins ago')).toBeTruthy();

    fireEvent.press(screen.getByTestId('open-incident'));
    expect(router.push).toHaveBeenCalledWith('/queue/m1');
  });

  it('labels a grey marker as unverified', () => {
    ready([marker()]);
    renderScreen(<MapScreen />);
    expect(screen.getByText('UNVERIFIED')).toBeTruthy();
    expect(screen.getByText('Palatupana · reported 12 mins ago')).toBeTruthy();
  });

  it('shows the empty state when no report is active', () => {
    ready([]);
    renderScreen(<MapScreen />);
    expect(screen.getByText('No active reports on the map.')).toBeTruthy();
  });
});

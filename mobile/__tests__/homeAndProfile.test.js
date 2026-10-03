import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import ProfileScreen from '../app/(liaison)/profile';
import HomeScreen from '../app/(villager)/home';
import { ApiError } from '../src/api/client';
import { useAuth } from '../src/contexts/AuthContext';
import { useMyReports } from '../src/hooks/useMyReports';
import { usePendingReports } from '../src/hooks/usePendingReports';
import i18n from '../src/i18n';
import { reportSync } from '../src/services/reportSync';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() },
}));
jest.mock('../src/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../src/hooks/useMyReports');
jest.mock('../src/hooks/usePendingReports');
jest.mock('../src/services/reportSync', () => ({ reportSync: { discard: jest.fn() } }));

const village = { id: 'v1', nameEn: 'Palatupana', nameSi: null, nameTa: null };

describe('villager home', () => {
  const arrange = ({ reports = [], pending = [], isError = false, isLoading = false } = {}) => {
    useAuth.mockReturnValue({ profile: { id: 'u1', fullName: 'Nimali Perera' } });
    useMyReports.mockReturnValue({
      data: reports,
      isLoading,
      isError,
      isRefetching: false,
      error: new ApiError(0, 'NETWORK_ERROR', 'x'),
      refetch: jest.fn(),
    });
    usePendingReports.mockReturnValue({ data: pending });
    return renderScreen(<HomeScreen />);
  };

  beforeEach(() => jest.clearAllMocks());

  it('greets the villager by first name and offers "Report now" and the injury advice', () => {
    arrange();
    expect(screen.getByText('Nimali')).toBeTruthy();
    expect(screen.getByText('See wildlife near your home?')).toBeTruthy();
    expect(screen.getByText('Someone injured?')).toBeTruthy();
    expect(screen.getByText('Call 1990 first, then submit the report.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('report-now'));
    expect(router.navigate).toHaveBeenCalledWith('/report');
  });

  it('shows the most recent report and opens its status', () => {
    arrange({
      reports: [
        {
          id: 'r-1',
          trackingCode: 'C-0142',
          incidentType: 'ELEPHANT_NEAR_VILLAGE',
          progress: 'BEING_CHECKED',
          village,
          occurredAt: new Date().toISOString(),
        },
      ],
    });
    expect(screen.getByText('Recent report')).toBeTruthy();
    expect(screen.getByText('Being checked')).toBeTruthy();
    fireEvent.press(screen.getByTestId('report-card-C-0142'));
    expect(router.push).toHaveBeenCalledWith('/my-reports/r-1');
  });

  it('says so when there are no reports', () => {
    arrange();
    expect(screen.getByText("You haven't submitted any reports yet.")).toBeTruthy();
  });

  it('shows reports still waiting on the phone and lets a rejected one be removed', () => {
    arrange({
      pending: [
        {
          clientRequestId: 'q-1',
          status: 'FAILED',
          payload: { incidentType: 'CROP_DAMAGE' },
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(screen.getByText('Not sent')).toBeTruthy();
    fireEvent.press(screen.getByText('Remove'));
    expect(reportSync.discard).toHaveBeenCalledWith('q-1');
  });

  it('shows a friendly error with retry when reports cannot be loaded', () => {
    arrange({ isError: true });
    expect(screen.getByText('Could not reach the server. Check your connection and try again.')).toBeTruthy();
  });
});

describe('liaison officer profile', () => {
  const signOut = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      signOut,
      profile: {
        fullName: 'N. Perera',
        divisionIds: ['a', 'b', 'c'],
        divisions: [
          { id: 'a', name: 'Palatupana' },
          { id: 'b', name: 'Kirinda' },
          { id: 'c', name: 'Yodakandiya' },
        ],
      },
    });
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('shows the officer and the assigned GN divisions', () => {
    renderScreen(<ProfileScreen />);
    expect(screen.getByText('N. Perera')).toBeTruthy();
    expect(screen.getByText('Palatupana · Kirinda · Yodakandiya')).toBeTruthy();
    expect(screen.getByText('3 GN divisions')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('opens guidance that includes the 1990 reminder', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderScreen(<ProfileScreen />);
    fireEvent.press(screen.getByText('Help and guidance'));
    expect(alert.mock.calls[0][1]).toContain('1990');
  });

  it('signs out', () => {
    renderScreen(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('sign-out'));
    expect(signOut).toHaveBeenCalled();
  });
});

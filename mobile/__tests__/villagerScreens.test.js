import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import MyReportsScreen from '../app/(villager)/my-reports/index';
import SafetyScreen from '../app/(villager)/safety';
import SmsSimulatorScreen from '../app/(demo)/sms-simulator';
import { ApiError } from '../src/api/client';
import { simulateSms } from '../src/api/sms.api';
import { useAuth } from '../src/contexts/AuthContext';
import { useMyReports } from '../src/hooks/useMyReports';
import { usePendingReports } from '../src/hooks/usePendingReports';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() },
}));
jest.mock('../src/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../src/hooks/useMyReports');
jest.mock('../src/hooks/usePendingReports');
jest.mock('../src/api/sms.api');

const village = { id: 'v1', nameEn: 'Palatupana', nameSi: null, nameTa: null };
const report = (overrides) => ({
  id: 'r-1',
  trackingCode: 'C-0142',
  incidentType: 'ELEPHANT_NEAR_VILLAGE',
  progress: 'BEING_CHECKED',
  outcome: null,
  village,
  occurredAt: new Date().toISOString(),
  ...overrides,
});

function arrange({ reports, pending = [], isError = false, isLoading = false }) {
  useAuth.mockReturnValue({ profile: { id: 'u1' } });
  useMyReports.mockReturnValue({
    data: reports,
    isLoading,
    isError,
    isRefetching: false,
    error: new ApiError(0, 'NETWORK_ERROR', 'x'),
    refetch: jest.fn(),
  });
  usePendingReports.mockReturnValue({ data: pending });
  return renderScreen(<MyReportsScreen />);
}

describe('My Reports', () => {
  beforeEach(() => jest.clearAllMocks());

  it("lists the villager's reports with honest status pills and references", () => {
    arrange({
      reports: [
        report(),
        report({
          id: 'r-2',
          trackingCode: 'C-0125',
          incidentType: 'CROP_DAMAGE',
          progress: 'OUTCOME',
          outcome: { decision: 'VERIFIED' },
        }),
        report({ id: 'r-3', trackingCode: 'C-0108', incidentType: 'OTHER_ANIMAL', progress: 'RECEIVED' }),
      ],
    });

    expect(screen.getByText('Track what happens after you report.')).toBeTruthy();
    expect(screen.getByText('Being checked')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
    expect(screen.getByText('Reference C-0142')).toBeTruthy();
    expect(screen.getAllByText('View details')).toHaveLength(3);
  });

  it('opens a report', () => {
    arrange({ reports: [report()] });
    fireEvent.press(screen.getByTestId('report-card-C-0142'));
    expect(router.push).toHaveBeenCalledWith('/my-reports/r-1');
  });

  it('shows the empty state', () => {
    arrange({ reports: [] });
    expect(screen.getByText("You haven't submitted any reports yet.")).toBeTruthy();
  });

  it('shows reports saved on the phone while they wait to be sent', () => {
    arrange({
      reports: [],
      pending: [
        {
          clientRequestId: 'q-1',
          status: 'QUEUED',
          payload: { incidentType: 'CROP_DAMAGE' },
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(screen.getByText('Waiting to send')).toBeTruthy();
    expect(screen.queryByText("You haven't submitted any reports yet.")).toBeNull();
  });

  it('shows a friendly error with retry', () => {
    arrange({ reports: undefined, isError: true });
    expect(screen.getByText('Could not reach the server. Check your connection and try again.')).toBeTruthy();
  });

  it('shows a loading state', () => {
    arrange({ reports: undefined, isLoading: true });
    expect(screen.getByTestId('loading-state')).toBeTruthy();
  });
});

describe('SMS simulator (Flow 4, demo only)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the acknowledgement and tracking code for a valid SMS', async () => {
    simulateSms.mockResolvedValue({
      accepted: true,
      reply: 'Report C-0142 received. An officer will check it. Stay away from the elephant.',
      trackingCode: 'C-0142',
      duplicate: false,
      callBackRequired: false,
      queued: false,
    });
    renderScreen(<SmsSimulatorScreen />);

    fireEvent.press(screen.getByTestId('example-ALIYA PALATUPANA'));
    fireEvent.press(screen.getByTestId('send-sms'));

    expect(await screen.findByTestId('sms-result')).toBeTruthy();
    expect(simulateSms).toHaveBeenCalledWith({ phone: '0701112233', message: 'ALIYA PALATUPANA' });
    expect(screen.getByText('Report accepted')).toBeTruthy();
    expect(screen.getByTestId('sms-reply').props.children).toContain('Report C-0142 received');
    expect(screen.getByText('Tracking code: C-0142')).toBeTruthy();
  });

  it('shows the format help for an invalid SMS', async () => {
    simulateSms.mockResolvedValue({
      accepted: false,
      reply: 'Send: ALIYA <village>  e.g. ALIYA PALATUPANA',
      trackingCode: null,
    });
    renderScreen(<SmsSimulatorScreen />);

    fireEvent.press(screen.getByTestId('example-HELLO'));
    fireEvent.press(screen.getByTestId('send-sms'));

    expect(await screen.findByText('No report created')).toBeTruthy();
    expect(screen.getByTestId('sms-reply').props.children).toContain('Send: ALIYA <village>');
  });

  it('requires some SMS text before sending', async () => {
    renderScreen(<SmsSimulatorScreen />);
    fireEvent.press(screen.getByTestId('send-sms'));
    expect(await screen.findByText('Enter the SMS text.')).toBeTruthy();
    expect(simulateSms).not.toHaveBeenCalled();
  });

  it('explains when the simulator is switched off on the server', async () => {
    simulateSms.mockRejectedValue(new ApiError(404, 'ROUTE_NOT_FOUND', 'x'));
    renderScreen(<SmsSimulatorScreen />);
    fireEvent.press(screen.getByTestId('example-ALIYA PALATUPANA'));
    fireEvent.press(screen.getByTestId('send-sms'));
    expect(await screen.findByText('The SMS simulator is switched off on the server.')).toBeTruthy();
  });
});

describe('Safety tips', () => {
  it('shows the guidance, a call button and a way to sign out', () => {
    const signOut = jest.fn();
    useAuth.mockReturnValue({ profile: { id: 'u1' }, signOut });
    renderScreen(<SafetyScreen />);

    expect(screen.getByText('Safety tips')).toBeTruthy();
    expect(screen.getByText('Elephant nearby?')).toBeTruthy();
    expect(screen.getByText('Move to a safe place')).toBeTruthy();
    expect(screen.getByText('Call 1990 if injured')).toBeTruthy();

    fireEvent.press(screen.getByTestId('villager-sign-out'));
    expect(signOut).toHaveBeenCalled();
  });
});

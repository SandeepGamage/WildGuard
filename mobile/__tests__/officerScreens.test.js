import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import RejectScreen from '../app/(liaison)/queue/[id]/reject';
import VerifyScreen from '../app/(liaison)/queue/[id]/verify';
import QueueScreen from '../app/(liaison)/queue/index';
import { OfficerQueueCard, queuePill } from '../src/components/reports/OfficerQueueCard';
import { ApiError } from '../src/api/client';
import { useRejectIncident, useVerifyIncident } from '../src/hooks/useOfficerActions';
import { useOfficerIncident, useOfficerQueue } from '../src/hooks/useOfficerData';
import i18n from '../src/i18n';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
  },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('../src/hooks/useOfficerActions');
jest.mock('../src/hooks/useOfficerData');

const t = i18n.t.bind(i18n);
const village = { id: 'v1', nameEn: 'Palatupana', nameSi: null, nameTa: null };
const NOW = Date.now();
const ago = (minutes) => new Date(NOW - minutes * 60000).toISOString();

const item = (overrides) => ({
  id: 'i-1',
  trackingCode: 'C-0142',
  incidentType: 'ELEPHANT_NEAR_VILLAGE',
  urgency: 'NORMAL',
  status: 'PENDING',
  groupedCount: 1,
  callBackRequired: false,
  village,
  createdAt: ago(12),
  occurredAt: ago(12),
  ...overrides,
});

describe('verification queue (Flow 5)', () => {
  beforeEach(() => jest.clearAllMocks());

  const queueData = {
    items: [
      item({
        id: 'urgent',
        trackingCode: 'C-0150',
        incidentType: 'PERSON_INJURED',
        urgency: 'URGENT',
        createdAt: ago(5),
      }),
      item({ id: 'group', trackingCode: 'C-0142', groupedCount: 3 }),
      item({ id: 'crop', trackingCode: 'C-0146', incidentType: 'CROP_DAMAGE', createdAt: ago(58) }),
      item({
        id: 'snare',
        trackingCode: 'C-0147',
        incidentType: 'SNARE_POACHING',
        callBackRequired: true,
        createdAt: ago(82),
      }),
    ],
    counts: { pending: 4, urgent: 1, verified: 27 },
  };
  const ready = (data = queueData) =>
    useOfficerQueue.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: jest.fn(),
    });

  it('lists reports with urgent first, a grouped count and a call-back flag', () => {
    ready();
    renderScreen(<QueueScreen />);

    expect(screen.getByText('Verification queue')).toBeTruthy();
    expect(screen.getByText('Pending 4')).toBeTruthy();
    expect(screen.getByText('Urgent 1')).toBeTruthy();
    expect(screen.getByText('Verified 27')).toBeTruthy();
    expect(screen.getByText('URGENT')).toBeTruthy();
    expect(screen.getByText('3 REPORTS')).toBeTruthy();
    expect(screen.getByText('Grouped duplicate reports')).toBeTruthy();
    expect(screen.getByText('CALL BACK')).toBeTruthy();
    expect(screen.getByText('Place not recognized automatically')).toBeTruthy();

    const order = screen.getAllByTestId(/queue-item-/).map((node) => node.props.testID);
    expect(order[0]).toBe('queue-item-C-0150');
  });

  it('filters to urgent reports', () => {
    ready();
    renderScreen(<QueueScreen />);
    fireEvent.press(screen.getByTestId('filter-urgent'));
    expect(screen.getAllByTestId(/queue-item-/)).toHaveLength(1);
  });

  it('opens a report from the queue', () => {
    ready();
    renderScreen(<QueueScreen />);
    fireEvent.press(screen.getByTestId('queue-item-C-0142'));
    expect(router.push).toHaveBeenCalledWith('/queue/group');
  });

  it('shows the empty state', () => {
    ready({ items: [], counts: { pending: 0, urgent: 0, verified: 0 } });
    renderScreen(<QueueScreen />);
    expect(screen.getByText('No pending reports.')).toBeTruthy();
  });

  it('shows a friendly error with retry instead of the raw backend message', () => {
    const refetch = jest.fn();
    useOfficerQueue.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isSuccess: false,
      error: new ApiError(0, 'NETWORK_ERROR', 'TypeError: Network request failed'),
      refetch,
    });
    renderScreen(<QueueScreen />);
    expect(screen.getByText('Could not reach the server. Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByText(/TypeError/)).toBeNull();
    fireEvent.press(screen.getByText('Try again'));
    expect(refetch).toHaveBeenCalled();
  });

  it('picks the pill in the order urgent > call back > grouped > in review > pending', () => {
    expect(queuePill(item({ urgency: 'URGENT', callBackRequired: true, groupedCount: 2 }), t).label).toBe(
      'Urgent',
    );
    expect(queuePill(item({ callBackRequired: true, groupedCount: 2 }), t).label).toBe('Call back');
    expect(queuePill(item({ groupedCount: 2 }), t).label).toBe('2 reports');
    expect(queuePill(item({ status: 'UNDER_REVIEW' }), t).label).toBe('In review');
    expect(queuePill(item(), t).label).toBe('Pending');
  });

  it('renders a card for a single plain report', () => {
    renderScreen(<OfficerQueueCard item={item()} onOpen={jest.fn()} />);
    expect(screen.getByText('PENDING')).toBeTruthy();
    expect(screen.queryByText('Grouped duplicate reports')).toBeNull();
  });
});

describe('verifying a report (Flow 6)', () => {
  let mutateAsync;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useLocalSearchParams.mockReturnValue({ id: 'i-1', method: 'SENSOR_DATA' });
    useOfficerIncident.mockReturnValue({ data: { sectorName: 'Sector 3' } });
    mutateAsync = jest.fn();
    useVerifyIncident.mockReturnValue({ mutateAsync, isPending: false });
  });

  it('shows the decision, notes, field-action toggle and the resulting marker colour', () => {
    renderScreen(<VerifyScreen />);
    expect(screen.getByText('Verify report')).toBeTruthy();
    expect(screen.getByText('Report matches available evidence.')).toBeTruthy();
    expect(screen.getByText('Notify Sector 3 rangers')).toBeTruthy();
    expect(screen.getByText('Map marker becomes green')).toBeTruthy();
    expect(screen.getByText('Save decision')).toBeTruthy();
  });

  it('switches to the action-needed marker and the "notify team" button when field action is on', () => {
    renderScreen(<VerifyScreen />);
    fireEvent(screen.getByTestId('field-action-switch'), 'valueChange', true);
    expect(screen.getByText('Map marker becomes orange')).toBeTruthy();
    expect(screen.getByText('Verified · action needed')).toBeTruthy();
    expect(screen.getByText('Save and notify team')).toBeTruthy();
  });

  it('records the method chosen on the previous screen, the notes and the field action', async () => {
    mutateAsync.mockResolvedValue({ fieldActionRequired: true, fieldTeamNotified: true });
    renderScreen(<VerifyScreen />);

    fireEvent.changeText(screen.getByTestId('verify-notes'), 'Called the reporter and checked collar data.');
    fireEvent(screen.getByTestId('field-action-switch'), 'valueChange', true);
    fireEvent.press(screen.getByTestId('save-verification'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toEqual({
      method: 'SENSOR_DATA',
      notes: 'Called the reporter and checked collar data.',
      fieldActionRequired: true,
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Verified',
      'Report verified and the field team was notified.',
      expect.any(Array),
    );
  });

  it('is honest when the field-team notification could not be sent', async () => {
    mutateAsync.mockResolvedValue({ fieldActionRequired: true, fieldTeamNotified: false });
    renderScreen(<VerifyScreen />);
    fireEvent(screen.getByTestId('field-action-switch'), 'valueChange', true);
    fireEvent.press(screen.getByTestId('save-verification'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(Alert.alert.mock.calls[0][1]).toMatch(/could not be sent/);
  });

  it('shows who already verified the report when another officer got there first (409)', async () => {
    mutateAsync.mockRejectedValue(
      new ApiError(409, 'INCIDENT_ALREADY_REVIEWED', 'reviewed', {
        status: 'VERIFIED',
        reviewedByName: 'S. Jayasinghe',
      }),
    );
    renderScreen(<VerifyScreen />);
    fireEvent.press(screen.getByTestId('save-verification'));

    expect(await screen.findByTestId('conflict-card')).toBeTruthy();
    expect(screen.getByText('S. Jayasinghe marked this report verified.')).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shows a friendly message for any other failure', async () => {
    mutateAsync.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Network request failed'));
    renderScreen(<VerifyScreen />);
    fireEvent.press(screen.getByTestId('save-verification'));
    expect(
      await screen.findByText('Could not reach the server. Check your connection and try again.'),
    ).toBeTruthy();
  });
});

describe('rejecting a report', () => {
  let mutateAsync;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    useLocalSearchParams.mockReturnValue({ id: 'i-1' });
    mutateAsync = jest.fn();
    useRejectIncident.mockReturnValue({ mutateAsync, isPending: false });
  });

  it('explains that the report stays in history and lists the four reasons', () => {
    renderScreen(<RejectScreen />);
    expect(
      screen.getByText('Rejecting removes the marker from the live map but keeps the report in history.'),
    ).toBeTruthy();
    for (const reason of [
      'Duplicate / already resolved',
      'Insufficient evidence',
      'Incorrect location',
      'Other',
    ]) {
      expect(screen.getByLabelText(reason)).toBeTruthy();
    }
  });

  it('requires a reason: a one-tap reject is not possible', async () => {
    renderScreen(<RejectScreen />);
    fireEvent.press(screen.getByTestId('submit-reject'));

    expect(await screen.findByTestId('reason-error')).toBeTruthy();
    expect(screen.getByText('Choose a reason to continue.')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('sends the reason and the optional note', async () => {
    mutateAsync.mockResolvedValue({ status: 'REJECTED' });
    renderScreen(<RejectScreen />);

    fireEvent.press(screen.getByTestId('reason-INSUFFICIENT_EVIDENCE'));
    fireEvent.changeText(screen.getByTestId('reject-notes'), 'Could not reach the reporter.');
    fireEvent.press(screen.getByTestId('submit-reject'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0]).toEqual({
      reason: 'INSUFFICIENT_EVIDENCE',
      notes: 'Could not reach the reporter.',
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Reject report',
      'Report rejected. The reporter has been informed.',
      expect.any(Array),
    );
  });

  it('shows the conflict when the report was already reviewed', async () => {
    mutateAsync.mockRejectedValue(
      new ApiError(409, 'INCIDENT_ALREADY_REVIEWED', 'x', { status: 'REJECTED', reviewedByName: null }),
    );
    renderScreen(<RejectScreen />);
    fireEvent.press(screen.getByTestId('reason-OTHER'));
    fireEvent.press(screen.getByTestId('submit-reject'));

    expect(await screen.findByText('This report was marked rejected.')).toBeTruthy();
  });
});

import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ConfirmationScreen from '../app/(villager)/my-reports/confirmation';
import { ConfirmationTracker } from '../src/components/reports/ConfirmationTracker';
import { PendingReportCard } from '../src/components/reports/PendingReportCard';
import { progressBadge } from '../src/components/reports/progressBadge';
import i18n from '../src/i18n';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

const FORBIDDEN_PROMISES = /dispatch|on the way|authorities|emergency team|rangers? (have|has) been/i;
const t = i18n.t.bind(i18n);

describe('honest confirmation (Flow 3)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the reference number and the Received -> Being checked -> Outcome tracker', () => {
    useLocalSearchParams.mockReturnValue({ code: 'C-0142', id: 'incident-1' });
    renderScreen(<ConfirmationScreen />);

    expect(screen.getByText('Report received')).toBeTruthy();
    expect(screen.getByText('Reference C-0142')).toBeTruthy();
    expect(screen.getByText('What happens next')).toBeTruthy();
    expect(screen.getByText('Received')).toBeTruthy();
    expect(screen.getByText('Being checked')).toBeTruthy();
    expect(screen.getByText('Outcome')).toBeTruthy();
    expect(screen.getByText('An officer will check this report.')).toBeTruthy();
    expect(screen.getByText('Field action is only shown after verification.')).toBeTruthy();
  });

  it('never claims that anyone was dispatched or notified before verification', () => {
    useLocalSearchParams.mockReturnValue({ code: 'C-0142', id: 'incident-1' });
    renderScreen(<ConfirmationScreen />);
    const text = JSON.stringify(screen.toJSON());
    expect(text).not.toMatch(FORBIDDEN_PROMISES);
  });

  it('ticks only the "Received" step right after sending', () => {
    useLocalSearchParams.mockReturnValue({ code: 'C-0142', id: 'incident-1' });
    renderScreen(<ConfirmationScreen />);
    expect(screen.getAllByLabelText('Done')).toHaveLength(1);
    expect(screen.getAllByLabelText('Not yet')).toHaveLength(2);
  });

  it('says "Saved safely" with no reference when the report is only queued on the phone', () => {
    useLocalSearchParams.mockReturnValue({ queued: '1' });
    renderScreen(<ConfirmationScreen />);

    expect(screen.getByText('Saved safely')).toBeTruthy();
    expect(screen.getByText("We'll retry automatically. You do not need to send it again.")).toBeTruthy();
    expect(screen.queryByTestId('tracking-code')).toBeNull();
    expect(screen.queryByTestId('confirmation-tracker')).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(FORBIDDEN_PROMISES);
  });

  it('offers to view reports or report something else', () => {
    useLocalSearchParams.mockReturnValue({ code: 'C-0142', id: 'incident-1' });
    renderScreen(<ConfirmationScreen />);

    fireEvent.press(screen.getByTestId('view-my-reports'));
    expect(router.replace).toHaveBeenCalledWith('/my-reports');

    fireEvent.press(screen.getByTestId('report-something-else'));
    expect(router.navigate).toHaveBeenCalledWith('/report');
  });
});

describe('status tracker', () => {
  const doneCount = () => screen.queryAllByLabelText('Done').length;

  it.each([
    ['RECEIVED', 1],
    ['BEING_CHECKED', 2],
    ['OUTCOME', 3],
  ])('ticks the right number of steps for %s', (current, expected) => {
    renderScreen(<ConfirmationTracker current={current} />);
    expect(doneCount()).toBe(expected);
  });
});

describe('villager status labels', () => {
  it('maps progress to Received / Being checked / Verified / Not confirmed', () => {
    expect(progressBadge({ progress: 'RECEIVED' }, t)).toEqual({ label: 'Received', tone: 'neutral' });
    expect(progressBadge({ progress: 'BEING_CHECKED' }, t)).toEqual({
      label: 'Being checked',
      tone: 'warning',
    });
    expect(progressBadge({ progress: 'OUTCOME', outcome: { decision: 'VERIFIED' } }, t)).toEqual({
      label: 'Verified',
      tone: 'success',
    });
    expect(progressBadge({ progress: 'OUTCOME', outcome: { decision: 'REJECTED' } }, t)).toEqual({
      label: 'Not confirmed',
      tone: 'neutral',
    });
  });
});

describe('offline queued reports in the UI', () => {
  const item = {
    clientRequestId: 'request-1',
    status: 'QUEUED',
    payload: { incidentType: 'ELEPHANT_NEAR_VILLAGE' },
    createdAt: new Date().toISOString(),
  };

  it('shows a saved-for-retry card so the reporter knows it was not lost', () => {
    renderScreen(<PendingReportCard item={item} onDiscard={jest.fn()} />);
    expect(screen.getByText('Waiting to send')).toBeTruthy();
    expect(screen.getByText("Saved safely on this phone. We'll retry automatically.")).toBeTruthy();
    expect(screen.queryByText('Remove')).toBeNull();
  });

  it('lets the reporter remove a report the server rejected', () => {
    const onDiscard = jest.fn();
    renderScreen(<PendingReportCard item={{ ...item, status: 'FAILED' }} onDiscard={onDiscard} />);
    expect(screen.getByText('Not sent')).toBeTruthy();
    fireEvent.press(screen.getByText('Remove'));
    expect(onDiscard).toHaveBeenCalledWith('request-1');
  });
});

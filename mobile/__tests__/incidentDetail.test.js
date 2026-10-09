import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import IncidentDetailScreen from '../app/(liaison)/queue/[id]/index';
import { ApiError } from '../src/api/client';
import { useStartReview } from '../src/hooks/useOfficerActions';
import { useOfficerIncident } from '../src/hooks/useOfficerData';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('../src/hooks/useOfficerActions');
jest.mock('../src/hooks/useOfficerData');

const incident = (overrides = {}) => ({
  id: 'i-1',
  trackingCode: 'C-0142',
  incidentType: 'ELEPHANT_NEAR_VILLAGE',
  urgency: 'NORMAL',
  status: 'PENDING',
  village: { id: 'v1', nameEn: 'Palatupana', nameSi: null, nameTa: null },
  occurredAt: new Date().toISOString(),
  latitude: 6.2994,
  longitude: 81.3703,
  groupedCount: 3,
  callBackRequired: false,
  reporter: { name: 'Nimali P.', phone: '0771234812', phoneMasked: '077 *** 812' },
  related: [
    { id: 'r-1', trackingCode: 'C-0144', createdAt: new Date().toISOString(), reporterName: 'Kasun S.' },
  ],
  nearbyCollars: [{ code: 'EL-07', name: 'EL-07', distanceM: 380 }],
  photoUrl: null,
  verification: null,
  ...overrides,
});

let startReview;

function arrange(data, params = { id: 'i-1' }) {
  useLocalSearchParams.mockReturnValue(params);
  useOfficerIncident.mockReturnValue({ data, isLoading: false, isError: false, refetch: jest.fn() });
  startReview = { mutate: jest.fn() };
  useStartReview.mockReturnValue(startReview);
  return renderScreen(<IncidentDetailScreen />);
}

describe('opening a report (Flow 5)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the map caption, reporter, nearby collar data and related reports', () => {
    arrange(incident());

    expect(screen.getByText('C-0142')).toBeTruthy();
    expect(screen.getByText('Elephant near village · Palatupana')).toBeTruthy();
    expect(screen.getByText('PALATUPANA')).toBeTruthy();
    expect(screen.getByText('3 grouped reports in this area')).toBeTruthy();
    expect(screen.getByText('Nimali P. · 077 *** 812')).toBeTruthy();
    expect(screen.getByText('No photo')).toBeTruthy();
    expect(screen.getByText('Nearby collar data')).toBeTruthy();
    expect(screen.getByText('EL-07 detected about 380 m from this location.')).toBeTruthy();
    expect(screen.getByText(/C-0144 · Kasun S\./)).toBeTruthy();
  });

  it('does not show the full phone number, only the masked one', () => {
    arrange(incident());
    expect(JSON.stringify(screen.toJSON())).not.toContain('0771234812');
  });

  it('marks the report group as "being checked" when an officer opens a pending report', async () => {
    arrange(incident());
    await waitFor(() => expect(startReview.mutate).toHaveBeenCalledWith('i-1'));
  });

  it('does not restart the review for a report that is already under review', () => {
    arrange(incident({ status: 'UNDER_REVIEW' }));
    expect(startReview.mutate).not.toHaveBeenCalled();
  });

  it('flags a call-back when the place was not recognised', () => {
    arrange(incident({ callBackRequired: true }));
    expect(screen.getByText(/Place not recognized/)).toBeTruthy();
  });

  it('says when there is no collar data nearby', () => {
    arrange(incident({ nearbyCollars: [], groupedCount: 1, related: [] }));
    expect(screen.getByText('No collar or camera data nearby.')).toBeTruthy();
    expect(screen.getByText('Report location')).toBeTruthy();
  });

  it('carries the chosen verification method to the verify screen', () => {
    arrange(incident());
    fireEvent.press(screen.getByTestId('method-PHOTO_REVIEW'));
    fireEvent.press(screen.getByTestId('open-verify'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/queue/i-1/verify',
      params: { method: 'PHOTO_REVIEW' },
    });
  });

  it('opens the reject screen', () => {
    arrange(incident());
    fireEvent.press(screen.getByTestId('open-reject'));
    expect(router.push).toHaveBeenCalledWith('/queue/i-1/reject');
  });

  it('is read-only once decided: shows who reviewed it and hides Verify/Reject', () => {
    arrange(incident({ status: 'VERIFIED', verification: { officerName: 'N. Perera' } }));
    expect(screen.getByTestId('already-reviewed')).toBeTruthy();
    expect(screen.getByText('N. Perera marked this report verified.')).toBeTruthy();
    expect(screen.queryByTestId('open-verify')).toBeNull();
    expect(screen.queryByTestId('open-reject')).toBeNull();
  });

  it("shows a friendly error when the report is outside the officer's divisions", () => {
    useLocalSearchParams.mockReturnValue({ id: 'i-9' });
    useOfficerIncident.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new ApiError(403, 'OUT_OF_SCOPE', 'This report is outside your assigned divisions.'),
      refetch: jest.fn(),
    });
    useStartReview.mockReturnValue({ mutate: jest.fn() });
    renderScreen(<IncidentDetailScreen />);
    expect(screen.getByText('This report is outside your assigned divisions.')).toBeTruthy();
  });
});

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';
import ReportDetailsScreen from '../app/(villager)/report/details';
import { usePhotoPicker } from '../src/hooks/usePhotoPicker';
import { useReportLocation } from '../src/hooks/useReportLocation';
import { useSubmitReport } from '../src/hooks/useSubmitReport';
import { useVillages } from '../src/hooks/useVillages';
import { MANUAL_REASON } from '../src/services/reportLocation';
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
jest.mock('../src/hooks/useVillages');
jest.mock('../src/hooks/useReportLocation');
jest.mock('../src/hooks/usePhotoPicker');
jest.mock('../src/hooks/useSubmitReport');

const palatupana = { id: 'v-palatupana', nameEn: 'Palatupana', latitude: 6.2994, longitude: 81.3703 };
const kirinda = { id: 'v-kirinda', nameEn: 'Kirinda', latitude: 6.2386, longitude: 81.3138 };
const coordinates = { latitude: 6.2995, longitude: 81.3705 };

const gpsLocation = {
  isLocating: false,
  retry: jest.fn(),
  result: { mode: 'GPS', coordinates, village: palatupana },
};
const manualLocation = (reason) => ({
  isLocating: false,
  retry: jest.fn(),
  result: { mode: 'MANUAL', reason },
});

let mutateAsync;

function arrange({ type = 'ELEPHANT_NEAR_VILLAGE', location = gpsLocation } = {}) {
  useLocalSearchParams.mockReturnValue({ type });
  useVillages.mockReturnValue({ data: [palatupana, kirinda], isLoading: false, isError: false });
  useReportLocation.mockReturnValue(location);
  usePhotoPicker.mockReturnValue({ photo: null, error: null, pick: jest.fn(), remove: jest.fn() });
  mutateAsync = jest.fn();
  useSubmitReport.mockReturnValue({ mutateAsync, isPending: false });
  return renderScreen(<ReportDetailsScreen />);
}

describe('report details (Flow 2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the GPS-detected village with a Change action', () => {
    arrange();
    expect(screen.getByText('Palatupana')).toBeTruthy();
    expect(screen.getByText('Detected from GPS')).toBeTruthy();
    expect(screen.getByTestId('location-change')).toBeTruthy();
    expect(screen.getByText('Optional — only if it is safe')).toBeTruthy();
    expect(screen.getByText('Keep your distance. Do not approach the animal.')).toBeTruthy();
  });

  it('asks "How many elephants?" only for elephant reports', () => {
    arrange();
    expect(screen.getByText('How many elephants?')).toBeTruthy();
    expect(screen.getByText('2–5')).toBeTruthy();
  });

  it('does not ask for a count for other categories', () => {
    arrange({ type: 'CROP_DAMAGE' });
    expect(screen.queryByText('How many elephants?')).toBeNull();
  });

  it('will not send an elephant report until the count is chosen', async () => {
    arrange();
    fireEvent.press(screen.getByTestId('send-report'));
    expect(await screen.findByText('Choose how many elephants.')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('sends the report with GPS coordinates and shows the confirmation with its reference', async () => {
    arrange();
    mutateAsync.mockResolvedValue({ state: 'SENT', report: { id: 'incident-1', trackingCode: 'C-0142' } });

    fireEvent.press(screen.getByTestId('count-2_5'));
    fireEvent.press(screen.getByTestId('send-report'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].draft).toEqual({
      incidentType: 'ELEPHANT_NEAR_VILLAGE',
      elephantCountBand: '2_5',
      occurredWhen: 'NOW',
      coordinates,
    });
    expect(router.dismissAll).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/my-reports/confirmation',
      params: { code: 'C-0142', id: 'incident-1' },
    });
  });

  it('sends "earlier today" when chosen', async () => {
    arrange();
    mutateAsync.mockResolvedValue({ state: 'SENT', report: { id: 'i', trackingCode: 'C-0150' } });
    fireEvent.press(screen.getByTestId('count-1'));
    fireEvent.press(screen.getByTestId('when-EARLIER_TODAY'));
    fireEvent.press(screen.getByTestId('send-report'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].draft.occurredWhen).toBe('EARLIER_TODAY');
  });

  it('goes to the "saved, will retry" confirmation when the report could only be queued', async () => {
    arrange();
    mutateAsync.mockResolvedValue({ state: 'QUEUED' });
    fireEvent.press(screen.getByTestId('count-1'));
    fireEvent.press(screen.getByTestId('send-report'));

    await waitFor(() =>
      expect(router.navigate).toHaveBeenCalledWith({
        pathname: '/my-reports/confirmation',
        params: { queued: '1' },
      }),
    );
  });

  it('shows a friendly message and keeps the form when sending is rejected', async () => {
    arrange();
    mutateAsync.mockResolvedValue({ state: 'FAILED', code: 'VALIDATION_FAILED' });
    fireEvent.press(screen.getByTestId('count-1'));
    fireEvent.press(screen.getByTestId('send-report'));
    expect(await screen.findByText('Some details are missing or invalid.')).toBeTruthy();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe('GPS fallback (Flow 2, A3)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not block reporting when location is denied: it asks for the village instead', () => {
    arrange({ type: 'CROP_DAMAGE', location: manualLocation(MANUAL_REASON.DENIED) });
    expect(screen.getByText('Location unavailable. Choose your village instead.')).toBeTruthy();
    expect(screen.getByText('Choose your village')).toBeTruthy();
    expect(screen.getByTestId('retry-gps')).toBeTruthy();
  });

  it('explains when the GPS fix is outside the covered area', () => {
    arrange({ type: 'CROP_DAMAGE', location: manualLocation(MANUAL_REASON.OUTSIDE_COVERAGE) });
    expect(
      screen.getByText('Your location is outside the covered area. Choose your village instead.'),
    ).toBeTruthy();
  });

  it('refuses to send until a village is chosen, then sends with that village', async () => {
    arrange({ type: 'CROP_DAMAGE', location: manualLocation(MANUAL_REASON.DENIED) });
    mutateAsync.mockResolvedValue({ state: 'SENT', report: { id: 'i', trackingCode: 'C-0151' } });

    fireEvent.press(screen.getByTestId('send-report'));
    expect(await screen.findByText('Choose where this happened.')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('location-change'));
    fireEvent.press(await screen.findByTestId('village-option-v-kirinda'));
    expect(screen.getByText('Chosen from the village list')).toBeTruthy();

    fireEvent.press(screen.getByTestId('send-report'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].draft).toMatchObject({
      incidentType: 'CROP_DAMAGE',
      villageId: 'v-kirinda',
    });
    expect(mutateAsync.mock.calls[0][0].draft.coordinates).toBeUndefined();
  });

  it('lets the reporter override the GPS village with "Change"', async () => {
    arrange({ type: 'CROP_DAMAGE' });
    mutateAsync.mockResolvedValue({ state: 'SENT', report: { id: 'i', trackingCode: 'C-0152' } });

    fireEvent.press(screen.getByTestId('location-change'));
    fireEvent.press(await screen.findByTestId('village-option-v-kirinda'));
    fireEvent.press(screen.getByTestId('send-report'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].draft.villageId).toBe('v-kirinda');
  });
});

describe('urgent "Person injured" flow (A5)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('prominently advises calling 1990 first, above the form', () => {
    arrange({ type: 'PERSON_INJURED' });
    expect(screen.getByTestId('urgent-banner')).toBeTruthy();
    expect(screen.getByText('Someone is injured? Call 1990 first.')).toBeTruthy();
    expect(screen.getByText('Call 1990')).toBeTruthy();
  });

  it('dials 1990 from the banner', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    arrange({ type: 'PERSON_INJURED' });
    fireEvent.press(screen.getByTestId('call-1990'));
    expect(openURL).toHaveBeenCalledWith('tel:1990');
  });

  it('still lets the report continue and be sent', async () => {
    arrange({ type: 'PERSON_INJURED' });
    mutateAsync.mockResolvedValue({ state: 'SENT', report: { id: 'i', trackingCode: 'C-0153' } });
    fireEvent.press(screen.getByTestId('send-report'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[0][0].draft.incidentType).toBe('PERSON_INJURED');
  });

  it('does not show the urgent banner for other categories', () => {
    arrange({ type: 'CROP_DAMAGE' });
    expect(screen.queryByTestId('urgent-banner')).toBeNull();
  });
});

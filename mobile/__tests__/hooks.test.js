import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import { usePendingReports, usePendingReportsSync } from '../src/hooks/usePendingReports';
import { PHOTO_ERRORS, usePhotoPicker } from '../src/hooks/usePhotoPicker';
import { useReportLocation } from '../src/hooks/useReportLocation';
import { getCurrentCoordinates, LOCATION_STATUS } from '../src/services/location';
import { isOnboarded, markOnboarded } from '../src/services/onboarding';
import { reportSync } from '../src/services/reportSync';

jest.mock('../src/services/reportSync', () => ({
  reportSync: { flush: jest.fn(), listPending: jest.fn(), discard: jest.fn(), submit: jest.fn() },
}));

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    {children}
  </QueryClientProvider>
);

describe('location service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns coordinates when permission is granted', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.3, longitude: 81.37 } });
    await expect(getCurrentCoordinates()).resolves.toEqual({
      status: LOCATION_STATUS.OK,
      coordinates: { latitude: 6.3, longitude: 81.37 },
    });
  });

  it('reports DENIED without ever reading the position', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await expect(getCurrentCoordinates()).resolves.toEqual({ status: LOCATION_STATUS.DENIED });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('never throws: a GPS failure becomes UNAVAILABLE', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('location services off'));
    await expect(getCurrentCoordinates()).resolves.toEqual({ status: LOCATION_STATUS.UNAVAILABLE });
  });
});

describe('useReportLocation', () => {
  beforeEach(() => jest.clearAllMocks());
  const villages = [{ id: 'v1', nameEn: 'Palatupana', latitude: 6.2994, longitude: 81.3703 }];

  it('waits for the village list, then detects the location', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.2995, longitude: 81.3705 } });

    const { result, rerender } = renderHook(({ list }) => useReportLocation(list), {
      initialProps: { list: undefined },
    });
    expect(result.current.isLocating).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    rerender({ list: villages });
    await waitFor(() => expect(result.current.isLocating).toBe(false));
    expect(result.current.result).toMatchObject({ mode: 'GPS', village: villages[0] });
  });

  it('can retry GPS after a failure', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    const { result } = renderHook(() => useReportLocation(villages));
    await waitFor(() => expect(result.current.result?.mode).toBe('MANUAL'));

    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 6.2995, longitude: 81.3705 } });
    act(() => result.current.retry());

    expect(result.current.isLocating).toBe(true);
    await waitFor(() => expect(result.current.result?.mode).toBe('GPS'));
  });
});

describe('usePhotoPicker', () => {
  beforeEach(() => jest.clearAllMocks());
  const asset = (overrides) => ({
    canceled: false,
    assets: [{ uri: 'file:///p.jpg', mimeType: 'image/jpeg', fileSize: 1000, ...overrides }],
  });

  it('keeps a valid gallery photo', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue(asset());
    const { result } = renderHook(() => usePhotoPicker());
    await act(() => result.current.pick('library'));
    expect(result.current.photo).toEqual({ uri: 'file:///p.jpg', mimeType: 'image/jpeg', sizeBytes: 1000 });
    expect(result.current.error).toBeNull();
  });

  it('asks for camera permission and explains when it is refused', async () => {
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });
    const { result } = renderHook(() => usePhotoPicker());
    await act(() => result.current.pick('camera'));
    expect(result.current.error).toBe(PHOTO_ERRORS.PERMISSION);
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('takes a camera photo when permission is granted', async () => {
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchCameraAsync.mockResolvedValue(asset({ mimeType: 'image/png' }));
    const { result } = renderHook(() => usePhotoPicker());
    await act(() => result.current.pick('camera'));
    expect(result.current.photo.mimeType).toBe('image/png');
  });

  it('rejects photos over 5 MB and unsupported types, keeping the report possible without a photo', async () => {
    const { result } = renderHook(() => usePhotoPicker());

    ImagePicker.launchImageLibraryAsync.mockResolvedValue(asset({ fileSize: 6 * 1024 * 1024 }));
    await act(() => result.current.pick('library'));
    expect(result.current.error).toBe(PHOTO_ERRORS.TOO_LARGE);
    expect(result.current.photo).toBeNull();

    ImagePicker.launchImageLibraryAsync.mockResolvedValue(asset({ mimeType: 'image/heic' }));
    await act(() => result.current.pick('library'));
    expect(result.current.error).toBe(PHOTO_ERRORS.UNSUPPORTED);
  });

  it('infers the type from the file extension when the picker gives none', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue(
      asset({ mimeType: undefined, uri: 'file:///x.webp' }),
    );
    const { result } = renderHook(() => usePhotoPicker());
    await act(() => result.current.pick('library'));
    expect(result.current.photo.mimeType).toBe('image/webp');
  });

  it('ignores a cancelled picker and can remove a chosen photo', async () => {
    const { result } = renderHook(() => usePhotoPicker());
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
    await act(() => result.current.pick('library'));
    expect(result.current.photo).toBeNull();

    ImagePicker.launchImageLibraryAsync.mockResolvedValue(asset());
    await act(() => result.current.pick('library'));
    act(() => result.current.remove());
    expect(result.current.photo).toBeNull();
  });
});

describe('automatic retry of queued reports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reportSync.flush.mockResolvedValue(0);
    reportSync.listPending.mockResolvedValue([]);
  });

  it('retries on mount and again when the connection comes back', async () => {
    let netListener;
    NetInfo.addEventListener.mockImplementation((listener) => {
      netListener = listener;
      return jest.fn();
    });

    renderHook(() => usePendingReportsSync('user-1'), { wrapper });
    await waitFor(() => expect(reportSync.flush).toHaveBeenCalledTimes(1));
    expect(reportSync.flush).toHaveBeenCalledWith('user-1');

    act(() => netListener({ isConnected: false, isInternetReachable: false }));
    expect(reportSync.flush).toHaveBeenCalledTimes(1);

    await act(async () => netListener({ isConnected: true, isInternetReachable: true }));
    await waitFor(() => expect(reportSync.flush).toHaveBeenCalledTimes(2));
  });

  it('retries when the app returns to the foreground', async () => {
    let appStateListener;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    });

    renderHook(() => usePendingReportsSync('user-1'), { wrapper });
    await waitFor(() => expect(reportSync.flush).toHaveBeenCalledTimes(1));

    await act(async () => appStateListener('active'));
    await waitFor(() => expect(reportSync.flush).toHaveBeenCalledTimes(2));
  });

  it('does nothing when nobody is signed in', () => {
    renderHook(() => usePendingReportsSync(undefined), { wrapper });
    expect(reportSync.flush).not.toHaveBeenCalled();
  });

  it('lists the reports waiting on this phone', async () => {
    reportSync.listPending.mockResolvedValue([{ clientRequestId: 'q-1' }]);
    const { result } = renderHook(() => usePendingReports('user-1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ clientRequestId: 'q-1' }]));
  });
});

describe('onboarding flag', () => {
  beforeEach(() => AsyncStorage.clear());

  it('remembers that the welcome flow was completed', async () => {
    expect(await isOnboarded()).toBe(false);
    await markOnboarded();
    expect(await isOnboarded()).toBe(true);
  });
});

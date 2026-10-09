import { fireEvent, screen } from '@testing-library/react-native';
import { PatrolDetailModal } from '../src/components/patrol/PatrolDetailModal';
import { renderScreen } from './helpers/render';

const detail = {
  session: {
    id: 's1',
    parkName: 'Yala National Park',
    sectorName: 'Sector 3',
    startedAt: '2026-10-07T06:00:00.000Z',
    endedAt: '2026-10-07T07:30:00.000Z',
  },
  durationMs: 5400000,
  distanceMeters: 2500,
  trackPointCount: 12,
  incidentCount: 2,
  pendingCount: 3,
  incidents: [
    {
      id: 'i1',
      incidentType: 'SNARE_POACHING',
      note: 'Wire snare near waterhole',
      latitude: 6.31,
      longitude: 81.38,
      occurredAt: '2026-10-07T06:20:00.000Z',
      locationWarning: true,
      storageWarning: false,
      syncStatus: 'PENDING',
      photo: null,
    },
    {
      id: 'i2',
      incidentType: 'CARCASS',
      note: null,
      latitude: 6.32,
      longitude: 81.39,
      occurredAt: '2026-10-07T06:50:00.000Z',
      locationWarning: false,
      storageWarning: true,
      syncStatus: 'SYNCED',
      photo: { uri: 'file:///p.jpg' },
    },
  ],
};

describe('PatrolDetailModal', () => {
  it('shows the full patrol: times, stats, upload status and every incident', () => {
    renderScreen(<PatrolDetailModal detail={detail} onClose={jest.fn()} />);

    expect(screen.getByText('Patrol details')).toBeTruthy();
    expect(screen.getByText('Yala National Park · Sector 3')).toBeTruthy();
    expect(screen.getByText('01:30:00')).toBeTruthy();
    expect(screen.getByText('2.50 km')).toBeTruthy();
    expect(screen.getByText('Waiting: 3')).toBeTruthy();
    expect(screen.getByText('Snare / poaching')).toBeTruthy();
    expect(screen.getByText('Wire snare near waterhole')).toBeTruthy();
    expect(screen.getByText('No GPS fix: last known location used.')).toBeTruthy();
    expect(screen.getByText('Photo was compressed (low storage).')).toBeTruthy();
    expect(screen.getByText('Carcass')).toBeTruthy();
  });

  it('says so when no incidents were logged and closes on request', () => {
    const onClose = jest.fn();
    renderScreen(
      <PatrolDetailModal detail={{ ...detail, incidents: [], incidentCount: 0, pendingCount: 0 }} onClose={onClose} />,
    );

    expect(screen.getByText('No incidents were logged on this patrol.')).toBeTruthy();
    expect(screen.getByText('Uploaded')).toBeTruthy();
    fireEvent.press(screen.getByTestId('patrol-detail-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when no patrol is selected', () => {
    renderScreen(<PatrolDetailModal detail={null} onClose={jest.fn()} />);

    expect(screen.queryByTestId('patrol-detail')).toBeNull();
  });
});

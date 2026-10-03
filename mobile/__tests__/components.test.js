import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import HistoryScreen from '../app/(liaison)/history';
import { AppButton } from '../src/components/common/AppButton';
import { HeroCard } from '../src/components/common/HeroCard';
import { LanguageSwitcher } from '../src/components/common/LanguageSwitcher';
import { StatusBadge } from '../src/components/common/StatusBadge';
import { PhotoPicker } from '../src/components/forms/PhotoPicker';
import { HistoryCard } from '../src/components/reports/HistoryCard';
import { SafetyBanner } from '../src/components/reports/SafetyBanner';
import { useOfficerHistory } from '../src/hooks/useOfficerData';
import i18n from '../src/i18n';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('../src/hooks/useOfficerData');

const village = { id: 'v1', nameEn: 'Palatupana', nameSi: null, nameTa: null };

describe('language switcher', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });

  it('lists English, Sinhala and Tamil and switches the whole UI language', async () => {
    renderScreen(<LanguageSwitcher />);
    expect(screen.getByText('EN')).toBeTruthy();

    fireEvent.press(screen.getByTestId('language-switcher'));
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('සිංහල')).toBeTruthy();
    expect(screen.getByText('தமிழ்')).toBeTruthy();

    fireEvent.press(screen.getByTestId('language-option-ta'));
    expect(await screen.findByText('TA')).toBeTruthy();
    expect(i18n.language).toBe('ta');
  });
});

describe('history', () => {
  beforeEach(() => jest.clearAllMocks());

  const rows = [
    {
      incidentId: 'i-1',
      trackingCode: 'C-0142',
      incidentType: 'ELEPHANT_NEAR_VILLAGE',
      village,
      decision: 'VERIFIED',
      fieldActionRequired: true,
      verifiedAt: new Date().toISOString(),
    },
    {
      incidentId: 'i-2',
      trackingCode: 'C-0119',
      incidentType: 'CROP_DAMAGE',
      village,
      decision: 'VERIFIED',
      fieldActionRequired: false,
      verifiedAt: new Date().toISOString(),
    },
    {
      incidentId: 'i-3',
      trackingCode: 'C-0106',
      incidentType: 'OTHER_ANIMAL',
      village,
      decision: 'REJECTED',
      fieldActionRequired: false,
      verifiedAt: new Date().toISOString(),
    },
  ];

  const ready = (data) =>
    useOfficerHistory.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      isSuccess: true,
      isRefetching: false,
      refetch: jest.fn(),
    });

  it('shows each decision with an unambiguous label', () => {
    ready(rows);
    useLocalSearchParams.mockReturnValue({});
    renderScreen(<HistoryScreen />);

    expect(screen.getByText('Verification history')).toBeTruthy();
    expect(screen.getByText('Verified · action needed')).toBeTruthy();
    expect(screen.getByText('Verified · no action')).toBeTruthy();
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
    expect(screen.getByText('C-0106')).toBeTruthy();
  });

  it('filters by the chosen tab', () => {
    ready(rows);
    useLocalSearchParams.mockReturnValue({});
    renderScreen(<HistoryScreen />);

    fireEvent.press(screen.getByTestId('filter-REJECTED'));
    expect(useOfficerHistory).toHaveBeenLastCalledWith('REJECTED');
  });

  it('opens pre-filtered when coming from the queue "Verified" tab', () => {
    ready(rows);
    useLocalSearchParams.mockReturnValue({ filter: 'VERIFIED' });
    renderScreen(<HistoryScreen />);
    expect(useOfficerHistory).toHaveBeenLastCalledWith('VERIFIED');
  });

  it('opens the decided report from a row', () => {
    ready(rows);
    useLocalSearchParams.mockReturnValue({});
    renderScreen(<HistoryScreen />);
    fireEvent.press(screen.getByTestId('history-item-C-0142'));
    expect(router.push).toHaveBeenCalledWith('/queue/i-1');
  });

  it('shows the empty state', () => {
    ready([]);
    useLocalSearchParams.mockReturnValue({});
    renderScreen(<HistoryScreen />);
    expect(screen.getByText('No decisions yet.')).toBeTruthy();
  });

  it('renders a standalone history card', () => {
    renderScreen(<HistoryCard item={rows[2]} onPress={jest.fn()} />);
    expect(screen.getByText('REJECTED')).toBeTruthy();
  });
});

describe('shared components', () => {
  it.each([
    ['loading', { loading: true }],
    ['disabled', { disabled: true }],
  ])('AppButton does not fire while %s', (_name, props) => {
    const onPress = jest.fn();
    renderScreen(<AppButton title="Send" onPress={onPress} {...props} />);
    fireEvent.press(screen.getByLabelText('Send'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('StatusBadge puts the meaning in the label, not just the colour', () => {
    renderScreen(<StatusBadge label="urgent" tone="urgent" uppercase />);
    expect(screen.getByText('URGENT')).toBeTruthy();
  });

  it('HeroCard shows its title, body, caption and action', () => {
    renderScreen(
      <HeroCard
        title="See wildlife near your home?"
        body="Send a quick report"
        caption="Caption"
        action={<AppButton title="Report now" onPress={jest.fn()} />}
      />,
    );
    expect(screen.getByText('See wildlife near your home?')).toBeTruthy();
    expect(screen.getByText('Report now')).toBeTruthy();
    expect(screen.getByText('Caption')).toBeTruthy();
  });

  it('SafetyBanner distance variant warns not to approach the animal', () => {
    renderScreen(<SafetyBanner />);
    expect(screen.getByText('Keep your distance. Do not approach the animal.')).toBeTruthy();
    expect(screen.getByText('If anyone is injured, call 1990 first.')).toBeTruthy();
  });

  it('PhotoPicker shows the add area with the "only if it is safe" hint', () => {
    renderScreen(<PhotoPicker photo={null} error={null} onPick={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('Add photo')).toBeTruthy();
    expect(screen.getByText('Optional — only if it is safe')).toBeTruthy();
  });

  it('PhotoPicker shows the chosen photo and lets it be removed', () => {
    const onRemove = jest.fn();
    renderScreen(
      <PhotoPicker photo={{ uri: 'file:///p.jpg' }} error={null} onPick={jest.fn()} onRemove={onRemove} />,
    );
    fireEvent.press(screen.getByTestId('photo-remove'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('PhotoPicker explains photo problems without blocking the report', () => {
    renderScreen(<PhotoPicker photo={null} error="TOO_LARGE" onPick={jest.fn()} onRemove={jest.fn()} />);
    expect(
      screen.getByText('That photo is too large. Choose a smaller one or send without a photo.'),
    ).toBeTruthy();
  });
});

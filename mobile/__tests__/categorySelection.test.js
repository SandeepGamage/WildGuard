import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import CategoryScreen from '../app/(villager)/report/index';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() },
}));

describe('report category selection (Flow 1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows all six large category tiles and the help card', () => {
    renderScreen(<CategoryScreen />);

    for (const label of [
      'Elephant near village',
      'Crop damage',
      'House / property damage',
      'Person injured',
      'Snare / suspected poaching',
      'Other animal',
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByText('What is happening?')).toBeTruthy();
    expect(screen.getByText('Not sure which category?')).toBeTruthy();
  });

  it('opens the details screen with the chosen category', () => {
    renderScreen(<CategoryScreen />);

    fireEvent.press(screen.getByTestId('category-ELEPHANT_NEAR_VILLAGE'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/report/details',
      params: { type: 'ELEPHANT_NEAR_VILLAGE' },
    });
  });

  it('opens the details screen for the urgent "Person injured" category', () => {
    renderScreen(<CategoryScreen />);
    fireEvent.press(screen.getByTestId('category-PERSON_INJURED'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/report/details',
      params: { type: 'PERSON_INJURED' },
    });
  });
});

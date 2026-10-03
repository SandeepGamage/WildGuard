import { screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import MyReportDetailScreen from '../app/(villager)/my-reports/[id]';
import { ApiError } from '../src/api/client';
import { useMyReport } from '../src/hooks/useMyReports';
import { renderScreen } from './helpers/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));
jest.mock('../src/hooks/useMyReports');

const report = (overrides) => ({
  id: 'r-1',
  trackingCode: 'C-0142',
  incidentType: 'ELEPHANT_NEAR_VILLAGE',
  village: { id: 'v1', nameEn: 'Palatupana', nameSi: null, nameTa: null },
  occurredAt: new Date().toISOString(),
  progress: 'RECEIVED',
  outcome: null,
  photoUrl: null,
  ...overrides,
});

const arrange = (query) => {
  useLocalSearchParams.mockReturnValue({ id: 'r-1' });
  useMyReport.mockReturnValue({
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: jest.fn(),
    ...query,
  });
  return renderScreen(<MyReportDetailScreen />);
};

describe('report status for the villager', () => {
  it('shows "Received" with only the first step ticked and no outcome yet', () => {
    arrange({ data: report() });
    expect(screen.getByText('C-0142')).toBeTruthy();
    expect(screen.getByText('Elephant near village · Palatupana')).toBeTruthy();
    // The status pill and the first tracker step are both labelled "Received".
    expect(screen.getAllByText('Received')).toHaveLength(2);
    expect(screen.getAllByLabelText('Done')).toHaveLength(1);
    expect(screen.queryByTestId('outcome-card')).toBeNull();
  });

  it('shows "Being checked" with two steps ticked', () => {
    arrange({ data: report({ progress: 'BEING_CHECKED' }) });
    expect(screen.getAllByLabelText('Done')).toHaveLength(2);
    expect(screen.getAllByText('Being checked').length).toBeGreaterThan(0);
  });

  it('shows the verified outcome and that field action was requested', () => {
    arrange({
      data: report({
        progress: 'OUTCOME',
        outcome: { decision: 'VERIFIED', fieldActionRequired: true, rejectionReason: null },
      }),
    });
    expect(screen.getAllByLabelText('Done')).toHaveLength(3);
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.getByText(/A liaison officer confirmed your report/)).toBeTruthy();
    expect(screen.getByText('Field action has been requested for this report.')).toBeTruthy();
  });

  it('does not mention field action when none was requested', () => {
    arrange({
      data: report({
        progress: 'OUTCOME',
        outcome: { decision: 'VERIFIED', fieldActionRequired: false, rejectionReason: null },
      }),
    });
    expect(screen.queryByText('Field action has been requested for this report.')).toBeNull();
  });

  it('thanks the reporter politely when the report could not be confirmed', () => {
    arrange({
      data: report({
        progress: 'OUTCOME',
        outcome: {
          decision: 'REJECTED',
          fieldActionRequired: false,
          rejectionReason: 'INSUFFICIENT_EVIDENCE',
        },
      }),
    });
    expect(screen.getByText('Not confirmed')).toBeTruthy();
    expect(screen.getByText(/Thank you for reporting\. We could not confirm this report/)).toBeTruthy();
    expect(screen.queryByText(/INSUFFICIENT_EVIDENCE|Insufficient evidence/i)).toBeNull();
  });

  it('shows a loading state and a friendly error', () => {
    arrange({ data: undefined, isLoading: true });
    expect(screen.getByTestId('loading-state')).toBeTruthy();
  });

  it('shows a friendly error when the report cannot be loaded', () => {
    arrange({
      data: undefined,
      isError: true,
      error: new ApiError(404, 'REPORT_NOT_FOUND', 'Report not found.'),
    });
    expect(screen.getByText('That report could not be found.')).toBeTruthy();
  });
});

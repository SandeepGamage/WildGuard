import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '../src/api/token';
import App from '../src/App';
import { AuthProvider } from '../src/auth/AuthContext';
import AnalyticsPage from '../src/pages/AnalyticsPage';
import SavedReportsPage from '../src/pages/SavedReportsPage';
import { saveFile } from '../src/utils/download';
import { daysBefore, monthsBefore } from '../src/utils/analytics';
import { fail, makeReport, mockFetch, newQueryClient, ok, PARK, renderWithProviders } from './helpers';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="leaflet-map">{children}</div>,
  TileLayer: () => null,
  Polygon: () => null,
  Rectangle: () => <div data-testid="heat-cell" />,
  CircleMarker: ({ children }) => <div>{children}</div>,
  Tooltip: ({ children }) => <span>{children}</span>,
}));
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => <div>{cloneElement(children, { width: 600, height: 300 })}</div>,
  };
});
vi.mock('../src/utils/download', () => ({ saveFile: vi.fn() }));

const MANAGER = { id: 'm1', fullName: 'D. Wijesinghe', role: 'PARK_MANAGER' };
const download = (filename = 'wildguard-yala.pdf') => ({
  ok: true,
  status: 200,
  headers: { get: (h) => (h === 'content-disposition' ? `attachment; filename="${filename}"` : null) },
  blob: async () => new Blob(['%PDF-']),
});

const generateButton = () => screen.getByRole('button', { name: 'Generate report' });

describe('AnalyticsPage (UC4)', () => {
  beforeEach(() => vi.mocked(saveFile).mockClear());

  it('starts idle, generates for the first park and shows the dashboard', async () => {
    const fetch = mockFetch({
      'GET /analytics/parks': ok([PARK]),
      'POST /analytics/reports': ok(makeReport(), 201),
    });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);

    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(generateButton());

    await screen.findByTestId('report');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hotspot map, 1 Jun – 31 Aug 2026');
    expect(screen.getByTestId('report-meta')).toHaveTextContent(
      'Yala National Park · 2026-06-01 – 2026-08-31',
    );
    expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('3. Results');
    expect(screen.getByText('Generated from 184 incidents and 81 community reports')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-incidents')).toHaveTextContent('184');
    expect(screen.getAllByTestId('heat-cell')).toHaveLength(2);
    expect(screen.getByText('Top hotspots')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export report' })).toBeEnabled();

    const body = JSON.parse(fetch.mock.calls.find(([, o]) => o?.method === 'POST')[1].body);
    expect(body).toMatchObject({ parkId: 'yala', reportType: 'HOTSPOT_MAP' });
    expect(body.incidentTypes).toHaveLength(6);
  });

  it('moves between set-up and results with the stepper', async () => {
    mockFetch({ 'GET /analytics/parks': ok([PARK]), 'POST /analytics/reports': ok(makeReport(), 201) });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: '3. Results' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Export/ })).toBeNull();
    await user.click(generateButton());
    await screen.findByTestId('report');

    await user.click(screen.getByRole('button', { name: '1. Report type' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Generate a report');
    expect(screen.getByRole('radio', { name: 'Hotspot map' })).toBeChecked();
    expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('1. Report type');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('2. Criteria');
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByLabelText('From')).toBeNull();
    await user.click(screen.getByRole('button', { name: '2. Criteria' }));
    expect(screen.getByLabelText('From')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '3. Results' }));
    expect(screen.getByTestId('report')).toBeInTheDocument();
    expect(screen.getByRole('button', { current: 'step' })).toHaveAccessibleName('3. Results');
  });

  it('sets the dates from the period buttons and clears them after manual edits', async () => {
    mockFetch({ 'GET /analytics/parks': ok([PARK]) });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Last 3 months' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Last 12 months' }));
    const to = screen.getByLabelText('To').value;
    expect(screen.getByLabelText('From')).toHaveValue(monthsBefore(to, 12));
    expect(screen.getByRole('button', { name: 'Last 12 months' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Last 7 days' }));
    expect(screen.getByLabelText('From')).toHaveValue(daysBefore(to, 7));

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-15' } });
    const group = screen.getByRole('group', { name: 'Period' });
    within(group)
      .getAllByRole('button')
      .forEach((button) => expect(button).toHaveAttribute('aria-pressed', 'false'));
  });

  it('suggests widening the range when nothing matches (A2)', async () => {
    const fetch = mockFetch({
      'GET /analytics/parks': ok([PARK]),
      'POST /analytics/reports': ok({
        empty: true,
        filter: { dateFrom: '2026-10-01', dateTo: '2026-10-05' },
      }),
    });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
    await user.click(generateButton());

    const notice = await screen.findByTestId('notice-no-data');
    expect(notice).toHaveTextContent('2026-10-01 – 2026-10-05');
    await user.click(within(notice).getByRole('button', { name: 'Widen to 3 months' }));
    await waitFor(() => expect(fetch.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(2));
    const widened = JSON.parse(fetch.mock.calls.filter(([, o]) => o?.method === 'POST')[1][1].body);
    expect(widened.dateFrom).toBe(monthsBefore(widened.dateTo, 3));
    expect(screen.getByLabelText('From')).toHaveValue(widened.dateFrom);
  });

  it('highlights invalid filters and keeps the values (E1)', async () => {
    mockFetch({
      'GET /analytics/parks': ok([PARK]),
      'POST /analytics/reports': fail(400, 'VALIDATION_FAILED', {
        issues: [{ field: 'body.dateTo', message: '"To" date is before "From" date.' }],
      }),
    });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2020-01-01' } });
    await user.click(generateButton());

    expect(await screen.findByTestId('notice-invalid')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('To')).toHaveValue('2020-01-01');
  });

  it('offers a retry when the data source is unavailable (E2)', async () => {
    const fetch = mockFetch({
      'GET /analytics/parks': ok([PARK]),
      'POST /analytics/reports': fail(503, 'DATA_SOURCE_UNAVAILABLE'),
    });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(generateButton());

    const notice = await screen.findByTestId('notice-unavailable');
    expect(notice).toHaveTextContent('Your filters are kept');
    await user.click(within(notice).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(fetch.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(2));
  });

  it('shows a network message for other failures', async () => {
    mockFetch({
      'GET /analytics/parks': ok([PARK]),
      'POST /analytics/reports': () => Promise.reject(new TypeError('offline')),
    });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(generateButton());
    expect(await screen.findByTestId('notice-unavailable')).toHaveTextContent('Could not reach the server');
  });

  it('exports a file, and offers the other format when export fails (UC4c, E3)', async () => {
    let exportOk = false;
    const fetch = mockFetch({
      'GET /analytics/parks': ok([PARK]),
      'POST /analytics/reports': ok(makeReport(), 201),
      'GET /analytics/reports/report-1/export': () =>
        exportOk ? download('wildguard-yala.csv') : fail(500, 'EXPORT_FAILED'),
    });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(generateButton());
    await screen.findByTestId('report');

    await user.click(screen.getByRole('button', { name: 'Export report' }));
    await user.click(screen.getByRole('button', { name: 'Export PDF' }));
    const failed = await screen.findByTestId('notice-export-failed');
    expect(failed).toHaveTextContent('Export as CSV');
    expect(fetch.mock.calls.at(-1)[0]).toMatch(/format=PDF&sections=KPI_SUMMARY,HOTSPOT_MAP/);

    exportOk = true;
    await user.click(within(failed).getByRole('button', { name: 'Export as CSV' }));
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByTestId('notice-exported')).toHaveTextContent('CSV file downloaded.');
    expect(screen.queryByTestId('notice-export-failed')).toBeNull();
    expect(saveFile).toHaveBeenCalledWith(expect.objectContaining({ filename: 'wildguard-yala.csv' }));
  });

  it('closes the export dialog with Cancel', async () => {
    mockFetch({ 'GET /analytics/parks': ok([PARK]), 'POST /analytics/reports': ok(makeReport(), 201) });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(generateButton());
    await screen.findByTestId('report');
    await user.click(screen.getByRole('button', { name: 'Export report' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('opens a saved report with the filters it was built from', async () => {
    mockFetch({ 'GET /analytics/parks': ok([PARK]), 'GET /analytics/reports/report-1': ok(makeReport()) });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />, { route: '/?reportId=report-1' });
    expect(await screen.findByTestId('report-meta')).toHaveTextContent('2026-06-01 – 2026-08-31');
    expect(screen.queryByLabelText('From')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit criteria' }));
    expect(screen.getByLabelText('From')).toHaveValue('2026-06-01');
    expect(screen.getByLabelText('To')).toHaveValue('2026-08-31');
  });

  it('shows loading, then an error with retry for the park list', async () => {
    let attempt = 0;
    mockFetch({
      'GET /analytics/parks': () => (++attempt === 1 ? fail(503, 'DATA_SOURCE_UNAVAILABLE') : ok([PARK])),
    });
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    const notice = await screen.findByTestId('notice-parks');
    expect(notice).toHaveTextContent('The data source is unavailable');
    await user.click(within(notice).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Next' })).toBeInTheDocument();
  });
});

describe('SavedReportsPage', () => {
  it('lists saved reports with a link back to the dashboard', async () => {
    mockFetch({
      'GET /analytics/reports': ok([
        {
          id: 'report-1',
          generatedAt: '2026-09-01T04:00:00.000Z',
          filter: { dateFrom: '2026-06-01', dateTo: '2026-08-31', reportType: 'HOTSPOT_MAP' },
          parkName: 'Yala National Park',
          totalIncidents: 184,
        },
      ]),
    });
    renderWithProviders(<SavedReportsPage />);
    const link = await screen.findByRole('link', { name: 'Open' });
    expect(link).toHaveAttribute('href', '/?reportId=report-1');
    const row = link.closest('tr');
    expect(row).toHaveTextContent('2026-06-01 – 2026-08-31');
    expect(row).toHaveTextContent('Hotspot map');
    expect(row).toHaveTextContent('184');
  });

  it('shows the empty and error states', async () => {
    mockFetch({ 'GET /analytics/reports': ok([]) });
    const { unmount } = renderWithProviders(<SavedReportsPage />);
    expect(await screen.findByText(/No saved reports yet/)).toBeInTheDocument();
    unmount();

    let attempt = 0;
    mockFetch({ 'GET /analytics/reports': () => (++attempt === 1 ? fail(500, 'X') : ok([])) });
    const user = userEvent.setup();
    renderWithProviders(<SavedReportsPage />);
    const notice = await screen.findByTestId('notice-saved-error');
    await user.click(within(notice).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No saved reports yet/)).toBeInTheDocument();
  });
});

describe('App routes', () => {
  const renderApp = (route) =>
    render(
      <QueryClientProvider client={newQueryClient()}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it('shows the dashboard and the saved reports page to a signed-in manager', async () => {
    setToken('jwt');
    mockFetch({
      'GET /auth/me': ok(MANAGER),
      'GET /analytics/parks': ok([PARK]),
      'GET /analytics/reports': ok([]),
    });
    const user = userEvent.setup();
    renderApp('/');
    expect(await screen.findByTestId('analytics-page')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Saved reports' }));
    expect(await screen.findByRole('heading', { name: 'Saved reports' })).toBeInTheDocument();
  });

  it('sends unknown paths to the dashboard (and signed-out users to login)', async () => {
    renderApp('/nowhere');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});

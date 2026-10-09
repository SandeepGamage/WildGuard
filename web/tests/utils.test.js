import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportReport, generateReport, getParks, getReport, getSavedReports } from '../src/api/analytics.api';
import { getMe, login } from '../src/api/auth.api';
import { apiDownload, apiRequest, ApiError, setUnauthorizedHandler } from '../src/api/client';
import { clearToken, getToken, setToken, TOKEN_STORAGE_KEY } from '../src/api/token';
import i18n, { LANGUAGE_STORAGE_KEY, setLanguage } from '../src/i18n';
import {
  cellBounds,
  defaultFilters,
  fieldErrors,
  formatChange,
  formatDensity,
  monthLabel,
  monthsBefore,
  pointsBounds,
  toIsoDate,
  widenFilters,
} from '../src/utils/analytics';
import { saveFile } from '../src/utils/download';
import { friendlyError } from '../src/utils/errors';
import { ALL_TYPES, fail, jsonResponse, ok } from './helpers';

const t = i18n.t.bind(i18n);

describe('analytics helpers', () => {
  it('formats and shifts calendar dates', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(monthsBefore('2026-08-31', 3)).toBe('2026-05-31');
    // 31 May minus 3 months clamps to the last day of February.
    expect(monthsBefore('2026-05-31', 3)).toBe('2026-02-28');
    expect(monthsBefore('2026-02-15', 3)).toBe('2025-11-15');
  });

  it('builds default and widened filters', () => {
    const filters = defaultFilters('yala', new Date(2026, 9, 5));
    expect(filters).toEqual({
      dateFrom: '2026-07-05',
      dateTo: '2026-10-05',
      parkId: 'yala',
      reportType: '',
      incidentTypes: ALL_TYPES,
    });
    expect(widenFilters({ ...filters, dateFrom: '2026-10-01' }).dateFrom).toBe('2026-07-05');
    expect(defaultFilters().parkId).toBe('');
  });

  it('maps validation issues to fields', () => {
    const error = new ApiError(400, 'VALIDATION_FAILED', 'bad', {
      issues: [
        { field: 'body.dateTo', message: 'To before From' },
        { field: 'body.incidentTypes.0', message: 'Unknown type' },
        { field: 'body.dateTo', message: 'ignored second message' },
      ],
    });
    expect(fieldErrors(error)).toEqual({ dateTo: 'To before From', incidentTypes: 'Unknown type' });
    expect(fieldErrors(new ApiError(400, 'VALIDATION_FAILED', 'bad'))).toEqual({});
    expect(fieldErrors(new ApiError(503, 'DATA_SOURCE_UNAVAILABLE', 'x'))).toEqual({});
    expect(fieldErrors(null)).toEqual({});
  });

  it('formats changes, densities and months', () => {
    expect(formatChange(12)).toBe('+12%');
    expect(formatChange(-5)).toBe('−5%');
    expect(formatChange(0)).toBe('0%');
    expect(formatChange(null)).toBeNull();
    expect(formatChange(undefined)).toBeNull();
    expect(formatDensity(0.0643)).toBe('0.06');
    expect(formatDensity(1.54)).toBe('1.5');
    expect(formatDensity(12.3)).toBe('12');
    expect(monthLabel('2026-06')).toBe('Jun');
    expect(monthLabel('2026-06', true)).toBe('Jun 26');
  });

  it('computes Leaflet bounds for cells and outlines', () => {
    const [[south, west], [north, east]] = cellBounds(
      { latitude: 6.3, longitude: 81.3 },
      { latitude: 0.002, longitude: 0.004 },
    );
    expect(south).toBeCloseTo(6.299, 9);
    expect(west).toBeCloseTo(81.298, 9);
    expect(north).toBeCloseTo(6.301, 9);
    expect(east).toBeCloseTo(81.302, 9);
    expect(
      pointsBounds([
        { latitude: 6.2, longitude: 81.4 },
        { latitude: 6.4, longitude: 81.2 },
      ]),
    ).toEqual([
      [6.2, 81.2],
      [6.4, 81.4],
    ]);
  });
});

describe('errors, storage and language', () => {
  it('turns backend codes into friendly messages', () => {
    expect(friendlyError({ code: 'DATA_SOURCE_UNAVAILABLE' }, t)).toBe(t('errors.dataUnavailable'));
    expect(friendlyError({ code: 'INVALID_CREDENTIALS' }, t)).toBe('Wrong email or password.');
    expect(friendlyError({ code: 'NOT_MANAGER' }, t)).toBe(t('auth.notManager'));
    expect(friendlyError({ code: 'SOMETHING_ELSE' }, t)).toBe(t('errors.generic'));
    expect(friendlyError(undefined, t)).toBe(t('errors.generic'));
  });

  it('stores and clears the token', () => {
    expect(getToken()).toBeNull();
    setToken('abc');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('abc');
    expect(getToken()).toBe('abc');
    clearToken();
    expect(getToken()).toBeNull();
  });

  it('survives blocked storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getToken()).toBeNull();
    expect(() => setToken('x')).not.toThrow();
    expect(() => clearToken()).not.toThrow();
    spy.mockRestore();
    set.mockRestore();
    remove.mockRestore();
  });

  it('switches and remembers the language', async () => {
    await setLanguage('si');
    expect(i18n.language).toBe('si');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('si');
    expect(document.documentElement.lang).toBe('si');
    expect(t('tabs.reports')).toBe('වාර්තාවක් සාදන්න');
    await setLanguage('en');
  });

  it('saves a downloaded file through a temporary link', () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:report');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    saveFile({ blob: new Blob(['x']), filename: 'report.csv' });
    expect(click).toHaveBeenCalled();
    expect(document.querySelector('a[download]')).toBeNull();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
    click.mockRestore();
    vi.useRealTimers();
  });
});

describe('API client', () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    vi.restoreAllMocks();
  });

  it('sends the token and unwraps the envelope', async () => {
    setToken('tok');
    globalThis.fetch = vi.fn().mockResolvedValue(ok({ hello: 'world' }));
    await expect(apiRequest('/x', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ hello: 'world' });
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/x$/);
    expect(options.headers.Authorization).toBe('Bearer tok');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ a: 1 });
  });

  it('omits the token for public calls', async () => {
    setToken('tok');
    globalThis.fetch = vi.fn().mockResolvedValue(ok({}));
    await apiRequest('/auth/login', { method: 'POST', body: {}, auth: false });
    expect(globalThis.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('throws ApiError with the backend code and details', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(fail(400, 'VALIDATION_FAILED', { issues: [] }));
    await expect(apiRequest('/x')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      details: { issues: [] },
    });
  });

  it('handles unreadable bodies and network failures', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('html');
      },
    });
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 502, code: 'UNKNOWN_ERROR' });

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('signs out on 401 for authenticated calls only', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    globalThis.fetch = vi.fn().mockResolvedValue(fail(401, 'UNAUTHENTICATED'));
    await expect(apiRequest('/x')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
    await expect(apiRequest('/auth/login', { auth: false })).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('downloads a file with its name, or reports the failure', async () => {
    const blob = new Blob(['a,b']);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (h) => (h === 'content-disposition' ? 'attachment; filename="r.csv"' : null) },
      blob: async () => blob,
    });
    await expect(apiDownload('/f')).resolves.toEqual({ blob, filename: 'r.csv' });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ...jsonResponse({}), headers: { get: () => null }, blob: async () => blob });
    await expect(apiDownload('/f')).resolves.toEqual({ blob, filename: null });

    globalThis.fetch = vi.fn().mockResolvedValue(fail(500, 'EXPORT_FAILED'));
    await expect(apiDownload('/f')).rejects.toMatchObject({ code: 'EXPORT_FAILED' });
  });

  it('calls the analytics and auth endpoints', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => ok({ ok: true }));
    await getParks();
    await generateReport({ parkId: 'yala' });
    await getSavedReports();
    await getReport('a b');
    await getMe();
    await login({ account: 'm@x', password: 'p' });
    const urls = globalThis.fetch.mock.calls.map(
      ([url, o]) => `${o.method ?? 'GET'} ${url.split('/api/v1')[1]}`,
    );
    expect(urls).toEqual([
      'GET /analytics/parks',
      'POST /analytics/reports',
      'GET /analytics/reports?limit=50',
      'GET /analytics/reports/a%20b',
      'GET /auth/me',
      'POST /auth/login',
    ]);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      blob: async () => new Blob([]),
    });
    await exportReport('r1', { format: 'CSV', sections: ['KPI_SUMMARY', 'HOTSPOT_MAP'] });
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(
      /\/analytics\/reports\/r1\/export\?format=CSV&sections=KPI_SUMMARY,HOTSPOT_MAP$/,
    );
  });
});

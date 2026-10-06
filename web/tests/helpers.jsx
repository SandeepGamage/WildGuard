import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

export const PARK = {
  id: 'yala',
  name: 'Yala National Park',
  block: 'Block I',
  boundary: [
    { latitude: 6.38, longitude: 81.26 },
    { latitude: 6.38, longitude: 81.42 },
    { latitude: 6.22, longitude: 81.42 },
  ],
  sectors: [{ id: 's3', name: 'Sector 3' }],
};

export const ALL_TYPES = [
  'ELEPHANT_NEAR_VILLAGE',
  'CROP_DAMAGE',
  'PROPERTY_DAMAGE',
  'PERSON_INJURED',
  'SNARE_POACHING',
  'OTHER_ANIMAL',
];

export const makeReport = (overrides = {}) => ({
  id: 'report-1',
  park: PARK,
  generatedAt: '2026-09-01T04:00:00.000Z',
  filter: {
    dateFrom: '2026-06-01',
    dateTo: '2026-08-31',
    parkId: 'yala',
    reportType: 'HOTSPOT_MAP',
    incidentTypes: ALL_TYPES,
  },
  stats: {
    totalIncidents: 184,
    changePercent: 12,
    communityReports: { received: 81, verified: 57 },
    conflictEvents: 68,
    injuries: 2,
  },
  trends: {
    months: ['2026-06', '2026-07', '2026-08'],
    series: [
      { type: 'CROP_DAMAGE', counts: [9, 12, 18] },
      { type: 'ELEPHANT_NEAR_VILLAGE', counts: [6, 9, 14] },
      { type: 'PERSON_INJURED', counts: [0, 0, 0] },
    ],
    totals: [15, 21, 32],
  },
  coverage: { available: false, coveragePercent: null, patrolHours: null, unpatrolledSectors: [] },
  heatmap: {
    bandwidthMetres: 500,
    cellSizeDeg: { latitude: 0.00225, longitude: 0.00226 },
    bounds: { minLat: 6.22, maxLat: 6.38, minLng: 81.26, maxLng: 81.42 },
    cells: [
      { row: 1, col: 1, latitude: 6.3, longitude: 81.37, density: 6.4, level: 4 },
      { row: 1, col: 2, latitude: 6.3, longitude: 81.372, density: 0.5, level: 0 },
    ],
    maxDensity: 6.4,
    classBreaks: [0.32, 1.3, 2.6, 3.8, 5.1],
  },
  topHotspots: [{ area: 'Palatupana', incidents: 41, mainType: 'CROP_DAMAGE' }],
  landmarks: [{ name: 'Palatupana', latitude: 6.2994, longitude: 81.3703 }],
  ...overrides,
});

export function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
}

/** Render with React Query and a router. */
export function renderWithProviders(ui, { route = '/', client = newQueryClient() } = {}) {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

/** A fetch Response stand-in. */
export function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

/** Mock fetch with a route table: { 'GET /analytics/parks': responseOrFn }. */
export function mockFetch(routes) {
  const fn = vi.fn(async (url, options = {}) => {
    const path = url.replace(/^https?:\/\/[^/]+\/api\/v1/, '').split('?')[0];
    const key = `${options.method ?? 'GET'} ${path}`;
    const handler = routes[key];
    if (!handler) return jsonResponse({ success: false, error: { code: 'NOT_MOCKED', message: key } }, 404);
    return typeof handler === 'function' ? handler(url, options) : handler;
  });
  globalThis.fetch = fn;
  return fn;
}

export const ok = (data, status = 200) => jsonResponse({ success: true, data, message: 'OK' }, status);
export const fail = (status, code, details) =>
  jsonResponse({ success: false, error: { code, message: code, details } }, status);

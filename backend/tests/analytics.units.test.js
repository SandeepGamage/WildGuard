const { GISMappingService } = require('../src/services/gisMapping.service');
const {
  aggregateIncidents,
  computeConflictTrends,
  computePatrolCoverage,
  findTopHotspots,
  monthsBetween,
  monthKey,
} = require('../src/services/analyticsReport.service');
const { CsvExporter, csvField } = require('../src/services/export/csv.exporter');
const { PdfExporter } = require('../src/services/export/pdf.exporter');
const { ExportEngine } = require('../src/services/export/exportEngine');
const {
  PendingPatrolDataSource,
  PendingAlertDataSource,
} = require('../src/repositories/sources/pendingDataSources');
const { distanceM, boundingBox } = require('../src/utils/geo');
const { toReportDocument, toConservationReport } = require('../src/models/conservationReport.model');
const { EXPORT_SECTIONS } = require('../src/constants/domain');

const PALATUPANA = { latitude: 6.2994, longitude: 81.3703 };
const SECTORS = [
  { id: 's3', name: 'Sector 3' },
  { id: 's4', name: 'Sector 4' },
];
const silentLogger = { error: () => {}, info: () => {}, warn: () => {} };

const incident = (overrides = {}) => ({
  incidentType: 'CROP_DAMAGE',
  occurredAt: new Date('2026-07-10T06:00:00Z'),
  sectorId: 's3',
  ...PALATUPANA,
  ...overrides,
});

describe('geo helpers', () => {
  it('measures haversine distance', () => {
    expect(distanceM(6.0, 81.0, 6.0, 81.0)).toBe(0);
    // 0.01 degree of latitude is about 1.11 km.
    expect(distanceM(6.0, 81.0, 6.01, 81.0)).toBeCloseTo(1112, -1);
  });

  it('grows a bounding box by a margin', () => {
    const box = boundingBox([PALATUPANA], 1000);
    expect(box.maxLat - box.minLat).toBeCloseTo(2000 / 111320, 6);
    expect(box.minLng).toBeLessThan(PALATUPANA.longitude);
  });
});

describe('GISMappingService kernel density', () => {
  const gis = new GISMappingService({ cellSizeM: 100 });

  it('returns an empty surface when there are no points', () => {
    const result = gis.calculateSpatialHotspots([], 500);
    expect(result.cells).toEqual([]);
    expect(result.maxDensity).toBe(0);
  });

  it('peaks at a single point with the Gaussian maximum 1/(2πh²)', () => {
    const result = gis.calculateSpatialHotspots([PALATUPANA], 500);
    const peak = result.cells.reduce((best, cell) => (cell.density > best.density ? cell : best));
    expect(distanceM(peak.latitude, peak.longitude, PALATUPANA.latitude, PALATUPANA.longitude)).toBeLessThan(
      100,
    );
    // 1e6 / (2π · 500²) ≈ 0.637 incidents per km² at the centre.
    expect(result.maxDensity).toBeGreaterThan(0.6);
    expect(result.maxDensity).toBeLessThanOrEqual(0.637);
    expect(peak.level).toBe(4);
    expect(result.classBreaks).toHaveLength(5);
  });

  it('spreads density further with a wider bandwidth', () => {
    const narrow = gis.calculateSpatialHotspots([PALATUPANA], 300);
    const wide = gis.calculateSpatialHotspots([PALATUPANA], 900);
    expect(wide.maxDensity).toBeLessThan(narrow.maxDensity);
    expect(wide.cells.length).toBeGreaterThan(narrow.cells.length);
  });

  it('ranks a cluster above an isolated point', () => {
    const cluster = [0, 1, 2].map(() => ({ ...PALATUPANA }));
    const lone = { latitude: 6.35, longitude: 81.39 };
    const result = gis.calculateSpatialHotspots([...cluster, lone], 500);
    const near = (p) =>
      result.cells
        .filter((c) => distanceM(c.latitude, c.longitude, p.latitude, p.longitude) < 150)
        .reduce((max, c) => Math.max(max, c.density), 0);
    expect(near(PALATUPANA)).toBeGreaterThan(near(lone) * 2);
  });

  it('uses the park outline to fix the grid', () => {
    const area = [
      { latitude: 6.2, longitude: 81.2 },
      { latitude: 6.4, longitude: 81.4 },
    ];
    const result = gis.calculateSpatialHotspots([PALATUPANA], 500, area);
    expect(result.bounds).toEqual({ minLat: 6.2, maxLat: 6.4, minLng: 81.2, maxLng: 81.4 });
    expect(result.cellSizeDeg.latitude).toBeCloseTo(100 / 111320, 8);
  });
});

describe('report aggregation', () => {
  it('lists every month of the period in Sri Lanka time', () => {
    expect(
      monthsBetween(new Date('2026-06-01T00:00:00+05:30'), new Date('2026-09-01T00:00:00+05:30')),
    ).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(
      monthsBetween(new Date('2025-12-15T00:00:00+05:30'), new Date('2026-01-02T00:00:00+05:30')),
    ).toEqual(['2025-12', '2026-01']);
    // 31 Jul 20:00 UTC is already 1 Aug in Colombo.
    expect(monthKey(new Date('2026-07-31T20:00:00Z'))).toBe('2026-08');
  });

  it('counts by type, sector and month and compares with the previous period', () => {
    const dataset = {
      communityIncidents: [
        incident(),
        incident({ incidentType: 'PERSON_INJURED', occurredAt: new Date('2026-08-02T06:00:00Z') }),
        incident({ incidentType: 'SNARE_POACHING', sectorId: 's4' }),
      ],
      patrolIncidents: [incident({ incidentType: 'SNARE_POACHING', sectorId: 's4' })],
      collarAlerts: [{}],
      receivedCommunityReports: 5,
      previousPeriodCount: 2,
    };
    const stats = aggregateIncidents(dataset, SECTORS, ['2026-07', '2026-08']);
    expect(stats.totalIncidents).toBe(4);
    expect(stats.changePercent).toBe(100);
    expect(stats.byType).toEqual([
      { type: 'CROP_DAMAGE', count: 1 },
      { type: 'PERSON_INJURED', count: 1 },
      { type: 'SNARE_POACHING', count: 2 },
    ]);
    expect(stats.bySector).toEqual([
      { sectorId: 's3', name: 'Sector 3', count: 2 },
      { sectorId: 's4', name: 'Sector 4', count: 2 },
    ]);
    expect(stats.byMonth).toEqual([
      { month: '2026-07', count: 3 },
      { month: '2026-08', count: 1 },
    ]);
    expect(stats.communityReports).toEqual({ received: 5, verified: 3 });
    expect(stats).toMatchObject({ patrolIncidents: 1, collarAlerts: 1, conflictEvents: 2, injuries: 1 });
  });

  it('has no change percentage when the previous period was empty', () => {
    const stats = aggregateIncidents(
      { communityIncidents: [incident()], patrolIncidents: [], collarAlerts: [], previousPeriodCount: 0 },
      SECTORS,
      ['2026-07'],
    );
    expect(stats.changePercent).toBeNull();
  });

  it('builds monthly conflict series and ignores non-conflict types', () => {
    const trends = computeConflictTrends(
      [
        incident(),
        incident({ incidentType: 'ELEPHANT_NEAR_VILLAGE' }),
        incident({ incidentType: 'ELEPHANT_NEAR_VILLAGE', occurredAt: new Date('2026-08-05T06:00:00Z') }),
        incident({ incidentType: 'SNARE_POACHING' }),
      ],
      ['2026-07', '2026-08'],
    );
    expect(trends.series.find((s) => s.type === 'ELEPHANT_NEAR_VILLAGE').counts).toEqual([1, 1]);
    expect(trends.series.find((s) => s.type === 'CROP_DAMAGE').counts).toEqual([1, 0]);
    expect(trends.series.map((s) => s.type)).not.toContain('SNARE_POACHING');
    expect(trends.totals).toEqual([2, 1]);
  });

  it('reports coverage as not available without patrol data', () => {
    expect(computePatrolCoverage([], SECTORS, new Date('2026-09-01'))).toEqual({
      available: false,
      coveragePercent: null,
      patrolHours: null,
      unpatrolledSectors: [],
    });
  });

  it('finds sectors not patrolled for more than 14 days', () => {
    const coverage = computePatrolCoverage(
      [
        { sectorId: 's3', startedAt: new Date('2026-08-29'), endedAt: new Date('2026-08-30'), hours: 4.25 },
        { sectorId: 's3', startedAt: new Date('2026-08-01'), endedAt: new Date('2026-08-01'), hours: 3 },
      ],
      [...SECTORS, { id: 's5', name: 'Sector 5' }],
      new Date('2026-09-01'),
    );
    expect(coverage.available).toBe(true);
    expect(coverage.coveragePercent).toBe(33);
    expect(coverage.patrolHours).toBe(7.3);
    expect(coverage.unpatrolledSectors.map((s) => s.name)).toEqual(['Sector 4', 'Sector 5']);

    const stale = computePatrolCoverage(
      [{ sectorId: 's3', endedAt: new Date('2026-08-01'), hours: 2 }],
      [SECTORS[0]],
      new Date('2026-09-01'),
    );
    expect(stale.unpatrolledSectors).toEqual([
      expect.objectContaining({ name: 'Sector 3', daysSincePatrol: 31 }),
    ]);
  });

  it('ranks hotspot areas by nearest village, else by sector', () => {
    const villages = [{ name: 'Palatupana', ...PALATUPANA }];
    const top = findTopHotspots(
      [
        incident(),
        incident({ incidentType: 'ELEPHANT_NEAR_VILLAGE' }),
        incident({ incidentType: 'ELEPHANT_NEAR_VILLAGE' }),
        incident({ latitude: 6.36, longitude: 81.4, sectorId: 's4' }),
        incident({ latitude: 6.36, longitude: 81.4, sectorId: 'unknown' }),
      ],
      villages,
      SECTORS,
    );
    expect(top).toEqual([
      { area: 'Palatupana', incidents: 3, mainType: 'ELEPHANT_NEAR_VILLAGE' },
      { area: 'Other areas', incidents: 1, mainType: 'CROP_DAMAGE' },
      { area: 'Sector 4', incidents: 1, mainType: 'CROP_DAMAGE' },
    ]);
  });
});

const sampleReport = () => ({
  id: 'r1',
  parkId: 'yala',
  park: {
    id: 'yala',
    name: 'Yala National Park',
    boundary: [
      { latitude: 6.2, longitude: 81.2 },
      { latitude: 6.4, longitude: 81.2 },
      { latitude: 6.4, longitude: 81.4 },
    ],
  },
  generatedAt: new Date('2026-09-01T04:00:00Z'),
  filter: { dateFrom: '2026-06-01', dateTo: '2026-08-31', parkId: 'yala', reportType: 'HOTSPOT_MAP' },
  stats: {
    totalIncidents: 2,
    changePercent: 12,
    byType: [{ type: 'CROP_DAMAGE', count: 2 }],
    bySector: [{ sectorId: 's3', name: 'Sector 3', count: 2 }],
    byMonth: [{ month: '2026-06', count: 2 }],
    communityReports: { received: 3, verified: 2 },
    conflictEvents: 2,
    injuries: 0,
  },
  trends: { months: ['2026-06'], series: [{ type: 'CROP_DAMAGE', counts: [2] }], totals: [2] },
  coverage: { available: false, coveragePercent: null, patrolHours: null, unpatrolledSectors: [] },
  heatmap: new GISMappingService().calculateSpatialHotspots([PALATUPANA], 500, [
    { latitude: 6.2, longitude: 81.2 },
    { latitude: 6.4, longitude: 81.4 },
  ]),
  topHotspots: [{ area: 'Palatupana, "north"', incidents: 2, mainType: 'CROP_DAMAGE' }],
  landmarks: [{ name: 'Palatupana', ...PALATUPANA }],
  incidents: [
    {
      trackingCode: 'C-0101',
      incidentType: 'CROP_DAMAGE',
      occurredAt: new Date('2026-06-02T00:00:00Z'),
      villageName: '=HYPERLINK("x")',
      sectorName: 'Sector 3',
      latitude: 6.3,
      longitude: 81.37,
    },
  ],
});

describe('CSV exporter', () => {
  it('escapes commas, quotes and line breaks and neutralises formulas', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line\nbreak')).toBe('"line\nbreak"');
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField('-12')).toBe('-12');
    expect(csvField(null)).toBe('');
  });

  it('writes only the chosen sections', () => {
    const file = new CsvExporter().export(sampleReport(), [EXPORT_SECTIONS.KPI_SUMMARY]);
    const text = file.content.toString('utf8');
    expect(file.contentType).toMatch(/text\/csv/);
    expect(file.filename).toBe('wildguard-yala-2026-06-01-to-2026-08-31.csv');
    expect(text).toContain('KPI summary');
    expect(text).toContain('Not available');
    expect(text).not.toContain('Top hotspots');
    expect(text).not.toContain('Incident list');
  });

  it('writes every section when asked', () => {
    const text = new CsvExporter()
      .export(sampleReport(), Object.values(EXPORT_SECTIONS))
      .content.toString('utf8');
    expect(text).toContain('"Palatupana, ""north"""');
    expect(text).toContain('Hotspot density grid');
    expect(text).toContain('Patrol data (UC1) not connected yet');
    expect(text).toContain('Human-wildlife conflict by month');
    expect(text).toContain('Jun 2026');
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('lists coverage gaps when patrol data is available', () => {
    const report = {
      ...sampleReport(),
      coverage: {
        available: true,
        coveragePercent: 50,
        unpatrolledSectors: [{ name: 'Sector 4', lastPatrolledAt: null, daysSincePatrol: null }],
      },
    };
    const text = new CsvExporter().export(report, [EXPORT_SECTIONS.COVERAGE_GAPS]).content.toString('utf8');
    expect(text).toContain('Sector 4');
  });
});

describe('PDF exporter', () => {
  it('produces a PDF with every section', async () => {
    const file = await new PdfExporter().export(sampleReport(), Object.values(EXPORT_SECTIONS));
    expect(file.contentType).toBe('application/pdf');
    expect(file.content.subarray(0, 5).toString()).toBe('%PDF-');
    expect(file.content.length).toBeGreaterThan(1500);
  });

  it('handles a report with coverage data and no heatmap cells', async () => {
    const report = {
      ...sampleReport(),
      heatmap: { bandwidthMetres: 500, cells: [] },
      coverage: {
        available: true,
        coveragePercent: 50,
        unpatrolledSectors: [
          { name: 'Sector 4', lastPatrolledAt: new Date('2026-08-01'), daysSincePatrol: 30 },
          { name: 'Sector 5', lastPatrolledAt: null, daysSincePatrol: null },
        ],
      },
    };
    const file = await new PdfExporter().export(report, [
      EXPORT_SECTIONS.HOTSPOT_MAP,
      EXPORT_SECTIONS.COVERAGE_GAPS,
    ]);
    expect(file.content.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('ExportEngine', () => {
  it('chooses the exporter for the format (Strategy)', async () => {
    const engine = new ExportEngine({ logger: silentLogger });
    const csv = await engine.generateFile(sampleReport(), 'CSV', [EXPORT_SECTIONS.KPI_SUMMARY]);
    expect(csv.filename.endsWith('.csv')).toBe(true);
  });

  it('rejects an unknown format', async () => {
    const engine = new ExportEngine({ logger: silentLogger });
    await expect(engine.generateFile(sampleReport(), 'XLSX', [])).rejects.toMatchObject({
      code: 'UNSUPPORTED_FORMAT',
    });
  });

  it('turns an exporter failure into EXPORT_FAILED (exception E3)', async () => {
    const engine = new ExportEngine({
      exporters: { PDF: { export: async () => Promise.reject(new Error('font missing')) } },
      logger: silentLogger,
    });
    await expect(engine.generateFile(sampleReport(), 'PDF', [])).rejects.toMatchObject({
      statusCode: 500,
      code: 'EXPORT_FAILED',
    });
  });
});

describe('pending UC1/UC2 data sources', () => {
  it('return empty lists until patrol and alert data exist', async () => {
    const patrol = new PendingPatrolDataSource();
    expect(await patrol.listTracks({})).toEqual([]);
    expect(await patrol.listIncidents({})).toEqual([]);
    expect(await new PendingAlertDataSource().listAlerts({})).toEqual([]);
  });
});

describe('conservation report mapping', () => {
  it('round-trips a report through the Mongo document shape', () => {
    const report = { ...sampleReport(), createdBy: 'manager-1' };
    const doc = toReportDocument(report);
    expect(doc).toMatchObject({ id: 'r1', park_id: 'yala', created_by: 'manager-1' });
    expect(toConservationReport(doc)).toMatchObject({
      id: 'r1',
      parkId: 'yala',
      createdBy: 'manager-1',
      stats: report.stats,
      topHotspots: report.topHotspots,
    });
    expect(toConservationReport(null)).toBeNull();
    expect(toConservationReport({ id: 'x', park_id: 'yala', stats: {} })).toMatchObject({
      trends: null,
      coverage: null,
      heatmap: null,
      topHotspots: [],
      incidents: [],
    });
  });
});

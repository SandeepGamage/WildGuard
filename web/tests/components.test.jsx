import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConflictTrendChart } from '../src/components/ConflictTrendChart';
import { ConflictTypeBars } from '../src/components/ConflictTypeBars';
import { ExportDialog } from '../src/components/ExportDialog';
import { FilterBar } from '../src/components/FilterBar';
import { HotspotMap } from '../src/components/HotspotMap';
import { KpiTiles } from '../src/components/KpiTiles';
import { ReportInsights } from '../src/components/ReportInsights';
import { ReportNotice } from '../src/components/ReportNotice';
import { TopHotspotsTable } from '../src/components/TopHotspotsTable';
import { HEAT_COLORS } from '../src/constants';
import { defaultFilters } from '../src/utils/analytics';
import { ALL_TYPES, makeReport, PARK } from './helpers';

// Leaflet needs a real browser layout; the map's structure is tested through light stand-ins.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, bounds }) => (
    <div data-testid="leaflet-map" data-bounds={JSON.stringify(bounds)}>
      {children}
    </div>
  ),
  TileLayer: ({ url }) => <div data-testid="tiles" data-url={url} />,
  Polygon: ({ positions }) => <div data-testid="park-outline" data-points={positions.length} />,
  Rectangle: ({ pathOptions }) => <div data-testid="heat-cell" data-color={pathOptions.fillColor} />,
  CircleMarker: ({ children }) => <div data-testid="village">{children}</div>,
  Tooltip: ({ children }) => <span>{children}</span>,
}));

// ResponsiveContainer measures its parent, which is 0×0 in jsdom; give the chart a fixed size.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => (
      <div style={{ width: 600, height: 300 }}>{cloneElement(children, { width: 600, height: 300 })}</div>
    ),
  };
});

describe('FilterBar', () => {
  const setup = (props = {}) => {
    const onChange = vi.fn();
    const onGenerate = vi.fn();
    const value = defaultFilters('yala', new Date(2026, 9, 5));
    render(<FilterBar value={value} onChange={onChange} parks={[PARK]} onGenerate={onGenerate} {...props} />);
    return { onChange, onGenerate, value };
  };

  it('edits dates, park, report type and incident types', async () => {
    const user = userEvent.setup();
    const { onChange, value } = setup();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-04-01' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...value, dateFrom: '2026-04-01' });

    await user.selectOptions(screen.getByLabelText('Park'), 'yala');
    expect(onChange).toHaveBeenLastCalledWith({ ...value, parkId: 'yala' });

    await user.click(screen.getByRole('radio', { name: 'Patrol coverage' }));
    expect(onChange.mock.lastCall[0].reportType).toBe('PATROL_COVERAGE');

    await user.click(screen.getByRole('checkbox', { name: 'Snare / suspected poaching' }));
    expect(onChange.mock.lastCall[0].incidentTypes).not.toContain('SNARE_POACHING');

    await user.click(screen.getByRole('checkbox', { name: 'All incidents' }));
    expect(onChange.mock.lastCall[0].incidentTypes).toEqual([]);

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-30' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...value, dateTo: '2026-09-30' });
  });

  it('adds a type back in canonical order and can select all again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBar
        value={{ ...defaultFilters('yala'), incidentTypes: ['SNARE_POACHING'] }}
        onChange={onChange}
        parks={[PARK]}
        onGenerate={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Crop damage' }));
    expect(onChange.mock.lastCall[0].incidentTypes).toEqual(['CROP_DAMAGE', 'SNARE_POACHING']);
    await user.click(screen.getByRole('checkbox', { name: 'All incidents' }));
    expect(onChange.mock.lastCall[0].incidentTypes).toEqual(ALL_TYPES);
  });

  it('generates on submit and describes each report type', async () => {
    const user = userEvent.setup();
    const { onGenerate } = setup();
    expect(screen.getByRole('radio', { name: 'Hotspot map' })).toHaveAccessibleDescription(
      'Where incidents cluster, as a density map.',
    );
    await user.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(onGenerate).toHaveBeenCalled();
  });

  it('shows one set-up screen at a time with Next and Back', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onBack = vi.fn();
    const { onGenerate } = setup({
      step: 'type',
      onNext,
      onBack,
      value: { ...defaultFilters('yala'), reportType: 'HOTSPOT_MAP' },
    });
    expect(screen.queryByLabelText('From')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalled();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('keeps Next disabled until a report type is chosen', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const { onChange } = setup({ step: 'type', onNext });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    expect(next).toHaveAttribute('title', 'Choose a report type first');
    await user.click(screen.getByRole('radio', { name: 'Incident summary' }));
    expect(onChange.mock.lastCall[0].reportType).toBe('INCIDENT_SUMMARY');
    expect(onNext).not.toHaveBeenCalled();
  });

  it('shows the criteria screen with Back and Generate', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { onGenerate } = setup({ step: 'criteria', onBack });
    expect(screen.queryByRole('radio', { name: 'Hotspot map' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Generate report' }));
    expect(onGenerate).toHaveBeenCalled();
  });

  it('resets the criteria to the defaults but keeps the report type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterBar
        value={{
          ...defaultFilters('yala'),
          dateFrom: '2025-01-01',
          reportType: 'PATROL_COVERAGE',
          incidentTypes: [],
        }}
        onChange={onChange}
        parks={[PARK]}
        onGenerate={vi.fn()}
        step="criteria"
      />,
    );
    expect(screen.getByText('0 of 6 selected')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...defaultFilters('yala'), reportType: 'PATROL_COVERAGE' });
  });

  it('highlights invalid fields with the hint (E1) and shows progress', () => {
    setup({
      errors: {
        dateTo: '"To" date is before "From" date.',
        incidentTypes: 'Choose at least one incident type.',
      },
      generating: true,
    });
    expect(screen.getByLabelText('To')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('To')).toHaveAccessibleDescription('"To" date is before "From" date.');
    expect(screen.getByText('Choose at least one incident type.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });
});

describe('KpiTiles', () => {
  it('shows the four KPIs and an honest "no patrol data" tile', () => {
    const report = makeReport();
    render(<KpiTiles stats={report.stats} coverage={report.coverage} />);
    expect(screen.getByTestId('kpi-incidents')).toHaveTextContent('184+12% vs previous period');
    expect(screen.getByText('+12% vs previous period')).toHaveClass('kpi-trend-up');
    expect(screen.getByTestId('kpi-verified')).toHaveTextContent('57of 81 received');
    expect(screen.getByTestId('kpi-coverage')).toHaveTextContent('No patrol data yet');
    expect(screen.getByTestId('kpi-conflict')).toHaveTextContent('68events · 2 injuries');
  });

  it('shows coverage once patrol data exists, and no comparison without a previous period', () => {
    render(
      <KpiTiles
        stats={{ ...makeReport().stats, changePercent: null }}
        coverage={{ available: true, coveragePercent: 71, unpatrolledSectors: [{ name: 'Sector 4' }] }}
      />,
    );
    expect(screen.getByTestId('kpi-coverage')).toHaveTextContent('71%1 sector(s) not patrolled > 14 days');
    expect(screen.getByTestId('kpi-incidents')).toHaveTextContent('No data for the previous period');
  });
});

describe('HotspotMap', () => {
  it('draws the park, one rectangle per cell in its level colour, villages and a numeric legend', () => {
    render(<HotspotMap report={makeReport()} />);
    expect(screen.getByTestId('tiles').dataset.url).toContain('openstreetmap.org');
    expect(screen.getByTestId('park-outline').dataset.points).toBe('3');
    const cells = screen.getAllByTestId('heat-cell');
    expect(cells.map((c) => c.dataset.color)).toEqual([HEAT_COLORS[4], HEAT_COLORS[0]]);
    expect(screen.getByTestId('village')).toHaveTextContent('Palatupana');
    expect(screen.getByTestId('heatmap-legend')).toHaveTextContent(/0\.32.*1\.3.*5\.1\+/);
    expect(screen.getByRole('img', { name: /Highest density 6\.4 incidents per km²/ })).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('leaflet-map').dataset.bounds)).toEqual([
      [6.22, 81.26],
      [6.38, 81.42],
    ]);
  });

  it('can hide the heatmap and keeps the patrol layers disabled without UC1 data', async () => {
    const user = userEvent.setup();
    render(<HotspotMap report={makeReport()} />);
    expect(screen.getByRole('checkbox', { name: 'Coverage gaps' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Patrol tracks' })).toBeDisabled();
    expect(screen.getByText(/appear when patrol data \(UC1\) is connected/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Heatmap' }));
    expect(screen.queryAllByTestId('heat-cell')).toHaveLength(0);
  });

  it('lists coverage gaps when patrol data exists', async () => {
    const user = userEvent.setup();
    const coverage = { available: true, coveragePercent: 50, unpatrolledSectors: [{ name: 'Sector 4' }] };
    render(<HotspotMap report={makeReport({ coverage })} />);
    expect(screen.getByTestId('coverage-gaps')).toHaveTextContent('Sector 4');
    await user.click(screen.getByRole('checkbox', { name: 'Coverage gaps' }));
    expect(screen.queryByTestId('coverage-gaps')).toBeNull();
  });

  it('falls back to the heatmap bounds and says when there are no hotspots', () => {
    const report = makeReport({
      park: { ...PARK, boundary: [] },
      heatmap: { bandwidthMetres: 500, bounds: { minLat: 1, maxLat: 2, minLng: 3, maxLng: 4 }, cells: [] },
      landmarks: undefined,
    });
    render(<HotspotMap report={report} />);
    expect(JSON.parse(screen.getByTestId('leaflet-map').dataset.bounds)).toEqual([
      [1, 3],
      [2, 4],
    ]);
    expect(screen.getByText('No hotspots for these filters.')).toBeInTheDocument();
    expect(screen.queryByTestId('park-outline')).toBeNull();
  });

  it('renders no map without any bounds', () => {
    render(
      <HotspotMap
        report={makeReport({ park: { ...PARK, boundary: [] }, heatmap: { bandwidthMetres: 500, cells: [] } })}
      />,
    );
    expect(screen.queryByTestId('leaflet-map')).toBeNull();
  });
});

describe('ConflictTrendChart', () => {
  it('draws conflict events per month and names the peak month', () => {
    render(<ConflictTrendChart trends={makeReport().trends} />);
    expect(screen.getByRole('img', { name: 'Area chart of conflict events per month.' })).toBeInTheDocument();
    expect(screen.getByTestId('trend-peak')).toHaveTextContent('Peak month: Aug (32 events)');
  });

  it('labels months with the year when the range spans years, and handles no events', () => {
    const trends = {
      months: ['2025-12', '2026-01'],
      series: [{ type: 'CROP_DAMAGE', counts: [1, 2] }],
      totals: [1, 2],
    };
    const { container } = render(<ConflictTrendChart trends={trends} />);
    expect(container).toHaveTextContent('Dec 25');
    render(<ConflictTrendChart trends={{ months: ['2026-06'], series: [], totals: [0] }} />);
    expect(screen.getByText('No conflict events in this period.')).toBeInTheDocument();
  });
});

describe('ConflictTypeBars', () => {
  it('lists only the conflict types that occurred, largest first', () => {
    const { unmount } = render(<ConflictTypeBars trends={makeReport().trends} />);
    expect(screen.getAllByTestId('type-bar').map((bar) => bar.textContent)).toEqual([
      'Crop damage39',
      'Elephant near village29',
    ]);
    unmount();
    render(<ConflictTypeBars trends={{ months: [], series: [], totals: [] }} />);
    expect(screen.getByText('No conflict events in this period.')).toBeInTheDocument();
  });
});

describe('ReportInsights', () => {
  it('points at the busiest hotspot and any unpatrolled sectors', () => {
    const report = makeReport({
      coverage: {
        available: true,
        coveragePercent: 71,
        patrolHours: 120,
        unpatrolledSectors: [{ id: 's4', name: 'Sector 4' }],
      },
    });
    render(<ReportInsights report={report} />);
    const attention = screen.getByTestId('insight-attention');
    expect(attention).toHaveTextContent('Palatupana has the most incidents (41), mostly crop damage.');
    expect(attention).toHaveTextContent('Not patrolled for more than 14 days: Sector 4');
    expect(screen.getByText(/500 m bandwidth/)).toBeInTheDocument();
  });
});

describe('TopHotspotsTable and ReportNotice', () => {
  it('lists hotspots, or says there are none', () => {
    const { unmount } = render(<TopHotspotsTable rows={makeReport().topHotspots} totalIncidents={184} />);
    const row = screen.getAllByRole('row')[1];
    expect(
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['Palatupana', '41', '22%', 'Crop damage', 'High']);
    unmount();
    render(<TopHotspotsTable rows={[]} />);
    expect(screen.getByText('No hotspots yet.')).toBeInTheDocument();
  });

  it('shows a notice with an optional action', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <ReportNotice
        tone="warning"
        title="No records"
        message="hint"
        actionLabel="Widen"
        onAction={onAction}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No recordshint');
    await user.click(screen.getByRole('button', { name: 'Widen' }));
    expect(onAction).toHaveBeenCalled();
    render(<ReportNotice tone="info" title="Idle" />);
    expect(screen.getByRole('status')).toHaveTextContent('Idle');
  });
});

describe('ExportDialog', () => {
  it('exports with the chosen format and sections, in a fixed order', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ExportDialog open onCancel={vi.fn()} onExport={onExport} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(screen.getByText(/Reporter phone numbers are never exported/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /CSV/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Individual incident list' }));
    await user.click(screen.getByRole('checkbox', { name: 'Hotspot map' }));
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(onExport).toHaveBeenCalledWith({
      format: 'CSV',
      sections: ['KPI_SUMMARY', 'COVERAGE_GAPS', 'CONFLICT_TRENDS', 'INCIDENT_LIST'],
    });
  });

  it('needs at least one section, can be cancelled, and closes', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { rerender } = render(
      <ExportDialog open initialFormat="CSV" onCancel={onCancel} onExport={vi.fn()} />,
    );
    for (const name of ['KPI summary', 'Hotspot map', 'Coverage gaps', 'Conflict trends']) {
      await user.click(screen.getByRole('checkbox', { name }));
    }
    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one section.');
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();

    rerender(<ExportDialog open={false} initialFormat="CSV" onCancel={onCancel} onExport={vi.fn()} />);
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('closes on Escape through the cancel event and shows progress while exporting', () => {
    const onCancel = vi.fn();
    render(<ExportDialog open busy onCancel={onCancel} onExport={vi.fn()} />);
    screen.getByRole('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });
});

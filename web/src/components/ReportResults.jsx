import { useTranslation } from 'react-i18next';
import { REPORT_TYPES } from '../constants';
import { ConflictTrendChart } from './ConflictTrendChart';
import { ConflictTypeBars } from './ConflictTypeBars';
import { CountBars } from './CountBars';
import { CoveragePanel } from './CoveragePanel';
import { HotspotMap } from './HotspotMap';
import { IncidentsByMonthChart } from './IncidentsByMonthChart';
import { KpiTiles } from './KpiTiles';
import { ReportInsights } from './ReportInsights';
import { TopHotspotsTable } from './TopHotspotsTable';

/**
 * Results (step 3), laid out for the chosen report type: the wide column leads with what
 * the type is about, the narrow column holds the KPI tiles (in the type's order) and notes.
 *   Incident summary         – incidents by type, per month, per sector
 *   Hotspot map              – large map and the top hotspots
 *   Patrol coverage          – unpatrolled sectors, the map with its coverage-gaps layer, incidents per sector
 *   Human–wildlife conflict  – conflict over time, conflict by type, top hotspots
 * @param {{ report: object }} props
 */
export function ReportResults({ report }) {
  const { t } = useTranslation();
  const { stats, coverage } = report;

  const byType = (
    <CountBars
      key="byType"
      testId="incidents-by-type"
      title={t('analytics.byType.title')}
      aside={t('analytics.types.total', { count: (stats.byType ?? []).filter((r) => r.count > 0).length })}
      empty={t('analytics.noIncidents')}
      rows={(stats.byType ?? []).map((row) => ({
        key: row.type,
        label: t(`incidentTypes.${row.type}`),
        count: row.count,
      }))}
    />
  );
  const bySector = (
    <CountBars
      key="bySector"
      testId="incidents-by-sector"
      title={t('analytics.bySector.title')}
      aside={t('analytics.bySector.aside', { count: (stats.bySector ?? []).length })}
      empty={t('analytics.noIncidents')}
      rows={(stats.bySector ?? []).map((row) => ({ key: row.sectorId, label: row.name, count: row.count }))}
    />
  );
  const byMonth = <IncidentsByMonthChart key="byMonth" byMonth={stats.byMonth} />;
  const map = <HotspotMap key="map" report={report} />;
  const hotspots = (
    <TopHotspotsTable key="hotspots" rows={report.topHotspots} totalIncidents={stats.totalIncidents} />
  );
  const conflictTrend = <ConflictTrendChart key="conflictTrend" trends={report.trends} />;
  const conflictTypes = <ConflictTypeBars key="conflictTypes" trends={report.trends} />;
  const coveragePanel = <CoveragePanel key="coverage" coverage={coverage} />;
  const kpis = (tiles) => <KpiTiles key="kpis" stats={stats} coverage={coverage} tiles={tiles} />;
  const insights = <ReportInsights key="insights" report={report} />;

  const layouts = {
    [REPORT_TYPES.INCIDENT_SUMMARY]: {
      main: [byType, byMonth, bySector],
      side: [kpis(['incidents', 'verified', 'conflict', 'coverage']), insights],
    },
    [REPORT_TYPES.HOTSPOT_MAP]: {
      main: [map, hotspots],
      side: [kpis(['incidents', 'verified', 'conflict', 'coverage']), insights],
    },
    [REPORT_TYPES.PATROL_COVERAGE]: {
      main: [coveragePanel, map, bySector],
      side: [kpis(['coverage', 'patrolHours', 'incidents', 'verified']), insights],
    },
    [REPORT_TYPES.HUMAN_WILDLIFE_CONFLICT]: {
      main: [conflictTrend, conflictTypes, hotspots],
      side: [kpis(['conflict', 'incidents', 'verified', 'coverage']), insights],
    },
  };
  const layout = layouts[report.filter.reportType] ?? layouts[REPORT_TYPES.HOTSPOT_MAP];

  return (
    <div className="results" data-testid="report" data-report-type={report.filter.reportType}>
      <div className="results-main">{layout.main}</div>
      <div className="results-side">{layout.side}</div>
    </div>
  );
}

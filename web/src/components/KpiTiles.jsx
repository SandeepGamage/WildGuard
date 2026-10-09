import { useTranslation } from 'react-i18next';
import { ANALYTICS_RULES } from '../constants';
import { formatChange } from '../utils/analytics';
import { ArrowDownIcon, ArrowUpIcon } from './Icons';

// More incidents is bad news, fewer is good: the change line is coloured and arrowed to match.
const TREND = {
  up: { className: 'kpi-trend kpi-trend-up', Icon: ArrowUpIcon },
  down: { className: 'kpi-trend kpi-trend-down', Icon: ArrowDownIcon },
};

function Tile({ label, value, note, trend, muted = false, testId }) {
  const style = trend ? TREND[trend] : null;
  return (
    <section className="card kpi" data-testid={testId} aria-label={label}>
      <h3 className="kpi-label">{label}</h3>
      <span className={muted ? 'kpi-value muted-value' : 'kpi-value'}>{value}</span>
      <span className={style ? style.className : 'kpi-note'}>
        {style ? <style.Icon size={16} /> : null}
        {note}
      </span>
    </section>
  );
}

/** Tile keys, in the order they are shown when a report type does not choose one. */
export const KPI_TILES = Object.freeze(['incidents', 'verified', 'coverage', 'conflict']);

/**
 * KPI row (wireframe A1, marker 2): incidents, verified community reports,
 * patrol coverage, patrol hours and human–elephant conflict (R12, R13).
 * `tiles` picks which tiles to show and in what order, so each report type leads with its own measure.
 * @param {{ stats: object, coverage: object, tiles?: string[] }} props
 */
export function KpiTiles({ stats, coverage, tiles = KPI_TILES }) {
  const { t } = useTranslation();
  const change = formatChange(stats.changePercent);
  const render = {
    incidents: () => (
      <Tile
        key="incidents"
        testId="kpi-incidents"
        label={t('analytics.kpi.incidents')}
        value={stats.totalIncidents}
        note={change ? t('analytics.kpi.vsPrevious', { change }) : t('analytics.kpi.noPrevious')}
        trend={stats.changePercent > 0 ? 'up' : stats.changePercent < 0 ? 'down' : undefined}
      />
    ),
    verified: () => (
      <Tile
        key="verified"
        testId="kpi-verified"
        label={t('analytics.kpi.verifiedReports')}
        value={stats.communityReports.verified}
        note={t('analytics.kpi.ofReceived', { count: stats.communityReports.received })}
      />
    ),
    coverage: () =>
      coverage.available ? (
        <Tile
          key="coverage"
          testId="kpi-coverage"
          label={t('analytics.kpi.patrolCoverage')}
          value={`${coverage.coveragePercent}%`}
          note={t('analytics.kpi.notPatrolled', {
            count: coverage.unpatrolledSectors.length,
            days: ANALYTICS_RULES.UNPATROLLED_DAYS,
          })}
        />
      ) : (
        <Tile
          key="coverage"
          testId="kpi-coverage"
          muted
          label={t('analytics.kpi.patrolCoverage')}
          value={t('analytics.kpi.noPatrolData')}
          note={t('analytics.kpi.patrolPending')}
        />
      ),
    patrolHours: () => (
      <Tile
        key="patrolHours"
        testId="kpi-patrol-hours"
        muted={!coverage.available}
        label={t('analytics.kpi.patrolHours')}
        value={coverage.available ? (coverage.patrolHours ?? 0) : t('analytics.kpi.noPatrolData')}
        note={t('analytics.kpi.inPeriod')}
      />
    ),
    conflict: () => (
      <Tile
        key="conflict"
        testId="kpi-conflict"
        label={t('analytics.kpi.conflict')}
        value={stats.conflictEvents}
        note={t('analytics.kpi.conflictNote', { count: stats.injuries })}
      />
    ),
  };
  return <div className="kpis">{tiles.map((key) => render[key]?.())}</div>;
}

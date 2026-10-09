import { useTranslation } from 'react-i18next';
import { ANALYTICS_RULES } from '../constants';

/**
 * Coverage gaps (patrol coverage report): the sectors not patrolled for longer than the
 * limit, with when each was last patrolled. Coverage % and patrol hours are in the KPI tiles.
 * @param {{ coverage: { available: boolean,
 *   unpatrolledSectors: Array<{ name: string, lastPatrolledAt: string | null, daysSincePatrol: number | null }> } }} props
 */
export function CoveragePanel({ coverage }) {
  const { t } = useTranslation();
  const days = ANALYTICS_RULES.UNPATROLLED_DAYS;
  const gaps = coverage.available ? coverage.unpatrolledSectors : [];
  const title = t('analytics.coverage.gapsTitle', { days });

  return (
    <section className="card panel" aria-label={title} data-testid="coverage-panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {coverage.available ? (
          <span className="panel-aside">{t('analytics.bySector.aside', { count: gaps.length })}</span>
        ) : null}
      </div>
      {!coverage.available ? (
        <p className="muted">{t('analytics.coverage.unavailable')}</p>
      ) : gaps.length === 0 ? (
        <p className="muted">{t('analytics.coverage.noGaps', { days })}</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('analytics.coverage.sector')}</th>
                <th scope="col">{t('analytics.coverage.lastPatrolled')}</th>
                <th scope="col" className="num">
                  {t('analytics.coverage.daysSince')}
                </th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((gap) => (
                <tr key={gap.name}>
                  <td className="strong">{gap.name}</td>
                  <td>
                    {gap.lastPatrolledAt
                      ? new Date(gap.lastPatrolledAt).toISOString().slice(0, 10)
                      : t('analytics.coverage.never')}
                  </td>
                  <td className="num">{gap.daysSincePatrol ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

import { useTranslation } from 'react-i18next';
import { SERIES_COLORS } from '../constants';

/**
 * Conflict events by type over the whole period: one labelled bar per type that
 * occurred, longest first, with the count printed beside each bar.
 * @param {{ trends: { series: Array<{ type: string, counts: number[] }> } }} props
 */
export function ConflictTypeBars({ trends }) {
  const { t } = useTranslation();
  const rows = trends.series
    .map((s, index) => ({
      type: s.type,
      total: s.counts.reduce((sum, count) => sum + count, 0),
      color: SERIES_COLORS[index % SERIES_COLORS.length],
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
  const max = rows[0]?.total ?? 0;

  return (
    <section className="card panel" aria-label={t('analytics.types.title')}>
      <div className="panel-head">
        <h2>{t('analytics.types.title')}</h2>
        <span className="panel-aside">{t('analytics.types.total', { count: rows.length })}</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{t('analytics.trends.empty')}</p>
      ) : (
        <ul className="bar-list">
          {rows.map((row) => (
            <li key={row.type} data-testid="type-bar">
              <div className="bar-row">
                <span>{t(`incidentTypes.${row.type}`)}</span>
                <span className="strong">{row.total}</span>
              </div>
              <div className="bar-track" aria-hidden="true">
                <div
                  className="bar-fill"
                  style={{ width: `${(row.total / max) * 100}%`, background: row.color }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

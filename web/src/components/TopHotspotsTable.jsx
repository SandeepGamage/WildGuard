import { useTranslation } from 'react-i18next';
import { hotspotLevel } from '../utils/analytics';

/**
 * Top hotspots table (wireframe A1): area, incidents, share of all incidents, main
 * type and a level badge (high / medium / low relative to the busiest area).
 * @param {{ rows: Array<{ area: string, incidents: number, mainType: string }>, totalIncidents?: number }} props
 */
export function TopHotspotsTable({ rows, totalIncidents = 0 }) {
  const { t } = useTranslation();
  const max = rows.reduce((best, row) => Math.max(best, row.incidents), 0);

  return (
    <section className="card panel" aria-label={t('analytics.hotspots.title')}>
      <div className="panel-head">
        <h2>{t('analytics.hotspots.title')}</h2>
        <span className="panel-aside">{t('analytics.hotspots.count', { count: rows.length })}</span>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{t('analytics.hotspots.empty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('analytics.hotspots.area')}</th>
                <th scope="col" className="num">
                  {t('analytics.hotspots.incidents')}
                </th>
                <th scope="col" className="num">
                  {t('analytics.hotspots.share')}
                </th>
                <th scope="col">{t('analytics.hotspots.mainType')}</th>
                <th scope="col">{t('analytics.hotspots.level')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const level = hotspotLevel(row.incidents, max);
                return (
                  <tr key={row.area}>
                    <td className="strong">{row.area}</td>
                    <td className="num">{row.incidents}</td>
                    <td className="num">
                      {totalIncidents > 0 ? `${Math.round((row.incidents / totalIncidents) * 100)}%` : '–'}
                    </td>
                    <td className="muted">{t(`incidentTypes.${row.mainType}`)}</td>
                    <td>
                      <span className={`badge badge-${level}`}>{t(`analytics.levels.${level}`)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

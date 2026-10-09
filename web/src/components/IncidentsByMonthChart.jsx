import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS } from '../constants';
import { monthLabel } from '../utils/analytics';

/**
 * All incidents per month (incident summary): one column per month with a hover tooltip.
 * A single series, so the title names it and there is no legend; the busiest month is
 * also given in text.
 * @param {{ byMonth?: Array<{ month: string, count: number }> }} props
 */
export function IncidentsByMonthChart({ byMonth = [] }) {
  const { t } = useTranslation();
  const spansYears = byMonth.length > 0 && byMonth[0].month.slice(0, 4) !== byMonth.at(-1).month.slice(0, 4);
  const data = byMonth.map((row) => ({ month: monthLabel(row.month, spansYears), count: row.count }));
  const busiest = data.reduce((best, point) => (point.count > (best?.count ?? 0) ? point : best), null);

  return (
    <section
      className="card panel"
      aria-label={t('analytics.byMonth.title')}
      data-testid="incidents-by-month"
    >
      <div className="panel-head">
        <h2>{t('analytics.byMonth.title')}</h2>
        <span className="panel-aside">{t('analytics.trends.monthly')}</span>
      </div>
      {!busiest ? (
        <p className="muted">{t('analytics.noIncidents')}</p>
      ) : (
        <>
          <div className="chart-frame" role="img" aria-label={t('analytics.byMonth.a11y')}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ fill: CHART_COLORS.area }} />
                <Bar
                  dataKey="count"
                  name={t('analytics.hotspots.incidents')}
                  fill={CHART_COLORS.line}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="muted chart-note" data-testid="busiest-month">
            {t('analytics.byMonth.busiest', { month: busiest.month, count: busiest.count })}
          </p>
        </>
      )}
    </section>
  );
}

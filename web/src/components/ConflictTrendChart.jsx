import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLORS } from '../constants';
import { monthLabel } from '../utils/analytics';

/**
 * Human–elephant conflict over the period (wireframe A1, marker 5; R13): one area line
 * of conflict events per month with the peak month marked, a hover tooltip, and a
 * text legend that names the peak, so the chart never relies on colour alone.
 * @param {{ trends: { months: string[], totals: number[] } }} props
 */
export function ConflictTrendChart({ trends }) {
  const { t } = useTranslation();
  const spansYears =
    trends.months.length > 0 && trends.months[0].slice(0, 4) !== trends.months.at(-1).slice(0, 4);
  const data = trends.months.map((month, index) => ({
    month: monthLabel(month, spansYears),
    total: trends.totals[index] ?? 0,
  }));
  const peak = data.reduce((best, point) => (point.total > (best?.total ?? 0) ? point : best), null);

  return (
    <section className="card panel" aria-label={t('analytics.trends.title')}>
      <div className="panel-head">
        <h2>{t('analytics.trends.title')}</h2>
        <span className="panel-aside">{t('analytics.trends.monthly')}</span>
      </div>
      {!peak ? (
        <p className="muted">{t('analytics.trends.empty')}</p>
      ) : (
        <>
          <div className="chart-frame" role="img" aria-label={t('analytics.trends.a11y')}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip cursor={{ stroke: CHART_COLORS.grid }} />
                <Area
                  type="linear"
                  dataKey="total"
                  name={t('analytics.trends.series')}
                  stroke={CHART_COLORS.line}
                  strokeWidth={2}
                  fill={CHART_COLORS.area}
                  fillOpacity={1}
                  dot={{ r: 4, fill: '#ffffff', stroke: CHART_COLORS.line, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
                <ReferenceDot
                  x={peak.month}
                  y={peak.total}
                  r={5}
                  fill={CHART_COLORS.peak}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="legend">
            <span className="legend-item">
              <span className="swatch" style={{ background: CHART_COLORS.line }} />
              {t('analytics.trends.series')}
            </span>
            <span className="legend-item" data-testid="trend-peak">
              <span className="swatch" style={{ background: CHART_COLORS.peak }} />
              {t('analytics.trends.peak', { month: peak.month, count: peak.total })}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

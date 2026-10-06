import { useTranslation } from 'react-i18next';
import { ANALYTICS_RULES } from '../constants';

/**
 * Callouts beside the results: what needs attention (the busiest hotspot and any
 * unpatrolled sectors) and how the numbers are measured.
 * @param {{ report: { topHotspots: object[], coverage: object, heatmap?: object } }} props
 */
export function ReportInsights({ report }) {
  const { t } = useTranslation();
  const top = report.topHotspots[0];
  const gaps = report.coverage.available ? report.coverage.unpatrolledSectors : [];

  return (
    <>
      {top || gaps.length > 0 ? (
        <aside className="callout callout-warning" data-testid="insight-attention">
          <strong>{t('analytics.insights.attention')}</strong>
          {top ? (
            <p>
              {t('analytics.insights.topHotspot', {
                area: top.area,
                count: top.incidents,
                type: t(`incidentTypes.${top.mainType}`).toLowerCase(),
              })}
            </p>
          ) : null}
          {gaps.length > 0 ? (
            <p>
              {t('analytics.map.gapList', {
                days: ANALYTICS_RULES.UNPATROLLED_DAYS,
                sectors: gaps.map((gap) => gap.name).join(', '),
              })}
            </p>
          ) : null}
        </aside>
      ) : null}
      <aside className="callout callout-info">
        <strong>{t('analytics.insights.methodTitle')}</strong>
        <p>{t('analytics.insights.method', { bandwidth: report.heatmap?.bandwidthMetres ?? '-' })}</p>
      </aside>
    </>
  );
}

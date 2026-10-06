import { useTranslation } from 'react-i18next';
import { daysBefore, monthsBefore, toIsoDate } from '../utils/analytics';

/** Quick ranges ending today. The default report range (3 months) is one of them. */
const PRESETS = [
  { key: 'd7', from: (end) => daysBefore(end, 7) },
  { key: 'd30', from: (end) => daysBefore(end, 30) },
  { key: 'm3', from: (end) => monthsBefore(end, 3) },
  { key: 'y1', from: (end) => monthsBefore(end, 12) },
];

/**
 * Segmented period buttons (7D / 30D / 3 Months / 1 Year). Picking one rewrites the
 * From/To dates; a range edited by hand leaves none of them pressed.
 * @param {{ dateFrom: string, dateTo: string, onChange: (range: { dateFrom: string, dateTo: string }) => void,
 *   today?: Date }} props
 */
export function PeriodPresets({ dateFrom, dateTo, onChange, today = new Date() }) {
  const { t } = useTranslation();
  const end = toIsoDate(today);

  return (
    <div className="period-presets" role="group" aria-label={t('analytics.period.label')}>
      {PRESETS.map((preset) => {
        const active = dateTo === end && dateFrom === preset.from(end);
        return (
          <button
            key={preset.key}
            type="button"
            className={active ? 'period-preset active' : 'period-preset'}
            aria-pressed={active}
            aria-label={t(`analytics.period.${preset.key}Long`)}
            onClick={() => onChange({ dateFrom: preset.from(end), dateTo: end })}
          >
            {t(`analytics.period.${preset.key}`)}
          </button>
        );
      })}
    </div>
  );
}

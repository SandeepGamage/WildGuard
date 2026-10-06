import { useTranslation } from 'react-i18next';

export const STEPS = Object.freeze({
  TYPE: 'type',
  CRITERIA: 'criteria',
  RESULTS: 'results',
});
const ORDER = [STEPS.TYPE, STEPS.CRITERIA, STEPS.RESULTS];

/**
 * Report flow: 1. Report type, 2. Criteria, 3. Results. Steps before the current one
 * are done; Results opens only once a report exists. Export is an action on the results.
 * @param {{ current: string, hasReport: boolean, onSelect: (step: string) => void }} props
 */
export function ReportStepper({ current, hasReport, onSelect }) {
  const { t } = useTranslation();
  const currentIndex = ORDER.indexOf(current);

  return (
    <nav aria-label={t('analytics.steps.label')}>
      <ol className="stepper">
        {ORDER.map((step, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
          const locked = step === STEPS.RESULTS && !hasReport;
          return (
            <li key={step}>
              <button
                type="button"
                className={`step step-${state}`}
                aria-current={state === 'current' ? 'step' : undefined}
                disabled={locked}
                title={locked ? t('analytics.steps.needsReport') : undefined}
                onClick={() => onSelect(step)}
              >
                {index + 1}. {t(`analytics.steps.${step}`)}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

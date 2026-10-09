import { useTranslation } from 'react-i18next';

export const STEPS = Object.freeze({
  TYPE: 'type',
  CRITERIA: 'criteria',
  RESULTS: 'results',
});
const ORDER = [STEPS.TYPE, STEPS.CRITERIA, STEPS.RESULTS];

/**
 * Report flow: 1. Report type, 2. Criteria, 3. Results. Steps before the current one
 * are done; Criteria opens only once a report type is chosen, and Results only once a
 * report exists. Export is an action on the results.
 * @param {{ current: string, hasType: boolean, hasReport: boolean, onSelect: (step: string) => void }} props
 */
export function ReportStepper({ current, hasType, hasReport, onSelect }) {
  const { t } = useTranslation();
  const currentIndex = ORDER.indexOf(current);

  return (
    <nav aria-label={t('analytics.steps.label')}>
      <ol className="stepper">
        {ORDER.map((step, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
          const lockReason =
            step === STEPS.CRITERIA && !hasType
              ? 'needsType'
              : step === STEPS.RESULTS && !hasReport
                ? 'needsReport'
                : null;
          return (
            <li key={step}>
              <button
                type="button"
                className={`step step-${state}`}
                aria-current={state === 'current' ? 'step' : undefined}
                disabled={Boolean(lockReason)}
                title={lockReason ? t(`analytics.steps.${lockReason}`) : undefined}
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

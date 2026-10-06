import { useTranslation } from 'react-i18next';
import { INCIDENT_TYPES, REPORT_TYPES } from '../constants';
import { defaultFilters } from '../utils/analytics';
import { CalendarIcon, CheckIcon, PinIcon, ResetIcon, SlidersIcon } from './Icons';
import { PeriodPresets } from './PeriodPresets';

const ALL_TYPES = Object.values(INCIDENT_TYPES);

/** Types that matter most for safety get a tinted chip. */
const TYPE_TONES = { PERSON_INJURED: 'danger', SNARE_POACHING: 'warning' };

function FieldError({ id, message }) {
  return message ? (
    <span className="field-error" id={id} role="alert">
      {message}
    </span>
  ) : null;
}

/**
 * Report set-up (wireframe A1, marker 1), steps 1–2 of the report flow:
 * the report type, then the criteria (date range, park, incident types) and Generate.
 * `step` shows one of the two screens (with Next / Back), or both at once.
 * Invalid fields are highlighted with the server's hint (exception E1); the values
 * are never cleared on error.
 *
 * @param {{
 *   value: { dateFrom: string, dateTo: string, parkId: string, reportType: string, incidentTypes: string[] },
 *   onChange: (value: object) => void,
 *   parks: Array<{ id: string, name: string }>,
 *   errors?: Record<string, string>,
 *   onGenerate: () => void,
 *   generating?: boolean,
 *   step?: 'type' | 'criteria' | 'all',
 *   onNext?: () => void,
 *   onBack?: () => void,
 * }} props
 */
export function FilterBar({
  value,
  onChange,
  parks,
  errors = {},
  onGenerate,
  generating = false,
  step = 'all',
  onNext,
  onBack,
}) {
  const { t } = useTranslation();
  const set = (patch) => onChange({ ...value, ...patch });
  const allSelected = value.incidentTypes.length === ALL_TYPES.length;

  const toggleType = (type) => {
    const next = value.incidentTypes.includes(type)
      ? value.incidentTypes.filter((item) => item !== type)
      : [...value.incidentTypes, type];
    set({ incidentTypes: ALL_TYPES.filter((item) => next.includes(item)) });
  };

  // Back to the default criteria (first park, last 3 months, every type); the report type stays.
  const reset = () => onChange({ ...defaultFilters(parks[0]?.id ?? ''), reportType: value.reportType });

  const submit = (event) => {
    event.preventDefault();
    if (step === 'type') onNext?.();
    else onGenerate();
  };

  return (
    <form className="setup" onSubmit={submit} aria-label={t('analytics.filters.generate')}>
      {step !== 'criteria' ? (
        <fieldset className="card panel setup-section">
          <legend className="visually-hidden">{t('analytics.filters.reportType')}</legend>
          <h2 aria-hidden="true">{t('analytics.filters.reportType')}</h2>
          <div className="type-options" role="radiogroup">
            {Object.values(REPORT_TYPES).map((type) => {
              const selected = value.reportType === type;
              return (
                <label key={type} className={selected ? 'type-card selected' : 'type-card'}>
                  <input
                    type="radio"
                    name="reportType"
                    value={type}
                    checked={selected}
                    onChange={() => set({ reportType: type })}
                    aria-label={t(`analytics.reportTypes.${type}`)}
                    aria-describedby={`type-hint-${type}`}
                  />
                  <span className="type-title">{t(`analytics.reportTypes.${type}`)}</span>
                  <span className="type-hint" id={`type-hint-${type}`}>
                    {t(`analytics.reportTypeHints.${type}`)}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {step !== 'type' ? (
        <section className="card panel setup-section criteria" aria-label={t('analytics.steps.criteria')}>
          <div className="criteria-head">
            <span className="criteria-icon" aria-hidden="true">
              <SlidersIcon size={22} />
            </span>
            <div>
              <h2>{t('analytics.steps.criteria')}</h2>
              <p className="muted">{t('analytics.filters.criteriaHint')}</p>
            </div>
          </div>

          <div className="criteria-controls">
            <div className="control-pill park-pill">
              <PinIcon size={16} />
              <label className="visually-hidden" htmlFor="filter-park">
                {t('analytics.filters.park')}
              </label>
              <select
                id="filter-park"
                value={value.parkId}
                onChange={(e) => set({ parkId: e.target.value })}
                aria-invalid={Boolean(errors.parkId)}
                aria-describedby={errors.parkId ? 'err-parkId' : undefined}
                data-testid="filter-park"
              >
                {parks.map((park) => (
                  <option key={park.id} value={park.id}>
                    {park.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="control-pill period-pill">
              <PeriodPresets dateFrom={value.dateFrom} dateTo={value.dateTo} onChange={set} />
              <span className="period-divider" aria-hidden="true" />
              <div className="date-range" role="group" aria-label={t('analytics.filters.dateRange')}>
                <CalendarIcon size={16} />
                <label className="visually-hidden" htmlFor="filter-dateFrom">
                  {t('analytics.filters.dateFrom')}
                </label>
                <input
                  id="filter-dateFrom"
                  type="date"
                  value={value.dateFrom}
                  onChange={(e) => set({ dateFrom: e.target.value })}
                  aria-invalid={Boolean(errors.dateFrom)}
                  aria-describedby={errors.dateFrom ? 'err-dateFrom' : undefined}
                  data-testid="filter-dateFrom"
                />
                <span aria-hidden="true">–</span>
                <label className="visually-hidden" htmlFor="filter-dateTo">
                  {t('analytics.filters.dateTo')}
                </label>
                <input
                  id="filter-dateTo"
                  type="date"
                  value={value.dateTo}
                  onChange={(e) => set({ dateTo: e.target.value })}
                  aria-invalid={Boolean(errors.dateTo)}
                  aria-describedby={errors.dateTo ? 'err-dateTo' : undefined}
                  data-testid="filter-dateTo"
                />
              </div>
            </div>

            <button type="button" className="control-pill reset-button" onClick={reset}>
              <ResetIcon size={16} />
              {t('analytics.filters.reset')}
            </button>
          </div>
          {errors.parkId || errors.dateFrom || errors.dateTo ? (
            <div className="criteria-errors">
              <FieldError id="err-parkId" message={errors.parkId} />
              <FieldError id="err-dateFrom" message={errors.dateFrom} />
              <FieldError id="err-dateTo" message={errors.dateTo} />
            </div>
          ) : null}

          <fieldset className="types-row">
            <legend className="types-head">
              <span className="types-legend">
                {t('analytics.filters.incidentTypes')}{' '}
                <span className="types-hint">{t('analytics.filters.typesHint')}</span>
              </span>
              <span className="types-count">
                {t('analytics.filters.typesSelected', {
                  count: value.incidentTypes.length,
                  total: ALL_TYPES.length,
                })}
              </span>
            </legend>
            <div className="chips">
              <label className={allSelected ? 'chip chip-all selected' : 'chip chip-all'}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => set({ incidentTypes: allSelected ? [] : ALL_TYPES })}
                />
                {allSelected ? <CheckIcon size={14} /> : null}
                {t('analytics.filters.allTypes')}
              </label>
              {ALL_TYPES.map((type) => {
                const checked = value.incidentTypes.includes(type);
                const tone = TYPE_TONES[type] ? ` chip-${TYPE_TONES[type]}` : '';
                return (
                  <label key={type} className={`chip${tone}${checked ? ' selected' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleType(type)} />
                    {t(`incidentTypes.${type}`)}
                  </label>
                );
              })}
            </div>
            <FieldError id="err-incidentTypes" message={errors.incidentTypes} />
          </fieldset>
        </section>
      ) : null}

      <div className="page-footer">
        <p className="muted">{t('analytics.filters.hint')}</p>
        <div className="page-footer-actions">
          {step === 'criteria' && onBack ? (
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              {t('analytics.filters.back')}
            </button>
          ) : null}
          {step === 'type' ? (
            <button type="submit" className="btn btn-primary">
              {t('analytics.filters.next')}
            </button>
          ) : (
            <button type="submit" className="btn btn-primary" disabled={generating} aria-busy={generating}>
              {generating ? t('common.loading') : t('analytics.filters.generate')}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

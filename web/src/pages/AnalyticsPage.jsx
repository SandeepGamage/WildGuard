import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ConflictTrendChart } from '../components/ConflictTrendChart';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ConflictTypeBars } from '../components/ConflictTypeBars';
import { ExportDialog } from '../components/ExportDialog';
import { FilterBar } from '../components/FilterBar';
import { HotspotMap } from '../components/HotspotMap';
import { KpiTiles } from '../components/KpiTiles';
import { ReportInsights } from '../components/ReportInsights';
import { ReportNotice } from '../components/ReportNotice';
import { ReportStepper, STEPS } from '../components/ReportStepper';
import { TopHotspotsTable } from '../components/TopHotspotsTable';
import { EXPORT_FORMATS } from '../constants';
import { useExportReport, useGenerateReport, useParks, useSavedReport } from '../hooks/useAnalytics';
import { defaultFilters, fieldErrors, formatDateRange, widenFilters } from '../utils/analytics';
import { friendlyError } from '../utils/errors';

const otherFormat = (format) => (format === EXPORT_FORMATS.PDF ? EXPORT_FORMATS.CSV : EXPORT_FORMATS.PDF);

/**
 * UC4 – Conservation Data Analytics & Hotspot Mapping (wireframes A1–A3), as a
 * three-step flow: 1. report type and 2. criteria (set-up view) -> Generate ->
 * 3. results (KPIs, conflict trend, hotspots, map) with Export (PDF/CSV dialog).
 * A saved report opens straight on its results with `?reportId=`.
 */
export default function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const reportId = searchParams.get('reportId');

  const parks = useParks();
  const saved = useSavedReport(reportId);
  const generate = useGenerateReport();
  const exporter = useExportReport();

  const [filters, setFilters] = useState(() => defaultFilters());
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(false);
  const [setupStep, setSetupStep] = useState(STEPS.TYPE);
  const [dialog, setDialog] = useState({ open: false, format: EXPORT_FORMATS.PDF, key: 0 });
  const [exportFailedFormat, setExportFailedFormat] = useState(null);
  const [exportedFormat, setExportedFormat] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Opening a saved report shows it with the filters it was built from (adjusted once
  // per report, during render, rather than in an effect).
  // Reset dismisses the saved report straight away; the URL drops `?reportId=` a moment later.
  const [shownSavedId, setShownSavedId] = useState(null);
  const [dismissedSavedId, setDismissedSavedId] = useState(null);
  if (!reportId && (shownSavedId || dismissedSavedId)) {
    setShownSavedId(null);
    setDismissedSavedId(null);
  }
  const savedReport = saved.data && saved.data.id !== dismissedSavedId ? saved.data : null;
  if (savedReport?.filter && savedReport.id !== shownSavedId) {
    setShownSavedId(savedReport.id);
    setFilters((current) => ({ ...current, ...savedReport.filter }));
    setResult(null);
    setEditing(false);
  }

  const parkList = parks.data ?? [];
  const effectiveFilters = { ...filters, parkId: filters.parkId || parkList[0]?.id || '' };
  const report = result ? result.report : savedReport;
  const errors = fieldErrors(generate.error);
  const hasFieldErrors = Object.keys(errors).length > 0;
  const showResults = Boolean(report) && !editing && !generate.isPending;
  const step = showResults ? STEPS.RESULTS : setupStep;

  const run = (values) => {
    setExportFailedFormat(null);
    setExportedFormat(null);
    generate.mutate(values, {
      onSuccess: (data) => {
        setResult(data.empty ? { empty: true, filter: data.filter, report: null } : { report: data });
        setEditing(Boolean(data.empty));
      },
    });
  };

  const openExport = (format = EXPORT_FORMATS.PDF) =>
    setDialog((current) => ({ open: true, format, key: current.key + 1 }));
  const closeExport = () => setDialog((current) => ({ ...current, open: false }));

  const selectStep = (target) => {
    if (target === STEPS.RESULTS) {
      setEditing(false);
    } else {
      setSetupStep(target);
      setEditing(true);
    }
  };

  // Start the journey over: no report type, default criteria, no results, step 1.
  const startOver = () => {
    setConfirmReset(false);
    setFilters(defaultFilters());
    setResult(null);
    setEditing(false);
    setSetupStep(STEPS.TYPE);
    setExportFailedFormat(null);
    setExportedFormat(null);
    generate.reset();
    if (reportId) {
      setDismissedSavedId(reportId);
      setSearchParams({}, { replace: true });
    }
  };

  const runExport = ({ format, sections }) => {
    exporter.mutate(
      { reportId: report.id, format, sections },
      {
        onSuccess: () => {
          closeExport();
          setExportFailedFormat(null);
          setExportedFormat(format);
        },
        onError: () => {
          closeExport();
          setExportedFormat(null);
          setExportFailedFormat(format);
        },
      },
    );
  };

  if (parks.isLoading) {
    return (
      <p className="page-message" role="status">
        {t('common.loading')}
      </p>
    );
  }
  if (parks.isError) {
    return (
      <div className="page">
        <ReportNotice
          tone="danger"
          title={t('common.somethingWrong')}
          message={friendlyError(parks.error, t)}
          actionLabel={t('common.retry')}
          onAction={() => parks.refetch()}
          testId="notice-parks"
        />
      </div>
    );
  }

  return (
    <main className="page dashboard" data-testid="analytics-page">
      <header className="page-header">
        <ol className="breadcrumbs" aria-label={t('analytics.breadcrumb')}>
          <li>{t('shell.analytics')}</li>
          <li>{t('analytics.steps.setup')}</li>
          {showResults ? <li>{t('analytics.steps.results')}</li> : null}
        </ol>
        {showResults ? (
          <div className="page-header-row">
            <div className="page-header-text">
              <h1>
                {t('analytics.resultsTitle', {
                  type: t(`analytics.reportTypes.${report.filter.reportType}`),
                  range: formatDateRange(report.filter.dateFrom, report.filter.dateTo, i18n.language),
                })}
              </h1>
              <p className="muted" data-testid="report-meta">
                {report.park.name} · {report.filter.dateFrom} – {report.filter.dateTo} ·{' '}
                {t('analytics.hotspots.count', { count: report.topHotspots.length })} ·{' '}
                {t('analytics.states.generatedAt', { time: new Date(report.generatedAt).toLocaleString() })}
              </p>
            </div>
            <div className="page-footer-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(true)}>
                {t('analytics.reset.action')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => selectStep(STEPS.CRITERIA)}>
                {t('analytics.editCriteria')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => openExport()}>
                {t('analytics.filters.export')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1>{t('analytics.setupTitle')}</h1>
            <p className="muted">{t('analytics.setupSubtitle')}</p>
          </>
        )}
      </header>

      <ReportStepper
        current={step}
        hasType={Boolean(effectiveFilters.reportType)}
        hasReport={Boolean(report)}
        onSelect={selectStep}
      />

      {generate.isError && hasFieldErrors ? (
        <ReportNotice tone="danger" title={t('analytics.states.invalid')} testId="notice-invalid" />
      ) : null}
      {generate.isError && !hasFieldErrors ? (
        <ReportNotice
          tone="danger"
          title={t('analytics.states.unavailable')}
          message={
            generate.error?.code === 'DATA_SOURCE_UNAVAILABLE'
              ? t('analytics.states.unavailableHint')
              : friendlyError(generate.error, t)
          }
          actionLabel={t('common.retry')}
          onAction={() => run(effectiveFilters)}
          testId="notice-unavailable"
        />
      ) : null}
      {result?.empty && !generate.isError ? (
        <ReportNotice
          tone="warning"
          title={t('analytics.states.noData')}
          message={t('analytics.states.noDataHint', {
            from: result.filter.dateFrom,
            to: result.filter.dateTo,
          })}
          actionLabel={t('analytics.states.widen')}
          onAction={() => {
            const widened = widenFilters(effectiveFilters);
            setFilters(widened);
            run(widened);
          }}
          testId="notice-no-data"
        />
      ) : null}
      {showResults && exportFailedFormat ? (
        <ReportNotice
          tone="danger"
          title={t('analytics.states.exportFailed')}
          message={t('analytics.states.exportFailedHint', { format: otherFormat(exportFailedFormat) })}
          actionLabel={t('analytics.states.exportOther', { format: otherFormat(exportFailedFormat) })}
          onAction={() => openExport(otherFormat(exportFailedFormat))}
          testId="notice-export-failed"
        />
      ) : null}
      {showResults && exportedFormat ? (
        <ReportNotice
          tone="info"
          title={t('analytics.states.exported', { format: exportedFormat })}
          testId="notice-exported"
        />
      ) : null}

      {generate.isPending || (reportId && saved.isLoading) ? (
        <p className="page-message" role="status">
          {t('analytics.loadingReport')}
        </p>
      ) : null}

      {!showResults && !generate.isPending ? (
        <FilterBar
          value={effectiveFilters}
          onChange={setFilters}
          parks={parkList}
          errors={errors}
          onGenerate={() => run(effectiveFilters)}
          generating={generate.isPending}
          step={setupStep}
          onNext={() => selectStep(STEPS.CRITERIA)}
          onBack={() => selectStep(STEPS.TYPE)}
        />
      ) : null}

      {showResults ? (
        <>
          <div className="results" data-testid="report">
            <div className="results-main">
              <ConflictTrendChart trends={report.trends} />
              <ConflictTypeBars trends={report.trends} />
              <TopHotspotsTable rows={report.topHotspots} totalIncidents={report.stats.totalIncidents} />
            </div>
            <div className="results-side">
              <KpiTiles stats={report.stats} coverage={report.coverage} />
              <HotspotMap report={report} />
              <ReportInsights report={report} />
            </div>
          </div>
          <div className="page-footer">
            <p className="muted">
              {t('analytics.footer', {
                incidents: report.stats.totalIncidents,
                reports: report.stats.communityReports.received,
              })}
            </p>
          </div>
        </>
      ) : null}

      {showResults ? (
        <ConfirmDialog
          open={confirmReset}
          title={t('analytics.reset.title')}
          message={t('analytics.reset.message')}
          confirmLabel={t('analytics.reset.confirm')}
          onConfirm={startOver}
          onCancel={() => setConfirmReset(false)}
          testId="confirm-reset"
        />
      ) : null}

      {report ? (
        <ExportDialog
          key={dialog.key}
          open={dialog.open}
          initialFormat={dialog.format}
          busy={exporter.isPending}
          onCancel={closeExport}
          onExport={runExport}
        />
      ) : null}
    </main>
  );
}

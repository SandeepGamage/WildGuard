import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_EXPORT_SECTIONS, EXPORT_FORMATS, EXPORT_SECTIONS_BY_TYPE } from '../constants';
import { useExportReport, useSavedReport } from '../hooks/useAnalytics';
import { formatDateRange } from '../utils/analytics';
import { syncDialog } from '../utils/dialog';
import { friendlyError } from '../utils/errors';
import { ExportDialog } from './ExportDialog';
import { ReportNotice } from './ReportNotice';
import { ReportResults } from './ReportResults';

const otherFormat = (format) => (format === EXPORT_FORMATS.PDF ? EXPORT_FORMATS.CSV : EXPORT_FORMATS.PDF);

/**
 * A saved report in a pop-up (Saved reports → Open): the same per-type results as the
 * dashboard, with Export (PDF/CSV dialog, the report type's sections ticked) and Close.
 * Escape or Close dismisses it; the export dialog opens on top of it.
 * @param {{ reportId: string | null, onClose: () => void }} props `reportId` null keeps it closed.
 */
export function ReportDialog({ reportId, onClose }) {
  const { t, i18n } = useTranslation();
  const ref = useRef(null);
  const saved = useSavedReport(reportId);
  const exporter = useExportReport();
  const [exportDialog, setExportDialog] = useState({ open: false, format: EXPORT_FORMATS.PDF, key: 0 });
  const [exportFailedFormat, setExportFailedFormat] = useState(null);
  const open = Boolean(reportId);
  const report = saved.data;
  // The content (with its Leaflet map) is drawn one frame after the pop-up is shown, so the
  // map measures its real size. Drawn while hidden, it measures 0×0 and zooms all the way in.
  const [visible, setVisible] = useState(false);
  if (!open && visible) setVisible(false);

  useEffect(() => {
    if (ref.current) syncDialog(ref.current, open);
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // A new report starts without the previous one's export message.
  const [shownId, setShownId] = useState(reportId);
  if (reportId !== shownId) {
    setShownId(reportId);
    setExportFailedFormat(null);
    setExportDialog((current) => ({ ...current, open: false }));
  }

  const openExport = (format = EXPORT_FORMATS.PDF) =>
    setExportDialog((current) => ({ open: true, format, key: current.key + 1 }));
  const closeExport = () => setExportDialog((current) => ({ ...current, open: false }));
  const runExport = ({ format, sections }) => {
    exporter.mutate(
      { reportId: report.id, format, sections },
      {
        onSuccess: () => {
          closeExport();
          setExportFailedFormat(null);
        },
        onError: () => {
          closeExport();
          setExportFailedFormat(format);
        },
      },
    );
  };

  return (
    <dialog
      ref={ref}
      className="dialog report-dialog"
      aria-labelledby="report-dialog-title"
      data-testid="report-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open && visible ? (
        <>
          <header className="report-dialog-head">
            <div className="page-header-text">
              <h2 id="report-dialog-title">
                {report
                  ? t('analytics.resultsTitle', {
                      type: t(`analytics.reportTypes.${report.filter.reportType}`),
                      range: formatDateRange(report.filter.dateFrom, report.filter.dateTo, i18n.language),
                    })
                  : t('analytics.saved.title')}
              </h2>
              {report ? (
                <p className="muted" data-testid="report-dialog-meta">
                  {report.park.name} · {report.filter.dateFrom} – {report.filter.dateTo} ·{' '}
                  {t('analytics.states.generatedAt', { time: new Date(report.generatedAt).toLocaleString() })}
                </p>
              ) : null}
            </div>
            <div className="page-footer-actions">
              {/* Focus lands here when the content appears (it is drawn a frame after the pop-up opens). */}
              <button type="button" className="btn btn-secondary" onClick={onClose} autoFocus>
                {t('common.close')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!report}
                onClick={() => openExport()}
              >
                {t('analytics.filters.export')}
              </button>
            </div>
          </header>

          <div className="report-dialog-body">
            {exportFailedFormat ? (
              <ReportNotice
                tone="danger"
                title={t('analytics.states.exportFailed')}
                message={t('analytics.states.exportFailedHint', { format: otherFormat(exportFailedFormat) })}
                actionLabel={t('analytics.states.exportOther', { format: otherFormat(exportFailedFormat) })}
                onAction={() => openExport(otherFormat(exportFailedFormat))}
                testId="notice-export-failed"
              />
            ) : null}
            {saved.isLoading ? (
              <p className="page-message" role="status">
                {t('analytics.loadingReport')}
              </p>
            ) : null}
            {saved.isError ? (
              <ReportNotice
                tone="danger"
                title={t('common.somethingWrong')}
                message={friendlyError(saved.error, t)}
                actionLabel={t('common.retry')}
                onAction={() => saved.refetch()}
                testId="notice-report-error"
              />
            ) : null}
            {report ? <ReportResults report={report} /> : null}
          </div>

          {report ? (
            <ExportDialog
              key={exportDialog.key}
              open={exportDialog.open}
              initialFormat={exportDialog.format}
              defaultSections={EXPORT_SECTIONS_BY_TYPE[report.filter.reportType] ?? DEFAULT_EXPORT_SECTIONS}
              busy={exporter.isPending}
              onCancel={closeExport}
              onExport={runExport}
            />
          ) : null}
        </>
      ) : null}
    </dialog>
  );
}

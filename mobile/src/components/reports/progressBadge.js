import { INCIDENT_STATUS, REPORT_PROGRESS } from '../../constants/domain';

/**
 * Villager-facing pill for a report. Internal statuses are never shown:
 * only Received / Being checked / Verified / Not confirmed.
 * @returns {{ label: string, tone: 'neutral'|'warning'|'success'|'danger' }}
 */
export function progressBadge(report, t) {
  switch (report.progress) {
    case REPORT_PROGRESS.BEING_CHECKED:
      return { label: t('progress.BEING_CHECKED'), tone: 'warning' };
    case REPORT_PROGRESS.OUTCOME:
      return report.outcome?.decision === INCIDENT_STATUS.VERIFIED
        ? { label: t('progress.VERIFIED'), tone: 'success' }
        : { label: t('progress.NOT_CONFIRMED'), tone: 'neutral' };
    default:
      return { label: t('progress.RECEIVED'), tone: 'neutral' };
  }
}

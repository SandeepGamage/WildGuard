import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FolderIcon } from '../components/Icons';
import { ReportNotice } from '../components/ReportNotice';
import { ROUTES } from '../constants';
import { useSavedReports } from '../hooks/useAnalytics';
import { friendlyError } from '../utils/errors';

/** Reports this manager generated earlier. Opening one shows it on the dashboard, ready to export again. */
export default function SavedReportsPage() {
  const { t } = useTranslation();
  const reports = useSavedReports();
  const items = reports.data ?? [];

  return (
    <main className="page narrow">
      <header className="page-header">
        <div className="page-title">
          <FolderIcon size={28} />
          <div>
            <h1>{t('analytics.saved.title')}</h1>
            <p className="muted">{t('analytics.saved.subtitle')}</p>
          </div>
        </div>
      </header>

      {reports.isLoading ? (
        <p className="page-message" role="status">
          {t('common.loading')}
        </p>
      ) : null}
      {reports.isError ? (
        <ReportNotice
          tone="danger"
          title={t('common.somethingWrong')}
          message={friendlyError(reports.error, t)}
          actionLabel={t('common.retry')}
          onAction={() => reports.refetch()}
          testId="notice-saved-error"
        />
      ) : null}
      {reports.isSuccess && items.length === 0 ? <p className="muted">{t('analytics.saved.empty')}</p> : null}

      {items.length > 0 ? (
        <table className="table saved-table">
          <thead>
            <tr>
              <th scope="col">{t('analytics.saved.period')}</th>
              <th scope="col">{t('analytics.filters.park')}</th>
              <th scope="col">{t('analytics.filters.reportType')}</th>
              <th scope="col" className="num">
                {t('analytics.kpi.incidents')}
              </th>
              <th scope="col">{t('analytics.saved.generated')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('analytics.saved.open')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="strong">
                  {item.filter.dateFrom} – {item.filter.dateTo}
                </td>
                <td>{item.parkName}</td>
                <td>{t(`analytics.reportTypes.${item.filter.reportType}`)}</td>
                <td className="num">{item.totalIncidents}</td>
                <td className="muted">{new Date(item.generatedAt).toLocaleString()}</td>
                <td>
                  <Link className="btn btn-secondary btn-small" to={ROUTES.report(item.id)}>
                    {t('analytics.saved.open')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}

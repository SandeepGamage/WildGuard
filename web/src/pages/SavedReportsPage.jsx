import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { FolderIcon, SortIcon } from '../components/Icons';
import { ReportNotice } from '../components/ReportNotice';
import { SortMenu } from '../components/SortMenu';
import { ROUTES } from '../constants';
import { useSavedReports } from '../hooks/useAnalytics';
import {
  DEFAULT_SAVED_SORT,
  nextSort,
  SAVED_SORT_KEYS,
  SAVED_SORT_OPTIONS,
  sortSavedReports,
} from '../utils/analytics';
import { friendlyError } from '../utils/errors';

/** The sort lives in the URL (?sort=incidents&dir=asc), so it survives opening a report and coming back. */
function readSort(params) {
  const key = params.get('sort');
  const direction = params.get('dir');
  if (!SAVED_SORT_KEYS.includes(key) || !['asc', 'desc'].includes(direction)) return DEFAULT_SAVED_SORT;
  return { key, direction };
}

/** Column heading that sorts the table; `aria-sort` tells screen readers the current order. */
function SortableHeader({ column, label, sort, onSort, className }) {
  const { t } = useTranslation();
  const direction = sort.key === column ? sort.direction : null;
  const ariaSort = direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
  return (
    <th scope="col" className={className} aria-sort={ariaSort}>
      <button
        type="button"
        className={direction ? 'sort-button sorted' : 'sort-button'}
        onClick={() => onSort(column)}
        title={t('analytics.saved.sortBy', { column: label })}
      >
        {label}
        <SortIcon direction={direction} size={14} />
      </button>
    </th>
  );
}

/** Reports this manager generated earlier. Opening one shows it on the dashboard, ready to export again. */
export default function SavedReportsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const reports = useSavedReports();
  const sort = readSort(searchParams);
  const items = sortSavedReports(reports.data ?? [], sort, (type) => t(`analytics.reportTypes.${type}`));

  const applySort = (next) => {
    const isDefault = next.key === DEFAULT_SAVED_SORT.key && next.direction === DEFAULT_SAVED_SORT.direction;
    setSearchParams(isDefault ? {} : { sort: next.key, dir: next.direction }, { replace: true });
  };
  const changeSort = (column) => applySort(nextSort(sort, column));
  const sortId = `${sort.key}_${sort.direction}`;
  const sortOptions = SAVED_SORT_OPTIONS.map((option) => ({
    value: option.id,
    label: t(`analytics.saved.sort.options.${option.id}`),
  }));
  const header = (column, label, className) => (
    <SortableHeader column={column} label={label} sort={sort} onSort={changeSort} className={className} />
  );

  return (
    <main className="page narrow">
      <header className="page-header">
        <div className="page-header-row">
          <div className="page-title">
            <FolderIcon size={28} />
            <div>
              <h1>{t('analytics.saved.title')}</h1>
              <p className="muted">{t('analytics.saved.subtitle')}</p>
            </div>
          </div>
          {items.length > 0 ? (
            <SortMenu
              label={t('analytics.saved.sort.button')}
              buttonLabel={t('analytics.saved.sort.current', {
                option: t(`analytics.saved.sort.options.${sortId}`),
              })}
              options={sortOptions}
              value={sortId}
              onChange={(id) => applySort(SAVED_SORT_OPTIONS.find((option) => option.id === id))}
            />
          ) : null}
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
              {header('period', t('analytics.saved.period'))}
              {header('park', t('analytics.filters.park'))}
              {header('type', t('analytics.filters.reportType'))}
              {header('incidents', t('analytics.kpi.incidents'), 'num')}
              {header('generated', t('analytics.saved.generated'))}
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

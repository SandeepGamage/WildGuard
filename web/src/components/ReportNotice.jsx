/**
 * State banner in the report area (wireframe A3): no data, data source
 * unavailable, invalid filters, export failed. Each can carry one recovery action.
 * @param {{ tone: 'info'|'warning'|'danger', title: string, message?: string,
 *   actionLabel?: string, onAction?: () => void, testId?: string }} props
 */
export function ReportNotice({ tone, title, message, actionLabel, onAction, testId }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'info' ? 'status' : 'alert'} data-testid={testId}>
      <div className="notice-text">
        <strong>{title}</strong>
        {message ? <span>{message}</span> : null}
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="btn btn-secondary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

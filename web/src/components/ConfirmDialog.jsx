import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { syncDialog } from '../utils/dialog';

/**
 * Confirmation dialog for actions that discard work (e.g. starting a report over).
 * Uses the native <dialog> element, so Escape cancels and focus stays inside.
 * @param {{ open: boolean, title: string, message: string, confirmLabel: string,
 *   onConfirm: () => void, onCancel: () => void, testId?: string }} props
 */
export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, testId }) {
  const { t } = useTranslation();
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) syncDialog(ref.current, open);
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog dialog-confirm"
      aria-labelledby={`${testId}-title`}
      aria-describedby={`${testId}-message`}
      data-testid={testId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <h2 id={`${testId}-title`}>{title}</h2>
        <p id={`${testId}-message`} className="muted">
          {message}
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

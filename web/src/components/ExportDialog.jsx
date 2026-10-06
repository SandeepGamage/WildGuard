import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_EXPORT_SECTIONS, EXPORT_FORMATS, EXPORT_SECTIONS } from '../constants';

const FORMAT_HINT_KEYS = { PDF: 'analytics.export.pdfHint', CSV: 'analytics.export.csvHint' };

/** Open or close a <dialog>, also in environments without showModal (jsdom). */
function syncDialog(dialog, open) {
  if (open && !dialog.open) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  } else if (!open && dialog.open) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
}

/**
 * Export dialog (wireframe A2, UC4c): format, sections and the privacy note.
 * Uses the native <dialog> element, so Escape closes it and focus stays inside.
 * @param {{ open: boolean, initialFormat?: string, busy?: boolean,
 *   onCancel: () => void, onExport: (choice: { format: string, sections: string[] }) => void }} props
 */
export function ExportDialog({ open, initialFormat = EXPORT_FORMATS.PDF, busy = false, onCancel, onExport }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const [format, setFormat] = useState(initialFormat);
  const [sections, setSections] = useState(DEFAULT_EXPORT_SECTIONS);

  useEffect(() => {
    if (ref.current) syncDialog(ref.current, open);
  }, [open]);

  const toggle = (section) =>
    setSections((current) =>
      current.includes(section) ? current.filter((s) => s !== section) : [...current, section],
    );
  const ordered = Object.values(EXPORT_SECTIONS).filter((s) => sections.includes(s));

  const submit = (event) => {
    event.preventDefault();
    if (ordered.length) onExport({ format, sections: ordered });
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="export-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <form onSubmit={submit}>
        <h2 id="export-title">{t('analytics.export.title')}</h2>

        <fieldset>
          <legend className="field-label">{t('analytics.export.format')}</legend>
          <div className="format-options">
            {Object.values(EXPORT_FORMATS).map((value) => (
              <label key={value} className={value === format ? 'format selected' : 'format'}>
                <input
                  type="radio"
                  name="format"
                  value={value}
                  checked={value === format}
                  onChange={() => setFormat(value)}
                />
                <strong>{value}</strong>
                <span className="muted">{t(FORMAT_HINT_KEYS[value])}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="field-label">{t('analytics.export.include')}</legend>
          <div className="section-options">
            {Object.values(EXPORT_SECTIONS).map((section) => (
              <label key={section} className="check">
                <input
                  type="checkbox"
                  checked={sections.includes(section)}
                  onChange={() => toggle(section)}
                />
                {t(`analytics.export.sections.${section}`)}
              </label>
            ))}
          </div>
          {ordered.length === 0 ? (
            <p className="field-error" role="alert">
              {t('analytics.export.chooseSection')}
            </p>
          ) : null}
        </fieldset>

        <p className="privacy-note">{t('analytics.export.privacy')}</p>

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || ordered.length === 0}>
            {busy ? t('common.loading') : t('analytics.export.exportAs', { format })}
          </button>
        </div>
      </form>
    </dialog>
  );
}

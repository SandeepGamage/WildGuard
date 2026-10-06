import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../constants';
import { setLanguage } from '../i18n';

/** English / Sinhala / Tamil switch. */
export function LanguageSelect({ className = '' }) {
  const { t, i18n } = useTranslation();
  return (
    <select
      className={`language-select ${className}`}
      aria-label={t('common.language')}
      value={i18n.language}
      onChange={(e) => setLanguage(e.target.value)}
    >
      {LANGUAGES.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </select>
  );
}

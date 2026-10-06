import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import si from './si.json';
import ta from './ta.json';

export const LANGUAGE_STORAGE_KEY = 'wildguard_web_language';

function storedLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, si: { translation: si }, ta: { translation: ta } },
  lng: storedLanguage() ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Switch the dashboard language and remember it for next time. */
export function setLanguage(code) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // Storage blocked: the choice lasts for this session only.
  }
  document.documentElement.lang = code;
  return i18n.changeLanguage(code);
}

export default i18n;

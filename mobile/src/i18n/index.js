import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LANGUAGES } from '../constants/domain';
import en from './en.json';
import si from './si.json';
import ta from './ta.json';

const STORAGE_KEY = 'wildguard.language';
const SUPPORTED = Object.values(LANGUAGES);

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, si: { translation: si }, ta: { translation: ta } },
  lng: LANGUAGES.EN,
  fallbackLng: LANGUAGES.EN,
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Restore the language the user chose on a previous launch. */
export async function loadStoredLanguage() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED.includes(stored)) await i18n.changeLanguage(stored);
  } catch {
    // Storage can be unavailable; the app simply stays in English.
  }
}

/** Switch language immediately and remember the choice. */
export async function setLanguage(code) {
  if (!SUPPORTED.includes(code)) return;
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}

export default i18n;

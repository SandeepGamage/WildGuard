import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '../src/i18n/en.json';
import si from '../src/i18n/si.json';
import ta from '../src/i18n/ta.json';
import i18n, { loadStoredLanguage, setLanguage } from '../src/i18n';

function flatten(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe('localisation', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
    await AsyncStorage.clear();
  });

  it('has the same keys in English, Sinhala and Tamil', () => {
    const keys = flatten(en).sort();
    expect(flatten(si).sort()).toEqual(keys);
    expect(flatten(ta).sort()).toEqual(keys);
  });

  it('has no empty translations', () => {
    for (const resource of [en, si, ta]) {
      for (const key of flatten(resource)) {
        const value = key.split('.').reduce((node, part) => node[part], resource);
        expect(value.trim()).not.toBe('');
      }
    }
  });

  it('keeps interpolation placeholders in every language', () => {
    for (const key of flatten(en)) {
      const english = key.split('.').reduce((node, part) => node[part], en);
      const placeholders = english.match(/{{\w+}}/g) ?? [];
      for (const resource of [si, ta]) {
        const translated = key.split('.').reduce((node, part) => node[part], resource);
        for (const placeholder of placeholders) expect(translated).toContain(placeholder);
      }
    }
  });

  it('switches language and remembers the choice', async () => {
    await setLanguage('si');
    expect(i18n.t('tabs.home')).toBe(si.tabs.home);
    expect(await AsyncStorage.getItem('wildguard.language')).toBe('si');

    await setLanguage('ta');
    expect(i18n.t('tabs.home')).toBe(ta.tabs.home);
  });

  it('ignores unsupported language codes', async () => {
    await setLanguage('fr');
    expect(i18n.language).toBe('en');
  });

  it('restores the stored language on launch', async () => {
    await AsyncStorage.setItem('wildguard.language', 'ta');
    await loadStoredLanguage();
    expect(i18n.language).toBe('ta');
  });
});

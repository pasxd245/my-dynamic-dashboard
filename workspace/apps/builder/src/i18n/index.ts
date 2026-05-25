import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { appConfig } from '@/config';
import en from './locales/en.json';
import vi from './locales/vi.json';

// R32: i18n init runs once at module import.
// `lng` reads from values.yaml -> VITE_I18N_LOCALE -> appConfig.i18nLocale().
// `fallbackLng: 'en'` means missing keys in vi.json fall back to English
// (not the raw key, which would leak into the UI).
// `escapeValue: false` because React already escapes JSX text — double-escaping
// would render literal `&amp;`.
void i18n.use(initReactI18next).init({
  resources: {
    en: { common: en },
    vi: { common: vi },
  },
  lng: appConfig.i18nLocale(),
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export { i18n };

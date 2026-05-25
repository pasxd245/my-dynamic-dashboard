import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { appConfig } from '@/config';
import en from './locales/en.json';
import vi from './locales/vi.json';

// R32 add-on: localStorage key for the runtime locale-switcher. Reads
// take precedence over the rendered env-var so a user's flip survives
// reloads. Keep this in sync with `LocaleSwitcher.tsx`.
export const LOCALE_STORAGE_KEY = 'mdd.locale';

export const SUPPORTED_LOCALES = ['en', 'vi'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupported(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function resolveInitialLocale(): SupportedLocale {
  try {
    const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
    if (stored && isSupported(stored)) return stored;
  } catch {
    // Tests / SSR / privacy modes — fall through to env default.
  }
  const fromEnv = appConfig.i18nLocale();
  return isSupported(fromEnv) ? fromEnv : 'en';
}

// R32: i18n init runs once at module import.
// `lng` precedence: localStorage (`mdd.locale`) → values.yaml/VITE_I18N_LOCALE
// → 'en'. `fallbackLng: 'en'` means missing keys in vi.json fall back to
// English (not the raw key, which would leak into the UI).
// `escapeValue: false` because React already escapes JSX text — double-escaping
// would render literal `&amp;`.
void i18n.use(initReactI18next).init({
  resources: {
    en: { common: en },
    vi: { common: vi },
  },
  lng: resolveInitialLocale(),
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export { i18n };

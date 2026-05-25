import { GlobalOutlined } from '@ant-design/icons';
import { Button, Dropdown, type MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { LOCALE_STORAGE_KEY, SUPPORTED_LOCALES, type SupportedLocale } from './index';

/**
 * R32 add-on: runtime locale switcher. Header-right dropdown.
 *
 * - Calls `i18n.changeLanguage(...)` so all `useTranslation()` consumers
 *   re-render with the new translations.
 * - Persists the choice to `localStorage[mdd.locale]` so the picked
 *   locale survives reloads (read by `i18n/index.ts` at init).
 * - Renders the display label in its own language (English "English",
 *   Vietnamese "Tiếng Việt") so users recognise their own language even
 *   when the rest of the UI is in a different one.
 */

const LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

const SHORT_LABELS: Record<SupportedLocale, string> = {
  en: 'EN',
  vi: 'VI',
};

export function LocaleSwitcher() {
  const { i18n } = useTranslation();
  const current = (
    SUPPORTED_LOCALES.includes(i18n.language as SupportedLocale)
      ? i18n.language
      : 'en'
  ) as SupportedLocale;

  const items: MenuProps['items'] = SUPPORTED_LOCALES.map((code) => ({
    key: code,
    label: LABELS[code],
  }));

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    const next = key as SupportedLocale;
    if (next === current) return;
    void i18n.changeLanguage(next);
    try {
      globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Privacy modes / SSR — switch still takes effect in-memory.
    }
  };

  return (
    <Dropdown
      menu={{ items, selectedKeys: [current], onClick: handleClick }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button
        type="text"
        size="small"
        icon={<GlobalOutlined />}
        data-component="LocaleSwitcher"
        data-current={current}
        aria-label={`Current language: ${LABELS[current]}. Click to change.`}
      >
        {SHORT_LABELS[current]}
      </Button>
    </Dropdown>
  );
}

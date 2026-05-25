import { ConfigProvider } from "antd";
import type { Locale } from "antd/lib/locale";
import type { ReactNode } from "react";
import { themeTokens } from "../themeTokens";
import { ThemeStyle } from "./ThemeStyle";

type AntdConfigProps = {
  children: ReactNode;
  /**
   * Optional AntD locale pack — pass `enUS`/`viVN` etc. from
   * `antd/locale/*`. Defaults to AntD's built-in en_US fallback.
   * Kept as a prop (not internally resolved) so this `@mdd/ui`
   * package stays free of i18next coupling; the consuming app
   * passes whichever locale is active.
   */
  locale?: Locale;
};

export function AntdConfig({ children, locale }: Readonly<AntdConfigProps>) {
  return (
    <>
      <ThemeStyle />
      <ConfigProvider theme={themeTokens} locale={locale}>
        {children}
      </ConfigProvider>
    </>
  );
}

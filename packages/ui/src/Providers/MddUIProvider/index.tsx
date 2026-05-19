import { ConfigProvider, type ThemeConfig } from 'antd';
import type { Locale } from 'antd/es/locale/index.js';
import type { FC, PropsWithChildren } from 'react';
import {
  NavigationProvider,
  type NavigationDataContextType,
} from '../../Contexts/NavigationContext/index.tsx';
import { themeTokens as defaultTokens } from '../../themeTokens.ts';

export type MddUIProviderProps = PropsWithChildren<{
  theme?: ThemeConfig;
  locale?: Locale;
  initialNavigation?: Partial<NavigationDataContextType>;
}>;

function mergeTheme(override?: ThemeConfig): ThemeConfig {
  if (!override) return defaultTokens;
  return {
    ...defaultTokens,
    ...override,
    token: { ...defaultTokens.token, ...override.token },
    components: { ...defaultTokens.components, ...override.components },
  };
}

export const MddUIProvider: FC<MddUIProviderProps> = ({
  theme,
  locale,
  initialNavigation,
  children,
}) => (
  <ConfigProvider theme={mergeTheme(theme)} locale={locale}>
    <NavigationProvider initial={initialNavigation}>{children}</NavigationProvider>
  </ConfigProvider>
);

export default MddUIProvider;

import type { ThemeConfig } from "antd";
import { theme } from "antd";

/**
 * R95 — content-width caps (cap-and-center, mirrors AntD Pro
 * `contentWidth: Fixed|Fluid`). One home for the numbers so they are
 * tunable, not scattered literals (spiked on a real 4K panel before
 * locking). Consumed by `PageContainer`.
 *
 * - `contentWidthText` — narrow cap for forms / prose (~66 CPL).
 * - `contentWidthData` — generous cap for data-dense list/table catalogs.
 *
 * The canvas opts out entirely (`width="fluid"` → uncapped); it wants the
 * full width.
 */
export const layoutTokens = {
  contentWidthText: 960,
  contentWidthData: 1600,
} as const;

export const themeTokens: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#1677ff",
    colorBgBase: "#ffffff",
    colorTextBase: "#000000",
    borderRadius: 6,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
  },
};

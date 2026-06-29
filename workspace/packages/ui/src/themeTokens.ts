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
  // R101 — sidebar (WorkspaceShell) sizing. These are AntD component PROPS, not
  // ThemeConfig tokens (Layout.Sider `width`/`collapsedWidth`, Menu
  // `inlineIndent`), so they live here as app layout numbers — the same
  // "one tunable home, not scattered literals" pattern as the content widths —
  // and are fed to the components as props. `siderWidth` 300 (AntD's Sider
  // default is 200) + a tightened `siderInlineIndent` 16 (AntD default 24) give
  // the 3-level nav (Dashboards › ‹Workspace› › ‹Dashboard›) room.
  siderWidth: 300,
  siderCollapsedWidth: 64,
  siderInlineIndent: 16,
  // the header height (WorkspaceShell)
  headerHeight: 64,
  // R105 — Layout.Content padding (WorkspaceShell). Single-sourced so
  // PageContainer's fill height (`100svh − header − 2×padding`) tracks the
  // header instead of a hardcoded magic number that silently drifts (B3).
  contentPadding: 16,
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

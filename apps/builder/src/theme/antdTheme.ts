import type { ThemeConfig } from "antd";

/**
 * Master AntD theme — single source of truth for the builder app.
 *
 * - Brand palette + radius scale + typography are mirrored from
 *   `docs/agents/design/Styles.css`.
 * - Component overrides set the *standard* look. Surfaces that need a
 *   custom look should document the deviation in
 *   `docs/agents/design/design-guidelines.md` before diverging.
 *
 * Companion CSS variables live in `apps/builder/src/index.css`
 * (see `:root { --color-*, --radius-*, --shadow-card }`).
 */

const BRAND = {
  blue: "#4F45B6",
  yellow: "#F8C140",
  red: "#F84040",
  green: "#86F552",
  cyan: "#64C4F7",
  darkBlue: "#2D3845",
  ink: "#252525",

  // Lavender neutrals
  white: "#FFFFFF",
  gray1: "#F5EFFC",
  gray2: "#ECEEFB",
  gray3: "#D1D1D1",
  gray4: "#A098AE",
  border: "#E4DEEF",
} as const;

const RADIUS = { xs: 5, sm: 10, md: 10, lg: 20 } as const;

// Control sizing: 32 (compact) / 40 (default) / 48 (hero). See
// `docs/agents/design/design-guidelines.md § Sizing`.
const CONTROL = { sm: 32, md: 40, lg: 48 } as const;

const FONT_FAMILY =
  "'Cairo', 'Poppins', 'Nunito Sans', 'Segoe UI', system-ui, sans-serif";

const SHADOW = {
  card: "0 6px 16px rgba(55, 49, 95, 0.06)",
  brand: "0 20px 50px rgba(191, 21, 108, 0.05)",
} as const;

export const antdTheme: ThemeConfig = {
  token: {
    // Palette
    colorPrimary: BRAND.blue,
    colorInfo: BRAND.cyan,
    colorSuccess: BRAND.green,
    colorWarning: BRAND.yellow,
    colorError: BRAND.red,

    // Ink + surfaces
    colorTextBase: BRAND.darkBlue,
    colorBgBase: BRAND.white,
    colorBgLayout: "#F5F4F8",
    colorBorder: BRAND.border,
    colorBorderSecondary: BRAND.gray2,

    // Radius (5/10/15/20 from Styles.css → AntD seed scale)
    borderRadiusXS: RADIUS.xs,
    borderRadiusSM: RADIUS.sm,
    borderRadius: RADIUS.md,
    borderRadiusLG: RADIUS.lg,

    // Typography
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontSizeHeading1: 32,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    lineHeight: 1.5,

    // Unified control heights
    controlHeightSM: CONTROL.sm,
    controlHeight: CONTROL.md,
    controlHeightLG: CONTROL.lg,

    // Motion
    motionDurationFast: "0.12s",
    motionDurationMid: "0.18s",
    motionDurationSlow: "0.24s",

    // Shadow
    boxShadow: SHADOW.card,
    boxShadowSecondary: SHADOW.brand,
    boxShadowTertiary: SHADOW.card,
  },

  components: {
    Button: {
      borderRadius: RADIUS.lg,
      borderRadiusSM: RADIUS.sm,
      borderRadiusLG: RADIUS.lg,
      fontWeight: 600,
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
    },
    Input: {
      borderRadius: RADIUS.sm,
      paddingBlock: 8,
      hoverBorderColor: BRAND.blue,
      activeBorderColor: BRAND.blue,
    },
    InputNumber: {
      borderRadius: RADIUS.sm,
    },
    Select: {
      borderRadius: RADIUS.sm,
      multipleItemHeight: 24,
      optionSelectedBg: BRAND.gray1,
    },
    DatePicker: {
      borderRadius: RADIUS.sm,
    },
    Radio: {
      borderRadius: RADIUS.sm,
    },
    Checkbox: {
      borderRadius: RADIUS.xs,
    },
    Switch: {
      colorPrimary: BRAND.blue,
    },
    Form: {
      itemMarginBottom: 16,
      verticalLabelPadding: "0 0 4px",
      labelFontSize: 14,
      labelColor: BRAND.darkBlue,
    },

    // Layout primitives
    Layout: {
      bodyBg: "#F5F4F8",
      headerBg: BRAND.white,
      siderBg: "#F0EEF5",
      footerBg: BRAND.white,
      headerHeight: 64,
      headerPadding: "0 16px",
    },
    Menu: {
      itemBg: "transparent",
      subMenuItemBg: "transparent",
      itemSelectedBg: BRAND.white,
      itemSelectedColor: BRAND.darkBlue,
      itemHoverBg: BRAND.gray2,
      itemHoverColor: BRAND.blue,
      itemActiveBg: BRAND.white,
      itemBorderRadius: RADIUS.sm,
      itemHeight: 40,
      iconSize: 16,
    },
    Breadcrumb: {
      separatorColor: BRAND.gray4,
      lastItemColor: BRAND.darkBlue,
      linkColor: BRAND.gray4,
      linkHoverColor: BRAND.blue,
    },

    // Surfaces
    Card: {
      borderRadiusLG: RADIUS.lg,
      headerBg: BRAND.white,
    },
    Modal: {
      borderRadiusLG: RADIUS.lg,
      headerBg: BRAND.white,
    },
    Drawer: {
      borderRadiusLG: RADIUS.lg,
    },
    Popover: {
      borderRadiusLG: RADIUS.sm,
    },
    Tooltip: {
      borderRadius: RADIUS.xs,
    },

    // Status / feedback
    Alert: {
      borderRadiusLG: RADIUS.sm,
    },
    Tag: {
      borderRadiusSM: RADIUS.xs,
    },
    Badge: {
      colorBgContainer: BRAND.blue,
    },
    Message: {
      borderRadiusLG: RADIUS.sm,
    },
    Notification: {
      borderRadiusLG: RADIUS.sm,
    },
    Empty: {
      colorTextDescription: BRAND.gray4,
    },
    Spin: {
      colorPrimary: BRAND.blue,
    },

    // Navigation / data
    Tabs: {
      itemColor: BRAND.gray4,
      itemSelectedColor: BRAND.darkBlue,
      itemHoverColor: BRAND.blue,
      inkBarColor: BRAND.blue,
      titleFontSize: 14,
    },
    Steps: {
      iconSize: 28,
      titleLineHeight: 22,
      colorPrimary: BRAND.blue,
    },
    Pagination: {
      itemActiveBg: BRAND.white,
      borderRadius: RADIUS.sm,
    },
    Segmented: {
      itemSelectedBg: BRAND.white,
    },
  },
};

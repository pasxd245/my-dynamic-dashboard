import type { ThemeConfig } from "antd";
import { theme } from "antd";

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

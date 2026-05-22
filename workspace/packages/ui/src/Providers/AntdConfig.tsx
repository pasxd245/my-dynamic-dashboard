import { ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { themeTokens } from "../themeTokens";
import { ThemeStyle } from "./ThemeStyle";

type AntdConfigProps = {
  children: ReactNode;
};

export function AntdConfig({ children }: AntdConfigProps) {
  return (
    <>
      <ThemeStyle />
      <ConfigProvider theme={themeTokens}>{children}</ConfigProvider>
    </>
  );
}

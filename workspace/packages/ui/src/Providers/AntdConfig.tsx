import { ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { themeTokens } from "../themeTokens";

type AntdConfigProps = {
  children: ReactNode;
};

export function AntdConfig({ children }: AntdConfigProps) {
  return <ConfigProvider theme={themeTokens}>{children}</ConfigProvider>;
}

import { theme } from "antd";
import type { CSSProperties, ReactNode } from "react";

export type PageCardProps = {
  children: ReactNode;
  /**
   * R12 ships `default` only. `flush` is declared in the type so
   * future rounds can adopt the edge-drawing variant without a
   * breaking change; it is not implemented yet (per
   * "Default = don't add" — no consumer needs `flush` until a
   * page draws to the card edge).
   */
  variant?: "default" | "flush";
};

export function PageCard({
  children,
  variant = "default",
}: Readonly<PageCardProps>) {
  const { token } = theme.useToken();

  const style: CSSProperties = {
    background: token.colorBgContainer,
    borderRadius: token.borderRadiusLG,
    border: `1px solid ${token.colorBorderSecondary}`,
    boxShadow: token.boxShadow,
    padding: variant === "flush" ? 0 : 24,
    overflow: variant === "flush" ? "hidden" : undefined,
  };

  return (
    <section data-component="PageCard" data-variant={variant} style={style}>
      {children}
    </section>
  );
}

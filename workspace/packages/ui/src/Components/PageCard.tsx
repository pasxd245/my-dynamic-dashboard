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
   *
   * `fill` (R18) — the card becomes a flex column that fills the
   * remaining height of its parent. Used by routes whose parent
   * is a flex column with a fixed height (typically `calc(100vh
   * - chrome)`), so the card fits the viewport without a
   * hardcoded body max-height. Children render in the natural
   * flex flow: any direct child with `flex: 1 1 auto; min-height:
   * 0; overflow-y: auto` will scroll inside the bounded card.
   */
  variant?: "default" | "flush" | "fill";
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
    ...(variant === "fill"
      ? {
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }
      : {}),
  };

  return (
    <section data-component="PageCard" data-variant={variant} style={style}>
      {children}
    </section>
  );
}

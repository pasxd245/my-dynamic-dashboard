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
   * remaining height of its parent. **Reach for this variant
   * whenever the page needs ANY of:** (a) a control bar pinned
   * to the bottom (wizard nav, pagination footer, save bar);
   * (b) a sticky table/list header that should pin while the
   * body scrolls; (c) a scrollable middle section bounded by
   * fixed-height top and bottom sections. Without this variant,
   * `position: sticky` has no scroll container and bottom bars
   * float wherever content ends.
   *
   * Required parent shape (mirror exactly):
   * ```tsx
   * <div style={{
   *   height: 'calc(100vh - 88px)', // WorkspaceShell chrome
   *   display: 'flex', flexDirection: 'column', gap: 16,
   * }}>
   *   <PageHeader ... />
   *   <PageCard variant="fill">
   *     <div style={{ flex: '0 0 auto' }}>... top sections ...</div>
   *     <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto' }}>
   *       ... scrollable body (sticky headers stick HERE) ...
   *     </div>
   *     <div style={{ flex: '0 0 auto', borderTop: '1px solid ...' }}>
   *       ... bottom control bar ...
   *     </div>
   *   </PageCard>
   * </div>
   * ```
   *
   * Consumers: `DatasetNewPage` (R17, wizard nav footer),
   * `DatasetDetailPage` (R36, pagination footer + sticky table
   * header). See
   * `.agents/memory/2026-05-26-pagecard-fill-pattern-for-fixed-controls.md`
   * for the failure modes when this pattern is skipped.
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

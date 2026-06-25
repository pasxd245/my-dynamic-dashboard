import type { CSSProperties, ReactNode } from "react";
import { layoutTokens } from "../themeTokens";

export type PageContainerWidth = "data" | "text" | "fluid";

export type PageContainerProps = {
  children: ReactNode;
  /**
   * R95 (D3) — content-width cap, cap-and-center. Mirrors AntD Pro's
   * `contentWidth: Fixed|Fluid` so content doesn't sprawl edge-to-edge on
   * 2K/4K screens (unreadable line lengths, sparse rows):
   *
   * - `"data"` (default) — generous cap for data-dense list/table catalogs
   *   (`layoutTokens.contentWidthData`).
   * - `"text"` — narrow cap for forms / prose (~66 CPL,
   *   `layoutTokens.contentWidthText`).
   * - `"fluid"` — uncapped. The exception: the **canvas** wants the full
   *   width, so its host page passes `"fluid"`.
   *
   * Empty gutters fall on the shell's `colorBgLayout` (the `Layout.Content`
   * background), so the cap reads as intentional whitespace, not a
   * left-aligned / cut-off page.
   */
  width?: PageContainerWidth;
  /**
   * R95 (D2) — fill a tall viewport but grow + document-scroll on a short
   * one. Replaces the detail/builder page wrapper's hard
   * `height: calc(100vh - 88px)` with a `min-height`: a tall viewport still
   * fills (a `PageCard variant="fill"` child stretches as before), while a
   * short viewport overflows into the shell's document scroll instead of
   * cramping the inner region. Use on pages that hold a
   * `PageCard variant="fill"`.
   */
  fill?: boolean;
  /**
   * Overrides the root `data-component` attribute. Pages that previously
   * owned their wrapper `<div data-component="…">` pass their name through
   * so DOM identity (and the tests/tooling that query it) is preserved.
   * Defaults to `"PageContainer"`.
   */
  dataComponent?: string;
};

// WorkspaceShell chrome: Layout.Header (56) + Layout.Content padding (16×2).
const SHELL_CHROME_PX = 88;

function maxWidthFor(width: PageContainerWidth): number | undefined {
  switch (width) {
    case "fluid":
      return undefined;
    case "text":
      return layoutTokens.contentWidthText;
    case "data":
    default:
      return layoutTokens.contentWidthData;
  }
}

export function PageContainer({
  children,
  width = "data",
  fill = false,
  dataComponent = "PageContainer",
}: Readonly<PageContainerProps>) {
  const style: CSSProperties = {
    maxWidth: maxWidthFor(width),
    width: "100%",
    // Cap-and-center; on a fluid (uncapped) container this is a no-op.
    marginInline: "auto",
    ...(fill
      ? {
          // D2: `min-height`, not hard `height` — a tall viewport fills (the
          // `variant="fill"` child stretches), a short one document-scrolls.
          minHeight: `calc(100svh - ${SHELL_CHROME_PX}px)`,
          display: "flex",
          flexDirection: "column",
        }
      : {}),
  };

  return (
    <div data-component={dataComponent} data-width={width} style={style}>
      {children}
    </div>
  );
}

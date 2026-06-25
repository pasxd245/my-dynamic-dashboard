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
   * Fill the viewport-minus-chrome region as a flex column (for pages that
   * hold a `PageCard variant="fill"`). Two modes:
   *
   * - `true` (R95 D2) — **grow**: `min-height: calc(100svh - 88px)`. A tall
   *   viewport fills; a short one overflows into the shell's document scroll
   *   instead of cramping. Right for **forms / wizard / builder** (content
   *   below the fold must stay reachable by scrolling the page).
   * - `"bounded"` (R96) — **cap**: `height: calc(100svh - 88px)`. The card
   *   can't grow past the viewport, so a `variant="fill"` child with an inner
   *   `overflow:auto` body absorbs a short viewport by shrinking its scroll
   *   window, keeping a sticky header + a bottom-pinned control at the
   *   viewport bottom. Right for **paginated view tables** (the data is in an
   *   internal scroll, so the page itself should not grow).
   */
  fill?: boolean | "bounded";
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
  const fillHeight = `calc(100svh - ${SHELL_CHROME_PX}px)`;
  const style: CSSProperties = {
    maxWidth: maxWidthFor(width),
    width: "100%",
    // Cap-and-center; on a fluid (uncapped) container this is a no-op.
    marginInline: "auto",
    ...(fill
      ? {
          // "bounded" → hard `height` (cap at the viewport: the inner
          // overflow:auto body absorbs short viewports, pager stays pinned).
          // `true` → `min-height` (grow: a short viewport document-scrolls).
          ...(fill === "bounded"
            ? { height: fillHeight }
            : { minHeight: fillHeight }),
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

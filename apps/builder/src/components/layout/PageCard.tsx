import type { ReactNode, HTMLAttributes } from "react";

export interface PageCardProps extends HTMLAttributes<HTMLElement> {
  readonly children: ReactNode;
  /**
   * `flush` removes padding and clips overflow — use when the page
   * supplies its own internal scaffolding (e.g. a guided two-pane layout
   * that draws to the card edges).
   */
  readonly variant?: "default" | "flush";
}

/**
 * Canonical page wrapper. Every routed page in the builder app renders
 * inside a PageCard. See `docs/agents/design/design-guidelines.md
 * § Layout` for the rule of one.
 *
 * - Uses the `.page-card` master style declared in `index.css`.
 * - Inherits radii / shadow / border tokens from the brand palette.
 */
export default function PageCard({
  children,
  variant = "default",
  className,
  ...rest
}: PageCardProps): React.ReactElement {
  const variantClass = variant === "flush" ? "page-card--flush" : "";
  const composed = ["page-card", variantClass, className].filter(Boolean).join(" ");
  return (
    <section className={composed} {...rest}>
      {children}
    </section>
  );
}

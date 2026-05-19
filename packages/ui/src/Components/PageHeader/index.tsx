import { Breadcrumb, Typography } from "antd";
import type { ReactNode } from "react";

const { Title, Paragraph } = Typography;

export interface PageHeaderProps {
  readonly section: string;
  readonly title: string;
  readonly subtitle?: ReactNode;
  readonly extra?: ReactNode;
}

/**
 * Canonical page header rendered at the top of each routed page's content area.
 * Pairs with `AppShell`. See `docs/agents/design/design-guidelines.md § 3.5`.
 */
export default function PageHeader({
  section,
  title,
  subtitle,
  extra,
}: PageHeaderProps): React.ReactElement {
  return (
    <section
      style={{
        background: "var(--color-white)",
        border: "1px solid var(--surface-line)",
        borderRadius: "var(--radius-xl)",
        padding: "16px 20px",
        marginBottom: 16,
        boxShadow: "var(--shadow-card)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <Breadcrumb
          items={[{ title: "Builder" }, { title: section }, { title }]}
          style={{ fontSize: 13 }}
        />
        <Title level={2} style={{ margin: "6px 0 4px", fontSize: 24 }}>
          {title}
        </Title>
        {subtitle ? (
          <Paragraph style={{ margin: 0, color: "var(--color-gray-4)" }}>
            {subtitle}
          </Paragraph>
        ) : null}
      </div>
      {extra ? <div>{extra}</div> : null}
    </section>
  );
}

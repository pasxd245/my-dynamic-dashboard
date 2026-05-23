import { Breadcrumb, theme, Typography } from "antd";
import type { CSSProperties, ReactNode } from "react";

export type BreadcrumbItem = {
  label: ReactNode;
  /**
   * Optional route to navigate to. When absent, the crumb renders as
   * plain text (typically the current page).
   *
   * The builder passes `onNavigate` to wire route strings to its
   * router. PageHeader itself does not import `react-router-dom` —
   * the BIZ boundary stays clean.
   */
  route?: string;
};

export type PageHeaderProps = {
  breadcrumb: BreadcrumbItem[];
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /**
   * Invoked when a clickable breadcrumb item is activated. The
   * builder typically passes a function that calls its router's
   * navigate. Omit for non-interactive contexts (tests).
   */
  onNavigate?: (route: string) => void;
};

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
  onNavigate,
}: Readonly<PageHeaderProps>) {
  const { token } = theme.useToken();

  const items = breadcrumb.map((crumb, index) => {
    const key = `crumb-${index}`;
    if (crumb.route && onNavigate) {
      const route = crumb.route;
      return {
        key,
        title: (
          <a
            href={route}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(route);
            }}
          >
            {crumb.label}
          </a>
        ),
      };
    }
    return { key, title: crumb.label };
  });

  const headerStyle: CSSProperties = {
    marginBottom: 16,
    display: "flex",
    alignItems: "flex-start",
    gap: 16,
  };

  const subtitleStyle: CSSProperties = {
    color: token.colorTextSecondary,
    margin: 0,
  };

  return (
    <header data-component="PageHeader" style={headerStyle}>
      <div style={{ flex: 1 }}>
        <Breadcrumb items={items} style={{ marginBottom: 8 }} />
        <Typography.Title
          level={2}
          style={{ marginTop: 0, marginBottom: subtitle ? 4 : 0 }}
        >
          {title}
        </Typography.Title>
        {subtitle !== undefined && (
          <Typography.Paragraph style={subtitleStyle}>
            {subtitle}
          </Typography.Paragraph>
        )}
      </div>
      {actions !== undefined && <div data-slot="actions">{actions}</div>}
    </header>
  );
}

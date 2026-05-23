import { MenuOutlined } from "@ant-design/icons";
import { Layout, Tooltip, theme } from "antd";
import type { CSSProperties, ReactNode } from "react";

export type NavItem = {
  key: string;
  label: string;
  icon?: ReactNode;
};

export type WorkspaceShellProps = {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  children: ReactNode;
  /**
   * R09: when true, sidebar collapses to icon-only at 56px.
   * Defaults to false (expanded, 88px).
   */
  collapsed?: boolean;
  /**
   * R09: invoked when the user clicks the hamburger toggle.
   * Omit to render the toggle as a no-op (consumer may also hide
   * the toggle by wrapping it; currently the toggle always
   * renders when this prop is provided).
   */
  onToggleCollapse?: () => void;
};

const BRAND_MARK: ReadonlyArray<{ id: string; char: string }> = [
  { id: "m", char: "M" },
  { id: "d-1", char: "D" },
  { id: "d-2", char: "D" },
];

const EXPANDED_WIDTH = 88;
const COLLAPSED_WIDTH = 56;

export function WorkspaceShell({
  items,
  activeKey,
  onSelect,
  children,
  collapsed = false,
  onToggleCollapse,
}: Readonly<WorkspaceShellProps>) {
  const { token } = theme.useToken();

  const sidebarStyle: CSSProperties = {
    background: token.colorBgContainer,
    borderRight: `1px solid ${token.colorBorderSecondary}`,
    padding: "16px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    transition: "width 200ms ease, flex 200ms ease, max-width 200ms ease",
  };

  const toggleStyle: CSSProperties = {
    width: 40,
    height: 32,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    borderRadius: token.borderRadius,
    color: token.colorTextSecondary,
    marginBottom: 8,
    fontSize: 18,
    lineHeight: 1,
    transition: "background 120ms ease, color 120ms ease",
  };

  const brandStyle: CSSProperties = {
    width: 56,
    height: 56,
    display: collapsed ? "none" : "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: token.colorText,
    fontSize: 14,
    lineHeight: 1.15,
    marginBottom: 16,
  };

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider
        width={sidebarWidth}
        collapsedWidth={COLLAPSED_WIDTH}
        theme="light"
        style={sidebarStyle}
      >
        {onToggleCollapse && (
          <button
            type="button"
            data-testid="workspace-shell-toggle"
            aria-label="Toggle sidebar"
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
            style={toggleStyle}
          >
            <MenuOutlined />
          </button>
        )}
        <div style={brandStyle} aria-hidden="true">
          {BRAND_MARK.map((entry) => (
            <span key={entry.id}>{entry.char}</span>
          ))}
        </div>
        <nav aria-label="Primary navigation" style={{ width: "100%" }}>
          {items.map((item) => {
            const isActive = item.key === activeKey;
            const buttonStyle: CSSProperties = {
              width: collapsed ? 40 : 72,
              padding: collapsed ? "8px 4px" : "10px 4px",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderRadius: token.borderRadius,
              cursor: "pointer",
              border: "none",
              fontFamily: "inherit",
              fontSize: 12,
              background: isActive ? token.colorPrimaryBg : "transparent",
              color: isActive ? token.colorPrimary : token.colorTextSecondary,
              transition:
                "background 120ms ease, color 120ms ease, width 200ms ease, padding 200ms ease",
            };

            const button = (
              <button
                key={item.key}
                type="button"
                data-key={item.key}
                data-active={isActive ? "true" : undefined}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(item.key)}
                style={buttonStyle}
              >
                {item.icon !== undefined && (
                  <span
                    style={{ fontSize: 20, lineHeight: 1 }}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                )}
                <span style={{ display: collapsed ? "none" : "inline" }}>
                  {item.label}
                </span>
              </button>
            );

            return collapsed ? (
              <Tooltip
                key={item.key}
                title={item.label}
                placement="right"
              >
                {button}
              </Tooltip>
            ) : (
              button
            );
          })}
        </nav>
      </Layout.Sider>
      <Layout.Content
        style={{
          background: token.colorBgLayout,
          padding: "32px 40px",
          overflow: "auto",
        }}
      >
        {children}
      </Layout.Content>
    </Layout>
  );
}

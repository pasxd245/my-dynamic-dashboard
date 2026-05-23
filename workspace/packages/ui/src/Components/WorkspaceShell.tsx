import { Layout, theme } from "antd";
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
};

const BRAND_MARK: ReadonlyArray<{ id: string; char: string }> = [
  { id: "m", char: "M" },
  { id: "d-1", char: "D" },
  { id: "d-2", char: "D" },
];

export function WorkspaceShell({
  items,
  activeKey,
  onSelect,
  children,
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
  };

  const brandStyle: CSSProperties = {
    width: 56,
    height: 56,
    display: "flex",
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

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider width={88} theme="light" style={sidebarStyle}>
        <div style={brandStyle} aria-hidden="true">
          {BRAND_MARK.map((entry) => (
            <span key={entry.id}>{entry.char}</span>
          ))}
        </div>
        <nav aria-label="Primary navigation" style={{ width: "100%" }}>
          {items.map((item) => {
            const isActive = item.key === activeKey;
            const buttonStyle: CSSProperties = {
              width: 72,
              padding: "10px 4px",
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
              background: isActive
                ? token.colorPrimaryBg
                : "transparent",
              color: isActive ? token.colorPrimary : token.colorTextSecondary,
              transition: "background 120ms ease, color 120ms ease",
            };

            return (
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
                <span>{item.label}</span>
              </button>
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

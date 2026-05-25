import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { Layout, Menu, theme } from "antd";
import type { MenuProps } from "antd";
import type { CSSProperties, ReactNode } from "react";

export type NavItem = {
  key: string;
  label: string;
  icon?: ReactNode;
};

export type NavGroup = {
  key: string;
  label: string;
  icon: ReactNode;
  items: NavItem[];
  /** Initial expand state when sidebar is not collapsed. */
  defaultExpanded?: boolean;
};

type WorkspaceShellBaseProps = {
  activeKey: string;
  onSelect: (key: string) => void;
  children: ReactNode;
  /** R09: sidebar collapse state. Defaults to expanded. */
  collapsed?: boolean;
  /** R09: invoked when the hamburger toggle is clicked. */
  onToggleCollapse?: () => void;
  /**
   * R12: top-bar slot for the header content area (title, breadcrumb,
   * future search / user / bell). Builder owns what fills it.
   */
  header?: ReactNode;
  /** R12: shorthand for `header` when no custom content is needed. */
  title?: ReactNode;
  /**
   * R32: right-aligned slot in the top bar — locale switcher, future
   * profile/notifications drop into this slot. Sits after the
   * `flex: 1` header content so it hugs the right edge.
   */
  headerExtra?: ReactNode;
  /**
   * R12: brand mark override. If omitted, renders the default MDD
   * badge. Hidden in collapsed mode regardless.
   */
  brand?: ReactNode;
  /**
   * R12: optional build version string in the sidebar footer.
   * Hidden in collapsed mode.
   */
  buildVersion?: string;
};

export type WorkspaceShellProps =
  | (WorkspaceShellBaseProps & { items: NavItem[]; groups?: never })
  | (WorkspaceShellBaseProps & { items?: never; groups: NavGroup[] });

const EXPANDED_WIDTH = 220;
const COLLAPSED_WIDTH = 64;
const HEADER_HEIGHT = 56;

function toMenuItems(
  source: NavItem[] | NavGroup[],
  isGrouped: boolean,
): MenuProps["items"] {
  if (isGrouped) {
    return (source as NavGroup[]).map((group) => ({
      key: group.key,
      icon: group.icon,
      label: group.label,
      children: group.items.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
      })),
    }));
  }
  return (source as NavItem[]).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
  }));
}

function defaultOpenKeysFor(groups: NavGroup[] | undefined): string[] {
  if (!groups) return [];
  return groups.filter((g) => g.defaultExpanded).map((g) => g.key);
}

export function WorkspaceShell(props: Readonly<WorkspaceShellProps>) {
  const {
    activeKey,
    onSelect,
    children,
    collapsed = false,
    onToggleCollapse,
    header,
    title,
    headerExtra,
    brand,
    buildVersion,
  } = props;
  const { token } = theme.useToken();

  const isGrouped = "groups" in props && props.groups !== undefined;
  const navSource = isGrouped
    ? (props as { groups: NavGroup[] }).groups
    : (props as { items: NavItem[] }).items;
  const menuItems = toMenuItems(navSource, isGrouped);
  const defaultOpenKeys = isGrouped
    ? defaultOpenKeysFor((props as { groups: NavGroup[] }).groups)
    : [];

  const siderStyle: CSSProperties = {
    background: token.colorBgContainer,
    borderRight: `1px solid ${token.colorBorderSecondary}`,
    display: "flex",
    flexDirection: "column",
    overflow: collapsed ? "visible" : "hidden",
    transition: "all 200ms ease",
  };

  const sidebarHeaderStyle: CSSProperties = {
    height: HEADER_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "flex-start",
    padding: collapsed ? 0 : "0 16px",
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    gap: 8,
    flexShrink: 0,
  };

  const brandBadgeStyle: CSSProperties = {
    width: 32,
    height: 32,
    background: token.colorPrimary,
    color: token.colorTextLightSolid,
    borderRadius: token.borderRadius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  };

  const brandTextStyle: CSSProperties = {
    fontWeight: 700,
    fontSize: 16,
    color: token.colorPrimary,
    display: collapsed ? "none" : "inline",
  };

  const headerStyle: CSSProperties = {
    height: HEADER_HEIGHT,
    background: token.colorBgContainer,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
    display: "flex",
    alignItems: "center",
    padding: "0 24px 0 8px",
    gap: 16,
  };

  const toggleStyle: CSSProperties = {
    width: 40,
    height: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: token.colorTextSecondary,
    borderRadius: token.borderRadius,
    fontSize: 18,
  };

  const footerStyle: CSSProperties = {
    padding: collapsed ? "12px 4px" : "12px 16px",
    fontSize: 11,
    color: token.colorTextTertiary,
    borderTop: `1px solid ${token.colorBorderSecondary}`,
    textAlign: collapsed ? "center" : "left",
    flexShrink: 0,
  };

  const ToggleIcon = collapsed ? MenuUnfoldOutlined : MenuFoldOutlined;

  const brandContent = brand ?? (
    <>
      <div style={brandBadgeStyle} aria-hidden="true">
        M
      </div>
      <span style={brandTextStyle}>MDD</span>
    </>
  );

  return (
    <Layout style={{ height: "100vh" }}>
      <Layout.Sider
        width={EXPANDED_WIDTH}
        collapsedWidth={COLLAPSED_WIDTH}
        collapsed={collapsed}
        theme="light"
        trigger={null}
        collapsible
        style={siderStyle}
      >
        {/*
          AntD wraps Sider children in `.ant-layout-sider-children` which
          ignores the parent's flex-direction. Use an inner flex-column
          div so the footer pins to the bottom and the Menu fills space.
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <div style={sidebarHeaderStyle}>{brandContent}</div>
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            <Menu
              mode="inline"
              inlineCollapsed={collapsed}
              items={menuItems}
              selectedKeys={activeKey ? [activeKey] : []}
              defaultOpenKeys={defaultOpenKeys}
              onClick={(info) => onSelect(info.key)}
              style={{
                borderRight: "none",
                background: "transparent",
                paddingTop: 8,
              }}
            />
          </div>
          {buildVersion !== undefined && (
            <div style={footerStyle}>
              {collapsed ? buildVersion : `build ${buildVersion}`}
            </div>
          )}
        </div>
      </Layout.Sider>
      <Layout>
        <Layout.Header style={headerStyle}>
          {onToggleCollapse && (
            <button
              type="button"
              data-testid="workspace-shell-toggle"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              onClick={onToggleCollapse}
              style={toggleStyle}
            >
              <ToggleIcon />
            </button>
          )}
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            {header ?? (
              <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
            )}
          </div>
          {headerExtra ? (
            <div
              style={{ display: "flex", alignItems: "center", gap: 8 }}
              data-component="WorkspaceShellHeaderExtra"
            >
              {headerExtra}
            </div>
          ) : null}
        </Layout.Header>
        <Layout.Content
          style={{
            background: token.colorBgLayout,
            padding: "16px",
            overflow: "auto",
          }}
        >
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

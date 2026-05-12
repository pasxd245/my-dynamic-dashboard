import { useMemo, useState, type ReactNode } from "react";
import { Layout, Menu, Button } from "antd";
import type { MenuProps } from "antd";
import { Menu as MenuIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const { Sider, Header, Content } = Layout;

export interface AppShellNavItem {
  readonly key: string;
  readonly label: string;
  readonly to: string;
  readonly icon: ReactNode;
}

export interface AppShellNavGroup {
  readonly key: string;
  readonly title: string;
  readonly items: AppShellNavItem[];
}

export interface AppShellProps {
  readonly navGroups: AppShellNavGroup[];
  readonly header?: ReactNode;
  readonly brand?: ReactNode;
  readonly children: ReactNode;
}

const DEFAULT_BRAND = (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: "var(--color-blue)",
        color: "#ffffff",
        fontWeight: 700,
        display: "grid",
        placeItems: "center",
      }}
    >
      M
    </span>
    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-dark-blue)" }}>
      Builder
    </span>
  </div>
);

/**
 * Canonical app shell: AntD `Layout` + collapsible `Sider` + `Header` + `Content`.
 * Owns sidebar nav, brand mark, and the top bar slot. Routed pages render as
 * `children` inside `Content`. See `docs/agents/design/design-guidelines.md § 3.5`.
 */
export default function AppShell({
  navGroups,
  header,
  brand = DEFAULT_BRAND,
  children,
}: AppShellProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const selectedKey = useMemo(() => {
    const allItems = navGroups.flatMap((group) => group.items);
    // Prefer exact match, otherwise longest prefix match.
    const exact = allItems.find((item) => item.to === location.pathname);
    if (exact) return exact.key;
    const prefix = allItems
      .filter((item) => location.pathname.startsWith(item.to) && item.to !== "/")
      .sort((a, b) => b.to.length - a.to.length)[0];
    return prefix?.key ?? "";
  }, [navGroups, location.pathname]);

  const menuItems: MenuProps["items"] = useMemo(
    () =>
      navGroups.map((group) => ({
        key: group.key,
        type: "group" as const,
        label: collapsed ? null : group.title,
        children: group.items.map((item) => ({
          key: item.key,
          icon: item.icon,
          label: (
            <NavLink to={item.to} end={item.to === "/"}>
              {item.label}
            </NavLink>
          ),
        })),
      })),
    [navGroups, collapsed],
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={256}
        collapsedWidth={72}
        style={{ borderRight: "1px solid var(--surface-line)" }}
      >
        <div
          style={{
            padding: collapsed ? "16px 12px" : "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            minHeight: 64,
          }}
        >
          {collapsed ? null : brand}
          <Button
            type="text"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((c) => !c)}
            icon={<MenuIcon size={18} />}
          />
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={menuItems}
          style={{ borderInlineEnd: 0, background: "transparent" }}
          inlineCollapsed={collapsed}
        />
      </Sider>
      <Layout>
        {header ? (
          <Header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              padding: "12px 20px",
              height: "auto",
              minHeight: 64,
              lineHeight: 1.2,
              boxShadow: "var(--shadow-card)",
            }}
          >
            {header}
          </Header>
        ) : null}
        <Content style={{ padding: 20, overflow: "auto" }}>{children}</Content>
      </Layout>
    </Layout>
  );
}

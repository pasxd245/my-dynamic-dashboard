import { DatabaseOutlined } from "@ant-design/icons";
import { WorkspaceShell, type NavItem } from "@mdd/ui";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { key: "data-management", label: "Data", icon: <DatabaseOutlined /> },
];

function activeKeyFor(pathname: string): string {
  for (const item of NAV_ITEMS) {
    if (pathname === `/${item.key}` || pathname.startsWith(`/${item.key}/`)) {
      return item.key;
    }
  }
  return "";
}

export function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeKey = activeKeyFor(pathname);

  return (
    <WorkspaceShell
      items={[...NAV_ITEMS]}
      activeKey={activeKey}
      onSelect={(key) => navigate(`/${key}`)}
    >
      {children}
    </WorkspaceShell>
  );
}

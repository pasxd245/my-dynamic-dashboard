import {
  AppstoreOutlined,
  DatabaseOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { WorkspaceShell, type NavGroup } from "@mdd/ui";
import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRouteMeta } from "../lib/routeMeta";

const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    key: "data-management",
    label: "Data Management",
    icon: <DatabaseOutlined />,
    defaultExpanded: true,
    items: [
      {
        key: "workspaces",
        label: "Workspaces",
        icon: <AppstoreOutlined />,
      },
      {
        key: "datasets",
        label: "Datasets",
        icon: <TableOutlined />,
      },
    ],
  },
];

// Map from leaf nav-item key to its route.
const ROUTE_FOR_KEY: Record<string, string> = {
  workspaces: "/data-management/workspaces",
  datasets: "/data-management/datasets",
};

function activeKeyFor(pathname: string): string {
  if (
    pathname === "/data-management/workspaces" ||
    pathname.startsWith("/data-management/workspaces/")
  ) {
    return "workspaces";
  }
  if (
    pathname === "/data-management/datasets" ||
    pathname.startsWith("/data-management/datasets/")
  ) {
    return "datasets";
  }
  // /data-management with no sub-segment is the placeholder route;
  // no leaf is "active" then (the group header just stays expanded).
  return "";
}

export function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeKey = activeKeyFor(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const routeMeta = useRouteMeta();

  const handleSelect = (key: string) => {
    const route = ROUTE_FOR_KEY[key];
    if (route) navigate(route);
  };

  return (
    <WorkspaceShell
      groups={[...NAV_GROUPS]}
      activeKey={activeKey}
      onSelect={handleSelect}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      title={routeMeta.title}
      buildVersion="0.0.1"
    >
      {children}
    </WorkspaceShell>
  );
}

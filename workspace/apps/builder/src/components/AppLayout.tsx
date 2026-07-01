import {
  AppstoreOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  FilterOutlined,
  FundOutlined,
  PartitionOutlined,
  SettingOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { WorkspaceShell, type NavGroup, type NavItem } from '@mdd/ui';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { LocaleSwitcher } from '@/i18n/LocaleSwitcher';
import { useAllDashboards } from '@/features/dashboard/hooks';
import { useRouteMeta } from '../lib/routeMeta';

// R101 — nav keys. `Settings › Dashboard` (config/create) is `settings-dashboard`
// → /settings/dashboard; a created dashboard's item is `dash:<ws_id>/<slug>` →
// /dashboards/<ws_id>/<slug> (the project is nested in the path; slug is unique
// per-workspace).
const SETTINGS_DASHBOARD_KEY = 'settings-dashboard';
const DASH_ITEM_PREFIX = 'dash:';
const DASH_WS_PREFIX = 'dashws:'; // workspace SubMenu header (toggles only; no route)
const DASHBOARDS_PATH = '/dashboards/';


// Static leaf → route map (the dashboard instance items are resolved dynamically).
const ROUTE_FOR_KEY: Record<string, string> = {
  [SETTINGS_DASHBOARD_KEY]: '/settings/dashboard',
  workspaces: '/data-management/workspaces',
  datasets: '/data-management/datasets',
  queries: '/data-management/queries',
  workflows: '/data-management/workflows',
};

function activeKeyFor(pathname: string): string {
  if (pathname.startsWith(DASHBOARDS_PATH)) {
    return `${DASH_ITEM_PREFIX}${pathname.slice(DASHBOARDS_PATH.length)}`;
  }
  if (pathname === '/settings/dashboard' || pathname === '/dashboard') return SETTINGS_DASHBOARD_KEY;
  if (pathname === '/data-management/workspaces' || pathname.startsWith('/data-management/workspaces/')) {
    return 'workspaces';
  }
  if (pathname === '/data-management/datasets' || pathname.startsWith('/data-management/datasets/')) {
    return 'datasets';
  }
  if (pathname === '/data-management/queries' || pathname.startsWith('/data-management/queries/')) {
    return 'queries';
  }
  if (pathname === '/data-management/workflows' || pathname.startsWith('/data-management/workflows/')) {
    return 'workflows';
  }
  // /data-management with no sub-segment is the placeholder route;
  // no leaf is "active" then (the group header just stays expanded).
  return '';
}

export function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { items: dashboardItems } = useAllDashboards();
  const activeKey = activeKeyFor(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const routeMeta = useRouteMeta();

  // Built INSIDE the component so the labels are i18n'd (R105 B1 — was a
  // module-level const with hardcoded English; the keys already exist in en+vi).
  const dataManagementGroup: NavGroup = {
    key: 'data-management',
    label: t('nav.dataManagement'),
    icon: <DatabaseOutlined />,
    defaultExpanded: true,
    items: [
      { key: 'workspaces', label: t('nav.workspaces'), icon: <AppstoreOutlined /> },
      { key: 'datasets', label: t('nav.datasets'), icon: <TableOutlined /> },
      { key: 'queries', label: t('nav.queries'), icon: <FilterOutlined /> },
      { key: 'workflows', label: t('nav.workflows'), icon: <PartitionOutlined /> },
    ],
  };

  // R101 — `Settings › Dashboard` is the config/create entry (→ /settings/dashboard).
  const systemGroup: NavGroup = {
    key: 'system',
    label: t('nav.system'),
    icon: <SettingOutlined />,
    defaultExpanded: true,
    items: [{ key: SETTINGS_DASHBOARD_KEY, label: t('nav.dashboard'), icon: <BarChartOutlined /> }],
  };

  // The `Dashboards` group nests by project: Dashboards › ‹Workspace› ›
  // ‹Dashboard›. Each leaf's key carries `<ws_id>/<slug>` so the route nests the
  // project; the workspace SubMenu key (`dashws:<ws_id>`) only toggles open (it
  // has no route). Shown only once at least one dashboard exists.
  const byWorkspace = new Map<string, { name: string; items: NavItem[] }>();
  for (const { dashboard: d, workspaceName } of dashboardItems) {
    const entry = byWorkspace.get(d.workspaceId) ?? { name: workspaceName, items: [] };
    entry.items.push({
      key: `${DASH_ITEM_PREFIX}${d.workspaceId}/${d.slug}`,
      label: d.name,
      icon: <FundOutlined />,
    });
    byWorkspace.set(d.workspaceId, entry);
  }
  const dashboardGroup: NavGroup | null =
    dashboardItems.length > 0
      ? {
          key: 'dashboards',
          label: t('nav.dashboards'),
          icon: <FundOutlined />,
          defaultExpanded: true,
          items: [...byWorkspace.entries()].map(([wsId, { name, items }]) => ({
            key: `${DASH_WS_PREFIX}${wsId}`,
            label: name,
            icon: <AppstoreOutlined />,
            children: items,
          })),
        }
      : null;

  const handleSelect = (key: string) => {
    if (key.startsWith(DASH_ITEM_PREFIX)) {
      navigate(`${DASHBOARDS_PATH}${key.slice(DASH_ITEM_PREFIX.length)}`);
      return;
    }
    const route = ROUTE_FOR_KEY[key];
    if (route) navigate(route);
  };

  // Order: created dashboards (if any) → Data Management → Settings (config, last).
  const groups = [...(dashboardGroup ? [dashboardGroup] : []), dataManagementGroup, systemGroup];

  return (
    <WorkspaceShell
      groups={groups}
      activeKey={activeKey}
      onSelect={handleSelect}
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      onHome={() => navigate('/')}
      homeLabel={t('nav.home')}
      title={routeMeta.title}
      headerExtra={<LocaleSwitcher />}
      buildVersion="0.0.1"
    >
      {children}
    </WorkspaceShell>
  );
}

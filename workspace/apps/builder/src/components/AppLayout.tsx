import {
  AppstoreOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  FilterOutlined,
  FundOutlined,
  SettingOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { WorkspaceShell, type NavGroup } from '@mdd/ui';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { LocaleSwitcher } from '@/i18n/LocaleSwitcher';
import { useDashboardsForNav } from '@/features/dashboard/store';
import { useRouteMeta } from '../lib/routeMeta';

// R101 — nav keys. `Settings › Dashboard` (config/create) is `settings-dashboard`
// → /settings/dashboard; a created dashboard's item is `dash:<slug>` →
// /dashboards/<slug>.
const SETTINGS_DASHBOARD_KEY = 'settings-dashboard';
const DASH_ITEM_PREFIX = 'dash:';
const DASHBOARDS_PATH = '/dashboards/';

const DATA_MANAGEMENT_GROUP: NavGroup = {
  key: 'data-management',
  label: 'Data Management',
  icon: <DatabaseOutlined />,
  defaultExpanded: true,
  items: [
    { key: 'workspaces', label: 'Workspaces', icon: <AppstoreOutlined /> },
    { key: 'datasets', label: 'Datasets', icon: <TableOutlined /> },
    { key: 'queries', label: 'Queries', icon: <FilterOutlined /> },
  ],
};

// Static leaf → route map (the dashboard instance items are resolved dynamically).
const ROUTE_FOR_KEY: Record<string, string> = {
  [SETTINGS_DASHBOARD_KEY]: '/settings/dashboard',
  workspaces: '/data-management/workspaces',
  datasets: '/data-management/datasets',
  queries: '/data-management/queries',
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
  // /data-management with no sub-segment is the placeholder route;
  // no leaf is "active" then (the group header just stays expanded).
  return '';
}

export function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const dashboards = useDashboardsForNav();
  const activeKey = activeKeyFor(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const routeMeta = useRouteMeta();

  // R101 — `Settings › Dashboard` is the config/create entry (→ /settings/dashboard).
  const systemGroup: NavGroup = {
    key: 'system',
    label: t('nav.system'),
    icon: <SettingOutlined />,
    defaultExpanded: true,
    items: [{ key: SETTINGS_DASHBOARD_KEY, label: t('nav.dashboard'), icon: <BarChartOutlined /> }],
  };

  // The `Dashboard` group lists the created dashboards by slug (feedback:
  // "Dashboard › Weekly report"). Shown only once at least one exists.
  const dashboardGroup: NavGroup | null =
    dashboards.length > 0
      ? {
          key: 'dashboards',
          label: t('nav.dashboards'),
          icon: <FundOutlined />,
          defaultExpanded: true,
          items: dashboards.map((d) => ({
            key: `${DASH_ITEM_PREFIX}${d.slug}`,
            label: d.name,
            icon: <FundOutlined />,
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
  const groups = [...(dashboardGroup ? [dashboardGroup] : []), DATA_MANAGEMENT_GROUP, systemGroup];

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

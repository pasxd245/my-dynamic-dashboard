import {
  AppstoreOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  FilterOutlined,
  FundOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { WorkspaceShell, type NavGroup } from '@mdd/ui';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { LocaleSwitcher } from '@/i18n/LocaleSwitcher';
import { useDashboardsForNav } from '@/features/dashboard/store';
import { useRouteMeta } from '../lib/routeMeta';

// R101 — a dashboard nav item's key is `dash:<id>`; the list is `dashboards-all`.
const DASHBOARDS_ALL_KEY = 'dashboards-all';
const DASH_ITEM_PREFIX = 'dash:';

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

// Static leaf → route map (the dashboard items are resolved dynamically).
const ROUTE_FOR_KEY: Record<string, string> = {
  [DASHBOARDS_ALL_KEY]: '/dashboard',
  workspaces: '/data-management/workspaces',
  datasets: '/data-management/datasets',
  queries: '/data-management/queries',
};

function activeKeyFor(pathname: string): string {
  if (pathname.startsWith('/dashboard/')) {
    return `${DASH_ITEM_PREFIX}${pathname.slice('/dashboard/'.length)}`;
  }
  if (pathname === '/dashboard') return DASHBOARDS_ALL_KEY;
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

  // R101 — the Dashboard group lists saved dashboards dynamically (feedback:
  // "Dashboard › Weekly report"), with "All dashboards" → the list.
  const dashboardGroup: NavGroup = {
    key: 'dashboard',
    label: t('nav.dashboard'),
    icon: <BarChartOutlined />,
    defaultExpanded: true,
    items: [
      { key: DASHBOARDS_ALL_KEY, label: t('dashboard.allDashboards'), icon: <AppstoreOutlined /> },
      ...dashboards.map((d) => ({
        key: `${DASH_ITEM_PREFIX}${d.id}`,
        label: d.name,
        icon: <FundOutlined />,
      })),
    ],
  };

  const handleSelect = (key: string) => {
    if (key.startsWith(DASH_ITEM_PREFIX)) {
      navigate(`/dashboard/${key.slice(DASH_ITEM_PREFIX.length)}`);
      return;
    }
    const route = ROUTE_FOR_KEY[key];
    if (route) navigate(route);
  };

  return (
    <WorkspaceShell
      groups={[dashboardGroup, DATA_MANAGEMENT_GROUP]}
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

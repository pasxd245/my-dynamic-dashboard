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
import { useRouteMeta } from '../lib/routeMeta';

const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: <BarChartOutlined />,
    defaultExpanded: true,
    items: [
      {
        key: 'sales-dashboard',
        label: 'Sales',
        icon: <FundOutlined />,
      },
    ],
  },
  {
    key: 'data-management',
    label: 'Data Management',
    icon: <DatabaseOutlined />,
    defaultExpanded: true,
    items: [
      {
        key: 'workspaces',
        label: 'Workspaces',
        icon: <AppstoreOutlined />,
      },
      {
        key: 'datasets',
        label: 'Datasets',
        icon: <TableOutlined />,
      },
      {
        key: 'queries',
        label: 'Queries',
        icon: <FilterOutlined />,
      },
    ],
  },
];

// Map from leaf nav-item key to its route.
const ROUTE_FOR_KEY: Record<string, string> = {
  'sales-dashboard': '/dashboard',
  workspaces: '/data-management/workspaces',
  datasets: '/data-management/datasets',
  queries: '/data-management/queries',
};

function activeKeyFor(pathname: string): string {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return 'sales-dashboard';
  }
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

import { createElement, useMemo, type FC } from 'react';
import { Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import type { NavigationItem } from '../../types/index.ts';

export type SidebarMenuProps = {
  items: NavigationItem[];
  expanded?: boolean;
};

function pathPrefix(pathname: string): string {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return '/';
  if (segs.length === 1) return `/${segs[0]}`;
  return `/${segs[0]}/${segs[1]}`;
}

function isActive(itemPath: string, currentPrefix: string): boolean {
  if (itemPath === '/') return currentPrefix === '/';
  return itemPath === currentPrefix || itemPath.startsWith(`${currentPrefix}/`);
}

export const SidebarMenu: FC<SidebarMenuProps> = ({ items, expanded = true }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const currentPrefix = pathPrefix(pathname);
  const visibleItems = items.filter((i) => i.sidebar !== false);

  const antdItems = useMemo(
    () =>
      visibleItems.map((item) => ({
        key: item.path,
        icon: item.icon ? createElement(item.icon) : undefined,
        label: item.title,
        disabled: item.disabled,
      })),
    [visibleItems],
  );

  const selectedKey = visibleItems.find((i) => isActive(i.path, currentPrefix))?.path;

  return (
    <Menu
      mode="inline"
      theme="dark"
      inlineCollapsed={!expanded}
      selectedKeys={selectedKey ? [selectedKey] : []}
      items={antdItems}
      style={{ borderInlineEnd: 'none', background: 'transparent' }}
      onClick={({ key }) => navigate(key as string)}
    />
  );
};

export default SidebarMenu;

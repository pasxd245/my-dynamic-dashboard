import { createElement, useMemo, type FC } from 'react';
import { Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import type { NavigationGroup, NavigationItem } from '../../types/index.ts';

type FlatProps = { items: NavigationItem[]; groups?: never; expanded?: boolean };
type GroupedProps = { items?: never; groups: NavigationGroup[]; expanded?: boolean };
export type SidebarMenuProps = FlatProps | GroupedProps;

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

function leafItem(item: NavigationItem) {
  return {
    key: item.path,
    icon: item.icon ? createElement(item.icon) : undefined,
    label: item.title,
    disabled: item.disabled,
  };
}

export const SidebarMenu: FC<SidebarMenuProps> = (props) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const currentPrefix = pathPrefix(pathname);
  const expanded = props.expanded ?? true;

  const flatItems: NavigationItem[] = useMemo(() => {
    if ('groups' in props && props.groups) {
      return props.groups.flatMap((g) => g.items.filter((i) => i.sidebar !== false));
    }
    return (props.items ?? []).filter((i) => i.sidebar !== false);
  }, [props]);

  const antdItems = useMemo(() => {
    if ('groups' in props && props.groups) {
      return props.groups.map((g) => ({
        key: g.id,
        type: 'group' as const,
        label: expanded ? g.title : null,
        children: g.items.filter((i) => i.sidebar !== false).map(leafItem),
      }));
    }
    return flatItems.map(leafItem);
  }, [props, flatItems, expanded]);

  const selectedKey = flatItems.find((i) => isActive(i.path, currentPrefix))?.path;

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

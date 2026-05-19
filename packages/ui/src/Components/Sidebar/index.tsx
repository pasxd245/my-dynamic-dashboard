import { createElement, type FC, type ReactNode } from 'react';
import { Layout } from 'antd';
import type { IconProps, NavigationGroup, NavigationItem } from '../../types/index.ts';
import { useNavigationContext } from '../../Contexts/NavigationContext/index.tsx';
import { SidebarMenu } from '../SidebarMenu/index.tsx';

export type SidebarProps = {
  navigation?: NavigationItem[];
  navGroups?: NavigationGroup[];
  Logo?: FC<IconProps>;
  brand?: ReactNode;
  buildVersion?: string;
};

function renderBrand(
  brand: ReactNode | undefined,
  Logo: FC<IconProps> | undefined,
  expanded: boolean,
): ReactNode {
  if (brand !== undefined) return brand;
  if (Logo) {
    return createElement(
      Logo,
      expanded ? { width: 94, height: 24 } : { width: 36, height: 20 },
    );
  }
  return null;
}

export const Sidebar: FC<SidebarProps> = ({
  navigation,
  navGroups,
  Logo,
  brand,
  buildVersion,
}) => {
  const { data, updateData } = useNavigationContext();
  const expanded = data.sidebarOpen;

  const menu = navGroups
    ? <SidebarMenu groups={navGroups} expanded={expanded} />
    : navigation
    ? <SidebarMenu items={navigation} expanded={expanded} />
    : null;

  return (
    <Layout.Sider
      theme="dark"
      collapsible
      collapsed={!expanded}
      onCollapse={(c) => updateData('sidebarOpen', !c)}
      trigger={null}
      width={210}
      collapsedWidth={56}
      style={{ minHeight: '100vh' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 8px',
          minHeight: 56,
        }}
      >
        {renderBrand(brand, Logo, expanded)}
      </div>
      {menu}
      {expanded && buildVersion ? (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 0,
            right: 0,
            color: 'rgba(255,255,255,0.5)',
            fontSize: 11,
            textAlign: 'center',
          }}
        >
          {buildVersion}
        </div>
      ) : null}
    </Layout.Sider>
  );
};

export default Sidebar;

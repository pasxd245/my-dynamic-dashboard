import type { FC, ReactNode } from 'react';
import { Layout, Button as AntdButton, theme } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useNavigationContext } from '../../Contexts/NavigationContext/index.tsx';
import { Sidebar } from '../Sidebar/index.tsx';
import type { IconProps, NavigationItem } from '../../types/index.ts';

export type MasterLayoutProps = {
  navigation: NavigationItem[];
  title?: ReactNode;
  Logo?: FC<IconProps>;
  buildVersion?: string;
  children: ReactNode;
};

export const MasterLayout: FC<MasterLayoutProps> = ({
  navigation,
  title,
  Logo,
  buildVersion,
  children,
}) => {
  const { data, updateData } = useNavigationContext();
  const expanded = data.sidebarOpen;
  const { token } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar navigation={navigation} Logo={Logo} buildVersion={buildVersion} />
      <Layout>
        <Layout.Header
          style={{
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorder}`,
            padding: '0 24px 0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AntdButton
            type="text"
            icon={expanded ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={() => updateData('sidebarOpen', !expanded)}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{ fontSize: 18, width: 48, height: 48 }}
          />
          <span style={{ fontSize: 16, fontWeight: 600, color: token.colorTextBase }}>
            {title}
          </span>
        </Layout.Header>
        <Layout.Content style={{ padding: 24, background: token.colorBgLayout }}>
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default MasterLayout;

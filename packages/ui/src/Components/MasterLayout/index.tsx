import type { FC, ReactNode } from 'react';
import { Layout, Button as AntdButton, theme } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useNavigationContext } from '../../Contexts/NavigationContext/index.tsx';
import { Sidebar } from '../Sidebar/index.tsx';
import type { IconProps, NavigationGroup, NavigationItem } from '../../types/index.ts';

type MasterLayoutBaseProps = {
  title?: ReactNode;
  header?: ReactNode;
  Logo?: FC<IconProps>;
  brand?: ReactNode;
  buildVersion?: string;
  children: ReactNode;
};

export type MasterLayoutProps =
  | (MasterLayoutBaseProps & { navigation: NavigationItem[]; navGroups?: never })
  | (MasterLayoutBaseProps & { navigation?: never; navGroups: NavigationGroup[] });

function isDev(): boolean {
  // Read NODE_ENV via globalThis so the package doesn't depend on @types/node.
  // Vite / esbuild inline `process.env.NODE_ENV` at build time, so this branch
  // only matters when no bundler does the substitution.
  const proc = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
  return proc?.env?.NODE_ENV !== 'production';
}

function warnOnPrecedenceCollisions(props: {
  header?: ReactNode;
  title?: ReactNode;
  Logo?: FC<IconProps>;
  brand?: ReactNode;
}): void {
  if (!isDev()) return;
  if (props.header !== undefined && props.title !== undefined) {
    // eslint-disable-next-line no-console
    console.warn(
      '[@mdd/ui] MasterLayout: both `header` and `title` were supplied; `header` wins.',
    );
  }
  if (props.brand !== undefined && props.Logo) {
    // eslint-disable-next-line no-console
    console.warn(
      '[@mdd/ui] MasterLayout: both `Logo` and `brand` were supplied; `brand` wins.',
    );
  }
}

export const MasterLayout: FC<MasterLayoutProps> = (props) => {
  const { title, header, Logo, brand, buildVersion, children } = props;
  const { data, updateData } = useNavigationContext();
  const expanded = data.sidebarOpen;
  const { token } = theme.useToken();

  warnOnPrecedenceCollisions({ header, title, Logo, brand });

  const headerContent = header ?? (
    <span style={{ fontSize: 16, fontWeight: 600, color: token.colorTextBase }}>
      {title}
    </span>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar
        navigation={'navigation' in props ? props.navigation : undefined}
        navGroups={'navGroups' in props ? props.navGroups : undefined}
        Logo={Logo}
        brand={brand}
        buildVersion={buildVersion}
      />
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
          {headerContent}
        </Layout.Header>
        <Layout.Content style={{ padding: 24, background: token.colorBgLayout }}>
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default MasterLayout;

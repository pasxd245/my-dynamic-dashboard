// DashboardListPage (R101) — /settings/dashboard. Lists the workspace's dashboards
// (FE state this round) + create. Follows the workspaces catalog layout
// (PageContainer → PageHeader → PageCard → card grid with an overflow ⋯ menu)
// so the dashboard catalog reads identically to the workspaces one
// ([[layout-is-the-architecture]] — strict on the shared skeleton).

import {
  BarChartOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { PageCard, PageContainer, PageHeader } from '@mdd/ui';
import { App, Button, Card, Col, Dropdown, Empty, Row, Typography, theme } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useSeedWorkspace } from './hooks';
import { NameModal } from './NameModal';
import { useDashboardStore } from './store';
import type { Dashboard } from './types';

function DashboardCard({
  dashboard,
  onOpen,
  onRename,
  onDelete,
}: Readonly<{
  dashboard: Dashboard;
  onOpen: (slug: string) => void;
  onRename: (d: Dashboard) => void;
  onDelete: (d: Dashboard) => void;
}>) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const badgeStyle = {
    width: 32,
    height: 32,
    background: token.colorPrimaryBg,
    color: token.colorPrimary,
    borderRadius: token.borderRadius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    marginBottom: 12,
  } as const;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Card
      hoverable
      onClick={() => onOpen(dashboard.slug)}
      data-component="DashboardCard"
      style={{ position: 'relative' }}
    >
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'rename',
                icon: <EditOutlined />,
                label: t('common.rename'),
                onClick: ({ domEvent }) => {
                  domEvent.stopPropagation();
                  onRename(dashboard);
                },
              },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: t('common.delete'),
                danger: true,
                onClick: ({ domEvent }) => {
                  domEvent.stopPropagation();
                  onDelete(dashboard);
                },
              },
            ],
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            onClick={stop}
            aria-label={t('common.actionsForResource', { resource: t('nav.dashboard'), name: dashboard.name })}
            data-component="DashboardCardMoreButton"
          />
        </Dropdown>
      </div>
      <div style={badgeStyle} aria-hidden="true">
        {dashboard.name.charAt(0).toUpperCase()}
      </div>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
        {dashboard.name}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('dashboard.widgetCount', { count: dashboard.widgets.length })}
      </Typography.Text>
    </Card>
  );
}

export function DashboardListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const seed = useSeedWorkspace();
  const store = useDashboardStore();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Dashboard | null>(null);

  const dashboards = store.dashboards.filter((d) => d.workspaceId === seed.id);
  const seedMissing = !seed.isLoading && !seed.isError && !seed.id;

  const breadcrumb = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.system') },
    { label: t('nav.dashboard') },
  ];

  const create = (name: string, slug: string) => {
    setCreating(false);
    if (!seed.id) return;
    const dashboard = store.createDashboard(seed.id, name, slug);
    navigate(`/dashboards/${dashboard.slug}`);
  };

  const confirmDelete = (d: Dashboard) => {
    modal.confirm({
      title: t('dashboard.deleteTitle', { name: d.name }),
      content: t('dashboard.deleteHint'),
      okButtonProps: { danger: true },
      okText: t('common.delete'),
      onOk: () => store.deleteDashboard(d.id),
    });
  };

  const newButton = (size?: 'large') => (
    <Button type="primary" icon={<PlusOutlined />} size={size} disabled={!seed.id} onClick={() => setCreating(true)}>
      {t('dashboard.new')}
    </Button>
  );

  let body: React.ReactNode;
  if (seedMissing) {
    body = (
      <div style={{ padding: '32px 24px', textAlign: 'center' }} data-component="DashboardSetup">
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          {t('dashboard.setupTitle')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('dashboard.setupHint')}</Typography.Text>
      </div>
    );
  } else if (dashboards.length === 0) {
    body = (
      <Empty
        image={<BarChartOutlined style={{ fontSize: 48, opacity: 0.4 }} />}
        styles={{ image: { height: 80, display: 'flex', justifyContent: 'center', alignItems: 'center' } }}
        description={
          <>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
              {t('dashboard.emptyTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('dashboard.emptyList')}</Typography.Text>
          </>
        }
        style={{ padding: '48px 0' }}
        data-component="DashboardListEmpty"
      >
        {newButton('large')}
      </Empty>
    );
  } else {
    body = (
      <Row gutter={[16, 16]}>
        {dashboards.map((d) => (
          <Col key={d.id} xs={24} md={12} xl={8} xxl={6}>
            <DashboardCard
              dashboard={d}
              onOpen={(slug) => navigate(`/dashboards/${slug}`)}
              onRename={setRenaming}
              onDelete={confirmDelete}
            />
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <PageContainer width="data" dataComponent="DashboardListPage">
      <PageHeader
        breadcrumb={breadcrumb}
        title={t('dashboard.listTitle')}
        subtitle={t('dashboard.listSubtitle')}
        actions={newButton()}
        onNavigate={(r) => navigate(r)}
      />
      <PageCard>{body}</PageCard>

      <NameModal
        open={creating}
        title={t('dashboard.newTitle')}
        okText={t('common.create')}
        withSlug
        onSubmit={create}
        onCancel={() => setCreating(false)}
      />
      <NameModal
        open={renaming !== null}
        title={t('dashboard.renameTitle')}
        initialName={renaming?.name}
        okText={t('common.rename')}
        onSubmit={(name) => {
          if (renaming) store.renameDashboard(renaming.id, name);
          setRenaming(null);
        }}
        onCancel={() => setRenaming(null)}
      />
    </PageContainer>
  );
}

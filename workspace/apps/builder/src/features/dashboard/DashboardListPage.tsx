// DashboardListPage (R101) — /settings/dashboard. The dashboard catalog +
// create. Lists every workspace's dashboards (a dashboard is workspace-scoped,
// so the catalog fans out one list per workspace via useAllDashboards) with the
// owning project shown on each card. Follows the workspaces catalog layout
// (PageContainer → PageHeader → PageCard → card grid with an overflow ⋯ menu)
// so the dashboard catalog reads identically to the workspaces one
// ([[layout-is-the-architecture]] — strict on the shared skeleton).
//
// Create/rename/delete are the dashboard's own lifecycle and live HERE (the
// detail view is for viewing + building widgets). Create picks the workspace
// (project) once; widgets then inherit it.

import {
  BarChartOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { PageCard, PageContainer, PageHeader } from '@mdd/ui';
import { App, Button, Card, Col, Dropdown, Empty, Row, Spin, Typography, theme } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ApiErrorThrown } from '@/features/data-management/_shared/types';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import {
  useAllDashboards,
  useCreateDashboardMutation,
  useDeleteDashboardMutation,
  useUpdateDashboardMutation,
} from './hooks';
import { NameModal } from './NameModal';
import type { Dashboard } from './types';
import { widgetsToDefinition } from './wire';

function dashboardPath(d: Dashboard): string {
  return `/dashboards/${d.workspaceId}/${d.slug}`;
}

function DashboardCard({
  dashboard,
  workspaceName,
  onOpen,
  onRename,
  onDelete,
}: Readonly<{
  dashboard: Dashboard;
  workspaceName: string;
  onOpen: (d: Dashboard) => void;
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
      onClick={() => onOpen(dashboard)}
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
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
        {dashboard.name}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
        {workspaceName}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('dashboard.widgetCount', { count: dashboard.widgets.length })}
      </Typography.Text>
    </Card>
  );
}

export function DashboardListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { modal, message } = App.useApp();
  const workspaces = useWorkspacesQuery();
  const { items, isLoading } = useAllDashboards();
  const createMutation = useCreateDashboardMutation();
  const updateMutation = useUpdateDashboardMutation();
  const deleteMutation = useDeleteDashboardMutation();

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Dashboard | null>(null);

  const noWorkspaces = !workspaces.isLoading && (workspaces.data?.length ?? 0) === 0;

  const create = async (name: string, slug: string, workspaceId: string | undefined) => {
    if (!workspaceId) return;
    setCreating(false);
    try {
      const created = await createMutation.mutateAsync({
        workspaceId,
        body: { name, slug, definition: { widgets: [] } },
      });
      navigate(dashboardPath(created));
    } catch (err) {
      const code = err instanceof ApiErrorThrown ? err.body.code : undefined;
      if (code === 'name_taken') message.error(t('dashboard.error.nameTaken'));
      else if (code === 'slug_taken') message.error(t('dashboard.error.slugTaken'));
      else message.error(t('common.error'));
    }
  };

  const rename = async (name: string) => {
    const d = renaming;
    setRenaming(null);
    if (!d) return;
    try {
      await updateMutation.mutateAsync({
        id: d.id,
        body: { name, slug: d.slug, definition: widgetsToDefinition(d.widgets) },
      });
    } catch (err) {
      const code = err instanceof ApiErrorThrown ? err.body.code : undefined;
      message.error(code === 'name_taken' ? t('dashboard.error.nameTaken') : t('common.error'));
    }
  };

  const confirmDelete = (d: Dashboard) => {
    modal.confirm({
      title: t('dashboard.deleteTitle', { name: d.name }),
      content: t('dashboard.deleteHint'),
      okButtonProps: { danger: true },
      okText: t('common.delete'),
      onOk: () => deleteMutation.mutateAsync(d.id).catch(() => message.error(t('common.error'))),
    });
  };

  const newButton = (size?: 'large') => (
    <Button
      type="primary"
      icon={<PlusOutlined />}
      size={size}
      disabled={noWorkspaces}
      onClick={() => setCreating(true)}
    >
      {t('dashboard.new')}
    </Button>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div style={{ padding: '48px 0', textAlign: 'center' }} data-component="DashboardListLoading">
        <Spin />
      </div>
    );
  } else if (noWorkspaces) {
    body = (
      <div style={{ padding: '32px 24px', textAlign: 'center' }} data-component="DashboardSetup">
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          {t('dashboard.setupTitle')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('dashboard.setupHint')}</Typography.Text>
      </div>
    );
  } else if (items.length === 0) {
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
        {items.map(({ dashboard, workspaceName }) => (
          <Col key={dashboard.id} xs={24} md={12} xl={8} xxl={6}>
            <DashboardCard
              dashboard={dashboard}
              workspaceName={workspaceName}
              onOpen={(d) => navigate(dashboardPath(d))}
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
        breadcrumb={[{ label: t('nav.home'), route: '/' }, { label: t('nav.system') }, { label: t('nav.dashboard') }]}
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
        workspaces={workspaces.data ?? []}
        onSubmit={create}
        onCancel={() => setCreating(false)}
      />
      <NameModal
        open={renaming !== null}
        title={t('dashboard.renameTitle')}
        initialName={renaming?.name}
        okText={t('common.rename')}
        onSubmit={rename}
        onCancel={() => setRenaming(null)}
      />
    </PageContainer>
  );
}

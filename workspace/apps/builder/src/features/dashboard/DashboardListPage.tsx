// DashboardListPage (R101) — /dashboard. Lists the workspace's dashboards (FE
// state this round) + create. Replaces R100's single static page; individual
// dashboards now live at /dashboard/:id.

import { PlusOutlined } from '@ant-design/icons';
import { PageContainer, PageHeader } from '@mdd/ui';
import { App, Button, Card, Col, Empty, Row, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useSeedWorkspace } from './hooks';
import { NameModal } from './NameModal';
import { useDashboardStore } from './store';

export function DashboardListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const seed = useSeedWorkspace();
  const store = useDashboardStore();
  const [creating, setCreating] = useState(false);

  const dashboards = store.dashboards.filter((d) => d.workspaceId === seed.id);
  const seedMissing = !seed.isLoading && !seed.isError && !seed.id;

  const breadcrumb = [{ label: t('nav.home'), route: '/' }, { label: t('nav.dashboard') }];

  const create = (name: string) => {
    setCreating(false);
    if (!seed.id) return;
    const dashboard = store.createDashboard(seed.id, name);
    navigate(`/dashboard/${dashboard.id}`);
  };

  const confirmDelete = (id: string, name: string) => {
    modal.confirm({
      title: t('dashboard.deleteTitle', { name }),
      content: t('dashboard.deleteHint'),
      okButtonProps: { danger: true },
      okText: t('common.delete'),
      onOk: () => store.deleteDashboard(id),
    });
  };

  return (
    <PageContainer width="data" dataComponent="DashboardListPage">
      <PageHeader
        breadcrumb={breadcrumb}
        title={t('dashboard.listTitle')}
        subtitle={t('dashboard.listSubtitle')}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!seed.id}
            onClick={() => setCreating(true)}
            data-component="DashboardNew"
          >
            {t('dashboard.new')}
          </Button>
        }
        onNavigate={(r) => navigate(r)}
      />

      {seedMissing ? (
        <Card data-component="DashboardSetup">
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('dashboard.setupTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('dashboard.setupHint')}</Typography.Text>
          </div>
        </Card>
      ) : dashboards.length === 0 ? (
        <Card data-component="DashboardListEmpty">
          <Empty description={t('dashboard.emptyList')}>
            <Button type="primary" icon={<PlusOutlined />} disabled={!seed.id} onClick={() => setCreating(true)}>
              {t('dashboard.new')}
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {dashboards.map((d) => (
            <Col key={d.id} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                title={d.name}
                onClick={() => navigate(`/dashboard/${d.id}`)}
                data-component="DashboardCard"
                actions={[
                  <Button
                    key="delete"
                    type="text"
                    danger
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete(d.id, d.name);
                    }}
                  >
                    {t('common.delete')}
                  </Button>,
                ]}
              >
                <Typography.Text type="secondary">
                  {t('dashboard.widgetCount', { count: d.widgets.length })}
                </Typography.Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <NameModal
        open={creating}
        title={t('dashboard.newTitle')}
        okText={t('common.create')}
        onSubmit={create}
        onCancel={() => setCreating(false)}
      />
    </PageContainer>
  );
}

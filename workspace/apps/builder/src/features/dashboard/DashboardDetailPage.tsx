// DashboardDetailPage (R101) — /dashboard/:id. The widget grid for one
// dashboard (FE state this round) + the formula-free widget builder
// (add / edit / remove). Reuses R100's chart rendering via WidgetView.

import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { PageContainer, PageHeader } from '@mdd/ui';
import { App, Button, Card, Col, Empty, Row, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { NameModal } from './NameModal';
import { useDashboardStore } from './store';
import type { Widget } from './types';
import { WidgetBuilder } from './WidgetBuilder';
import { WidgetView } from './WidgetView';

export function DashboardDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { modal } = App.useApp();
  const store = useDashboardStore();
  const dashboard = id ? store.get(id) : undefined;

  const [renaming, setRenaming] = useState(false);
  // null = builder closed; { initial?: Widget } = open (add when no initial).
  const [builder, setBuilder] = useState<{ initial?: Widget } | null>(null);

  const breadcrumb = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dashboard'), route: '/dashboard' },
    { label: dashboard?.name ?? '…' },
  ];

  if (!dashboard) {
    return (
      <PageContainer width="data" dataComponent="DashboardDetailNotFound">
        <PageHeader breadcrumb={breadcrumb} title={t('dashboard.notFoundTitle')} onNavigate={(r) => navigate(r)} />
        <Card>
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <Typography.Text type="secondary">{t('dashboard.notFoundHint')}</Typography.Text>
            <div style={{ marginTop: 16 }}>
              <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard')}>
                {t('dashboard.backToList')}
              </Button>
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const dash = dashboard;

  const confirmDeleteDashboard = () => {
    modal.confirm({
      title: t('dashboard.deleteTitle', { name: dash.name }),
      content: t('dashboard.deleteHint'),
      okButtonProps: { danger: true },
      okText: t('common.delete'),
      onOk: () => {
        store.deleteDashboard(dash.id);
        navigate('/dashboard', { replace: true });
      },
    });
  };

  const confirmRemoveWidget = (widget: Widget) => {
    modal.confirm({
      title: t('dashboard.builder.removeTitle', { title: widget.title }),
      okButtonProps: { danger: true },
      okText: t('common.delete'),
      onOk: () => store.removeWidget(dash.id, widget.id),
    });
  };

  const submitWidget = (widget: Omit<Widget, 'id'>) => {
    if (builder?.initial) {
      store.updateWidget(dash.id, { ...widget, id: builder.initial.id });
    } else {
      store.addWidget(dash.id, widget);
    }
    setBuilder(null);
  };

  return (
    <PageContainer width="data" dataComponent="DashboardDetailPage">
      <PageHeader
        breadcrumb={breadcrumb}
        title={dash.name}
        actions={
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <Button icon={<EditOutlined />} onClick={() => setRenaming(true)} data-component="DashboardRename">
              {t('common.rename')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setBuilder({})} data-component="DashboardAddWidget">
              {t('dashboard.builder.add')}
            </Button>
            <Button danger onClick={confirmDeleteDashboard} data-component="DashboardDelete">
              {t('common.delete')}
            </Button>
          </span>
        }
        onNavigate={(r) => navigate(r)}
      />

      {dash.widgets.length === 0 ? (
        <Card data-component="DashboardNoWidgets">
          <Empty description={t('dashboard.noWidgets')}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setBuilder({})}>
              {t('dashboard.builder.addFirst')}
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {dash.widgets.map((w) => (
            <Col key={w.id} xs={24} lg={8}>
              <WidgetView
                widget={w}
                extra={
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <Button type="text" size="small" onClick={() => setBuilder({ initial: w })}>
                      {t('common.edit')}
                    </Button>
                    <Button type="text" size="small" danger onClick={() => confirmRemoveWidget(w)}>
                      {t('common.delete')}
                    </Button>
                  </span>
                }
              />
            </Col>
          ))}
        </Row>
      )}

      <WidgetBuilder
        open={builder !== null}
        workspaceId={dash.workspaceId}
        initial={builder?.initial}
        onSubmit={submitWidget}
        onCancel={() => setBuilder(null)}
      />

      <NameModal
        open={renaming}
        title={t('dashboard.renameTitle')}
        initialName={dash.name}
        okText={t('common.rename')}
        onSubmit={(name) => {
          store.renameDashboard(dash.id, name);
          setRenaming(false);
        }}
        onCancel={() => setRenaming(false)}
      />
    </PageContainer>
  );
}

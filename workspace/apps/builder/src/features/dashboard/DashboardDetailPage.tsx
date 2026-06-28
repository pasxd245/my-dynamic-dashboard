// DashboardDetailPage (R101) — /dashboards/:workspaceId/:slug. The widget grid
// for one dashboard (persisted) + the formula-free widget builder
// (add / edit / remove). Reuses R100's chart rendering via WidgetView.
//
// The dashboard is resolved by (workspace, slug) from the workspace's dashboard
// list — slug is unique per-workspace and the route carries the workspace, so
// no global slug lookup is needed. Each widget edit persists the WHOLE
// definition via PUT (the full-representation update). The dashboard's own
// lifecycle (rename / delete) lives on the Settings › Dashboard list, not here.
// Each widget carries its OWN width (1–3 cols of a 3-col grid; Tableau-style).

import { DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import { PageContainer, PageHeader } from '@mdd/ui';
import { App, Button, Card, Col, Dropdown, Empty, Row, Spin } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { NotFoundPage } from '@/components/NotFoundPage';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import { useDashboardsQuery, useUpdateDashboardMutation } from './hooks';
import type { Widget, WidgetSpan } from './types';
import { WidgetBuilder } from './WidgetBuilder';
import { WidgetView } from './WidgetView';
import { widgetsToDefinition } from './wire';

// Per-widget span (of a 3-col grid) → responsive Col span (collapses on
// smaller screens): 1 = third, 2 = two-thirds, 3 = full row.
const COL_SPANS: Record<WidgetSpan, Record<string, number>> = {
  1: { xs: 24, md: 12, xl: 8 },
  2: { xs: 24, xl: 16 },
  3: { xs: 24 },
};

/** Client-generated widget id (`wdg_<8 hex>`). The widget is an embedded
 *  sub-object the builder manipulates before any save, so the FE owns its id. */
function newWidgetId(): string {
  return `wdg_${crypto.randomUUID().slice(0, 8)}`;
}

export function DashboardDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId, slug } = useParams<{ workspaceId: string; slug: string }>();
  const { modal, message } = App.useApp();

  const dashboardsQ = useDashboardsQuery(workspaceId);
  const dashboard = dashboardsQ.data?.find((d) => d.slug === slug);
  const workspaces = useWorkspacesQuery();
  const updateMutation = useUpdateDashboardMutation();

  const [builder, setBuilder] = useState<{ initial?: Widget } | null>(null);

  if (dashboardsQ.isLoading) {
    return (
      <PageContainer width="data" dataComponent="DashboardDetailPage">
        <div style={{ padding: '64px 0', textAlign: 'center' }}>
          <Spin />
        </div>
      </PageContainer>
    );
  }

  // Loaded but no match (deleted / stale / typo'd link) → the global 404, not a
  // dashboard-flavoured page with a misleading breadcrumb.
  if (!dashboard) return <NotFoundPage />;

  const dash = dashboard;
  const workspaceName = workspaces.data?.find((w) => w.id === dash.workspaceId)?.name ?? '';
  // Mirror the nav path: Home › Dashboards › ‹Workspace› › ‹name›. The
  // Dashboards + Workspace segments are nav groupings (no page), so they're
  // inert labels; only Home links. (Manage/create lives under Settings ›
  // Dashboard, reachable from the sidebar — not this view's breadcrumb.)
  const breadcrumb = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dashboards') },
    ...(workspaceName ? [{ label: workspaceName }] : []),
    { label: dash.name },
  ];

  // Every widget mutation persists the WHOLE dashboard (full-representation PUT):
  // build the next widget list, send name + slug (unchanged) + the new widgets.
  const persistWidgets = (widgets: Widget[]) =>
    updateMutation
      .mutateAsync({ id: dash.id, body: { name: dash.name, slug: dash.slug, definition: widgetsToDefinition(widgets) } })
      .catch(() => message.error(t('common.error')));

  const confirmRemoveWidget = (widget: Widget) => {
    modal.confirm({
      title: t('dashboard.builder.removeTitle', { title: widget.title }),
      okButtonProps: { danger: true },
      okText: t('common.delete'),
      onOk: () => persistWidgets(dash.widgets.filter((w) => w.id !== widget.id)),
    });
  };

  const submitWidget = (widget: Omit<Widget, 'id'>) => {
    const initial = builder?.initial;
    const next = initial
      ? dash.widgets.map((w) => (w.id === initial.id ? { ...widget, id: initial.id } : w))
      : [...dash.widgets, { ...widget, id: newWidgetId() }];
    void persistWidgets(next);
    setBuilder(null);
  };

  // Width is a persisted widget option set in the builder (Create/Edit); the
  // card header carries just the ⋯ menu (Edit / Delete).
  const widgetExtra = (w: Widget) => (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          { key: 'edit', icon: <EditOutlined />, label: t('common.edit'), onClick: () => setBuilder({ initial: w }) },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: t('common.delete'),
            danger: true,
            onClick: () => confirmRemoveWidget(w),
          },
        ],
      }}
    >
      <Button
        type="text"
        size="small"
        icon={<MoreOutlined />}
        aria-label={`${w.title} — ${t('common.edit')} / ${t('common.delete')}`}
        data-component="WidgetMoreButton"
      />
    </Dropdown>
  );

  return (
    <PageContainer width="data" dataComponent="DashboardDetailPage">
      <PageHeader
        breadcrumb={breadcrumb}
        title={dash.name}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setBuilder({})} data-component="DashboardAddWidget">
            {t('dashboard.builder.add')}
          </Button>
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
            <Col key={w.id} {...COL_SPANS[w.span]}>
              <WidgetView widget={w} extra={widgetExtra(w)} />
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
    </PageContainer>
  );
}

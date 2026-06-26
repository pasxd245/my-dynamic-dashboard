// DashboardDetailPage (R101) — /dashboards/:slug. The widget grid for one
// dashboard (FE state this round) + the formula-free widget builder
// (add / edit / remove). Reuses R100's chart rendering via WidgetView.
//
// The dashboard's own lifecycle (rename / delete) is managed from the
// Settings › Dashboard list, not here — this view is for viewing + building.
// Each widget carries its OWN width (1–3 cols of a 3-col grid; Tableau-style),
// set inline on the card — a small widget sits 3-up, a big one takes the row.

import { DeleteOutlined, EditOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import { PageContainer, PageHeader } from '@mdd/ui';
import { App, Button, Card, Col, Dropdown, Empty, Row } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { NotFoundPage } from '@/components/NotFoundPage';
import { useDashboardStore } from './store';
import type { Widget, WidgetSpan } from './types';
import { WidgetBuilder } from './WidgetBuilder';
import { WidgetView } from './WidgetView';

// Per-widget span (of a 3-col grid) → responsive Col span (collapses on
// smaller screens): 1 = third, 2 = two-thirds, 3 = full row.
const COL_SPANS: Record<WidgetSpan, Record<string, number>> = {
  1: { xs: 24, md: 12, xl: 8 },
  2: { xs: 24, xl: 16 },
  3: { xs: 24 },
};

export function DashboardDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { modal } = App.useApp();
  const store = useDashboardStore();
  const dashboard = slug ? store.getBySlug(slug) : undefined;

  const [builder, setBuilder] = useState<{ initial?: Widget } | null>(null);

  // An unknown slug (deleted / stale / typo'd link) is just "not found" — the
  // global 404, not a dashboard-flavoured page with a misleading breadcrumb.
  if (!dashboard) return <NotFoundPage />;

  const dash = dashboard;
  // Mirror the nav path: Home › Settings › Dashboard (the list/manage) › ‹name›.
  const breadcrumb = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.system') },
    { label: t('nav.dashboard'), route: '/settings/dashboard' },
    { label: dash.name },
  ];

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

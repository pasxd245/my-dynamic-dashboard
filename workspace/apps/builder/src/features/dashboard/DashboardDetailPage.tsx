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
//
// R102 — widgets are drag-reorderable (by a per-card handle) via @dnd-kit;
// the order is definition.widgets[] order, persisted on drop via the same PUT
// (no contract change). Pointer + keyboard sensors; optimistic order, revert on
// a failed save.

import {
  DeleteOutlined,
  EditOutlined,
  FilterFilled,
  FilterOutlined,
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PageContainer, PageHeader } from '@mdd/ui';
import { App, Button, Card, Col, Dropdown, Empty, Row, Space, Spin, Tooltip, theme } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { NotFoundPage } from '@/components/NotFoundPage';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import type { DashboardFilter } from './aggregate';
import { useDashboardsQuery, useUpdateDashboardMutation } from './hooks';
import type { Widget, WidgetSpan } from './types';
import { WidgetBuilder } from './WidgetBuilder';
import { WidgetFilterDrawer } from './WidgetFilterDrawer';
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

/** One widget as a sortable grid cell. The drag activator is the HANDLE only
 *  (not the whole card), so the ⋯ menu and the interactive chart keep their
 *  clicks; the handle is keyboard-focusable (dnd-kit keyboard sensor). */
function SortableWidget({
  widget,
  canReorder,
  handleLabel,
  handleTooltip,
  filterActive,
  filterLabel,
  onOpenFilter,
  menu,
  filters,
}: Readonly<{
  widget: Widget;
  canReorder: boolean;
  handleLabel: string;
  handleTooltip: string;
  filterActive: boolean;
  filterLabel: string;
  onOpenFilter: () => void;
  menu: React.ReactNode;
  filters: readonly DashboardFilter[];
}>) {
  const { token } = theme.useToken();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : undefined,
  };
  const handle = canReorder ? (
    <Tooltip title={handleTooltip}>
      <Button
        type="text"
        size="small"
        ref={setActivatorNodeRef}
        icon={<HolderOutlined />}
        aria-label={handleLabel}
        // The `move` cursor (four-way arrows) makes "this moves" obvious; the
        // ⋮⋮ holder icon stays as the recognizable drag affordance.
        style={{ cursor: 'move', touchAction: 'none' }}
        data-component="WidgetDragHandle"
        {...attributes}
        {...listeners}
      />
    </Tooltip>
  ) : null;
  // Filter affordance: filled + primary-coloured when this widget has an active
  // filter, outline otherwise (an honest active/inactive status).
  const filterButton = (
    <Tooltip title={filterLabel}>
      <Button
        type="text"
        size="small"
        icon={filterActive ? <FilterFilled /> : <FilterOutlined />}
        onClick={onOpenFilter}
        aria-label={filterLabel}
        aria-pressed={filterActive}
        style={filterActive ? { color: token.colorPrimary } : undefined}
        data-component="WidgetFilterButton"
      />
    </Tooltip>
  );
  return (
    <Col ref={setNodeRef} style={style} {...COL_SPANS[widget.span]}>
      <WidgetView widget={widget} filters={filters} extra={<Space size={0}>{handle}{filterButton}{menu}</Space>} />
    </Col>
  );
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

  // R102 reorder — display order (widget ids). Kept local for an optimistic
  // reorder on drop; resynced whenever the server order/set changes (so a
  // successful save is a no-op and a failed save / external edit reverts).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const serverKey = (dashboard?.widgets ?? []).map((w) => w.id).join(',');
  useEffect(() => {
    setOrderIds(serverKey ? serverKey.split(',') : []);
  }, [serverKey]);

  // R103 — runtime, client-side PER-WIDGET filters (FE state, resets per visit):
  // a map widgetId → filters, plus the widget whose filter Drawer is open.
  const [filtersByWidget, setFiltersByWidget] = useState<Record<string, DashboardFilter[]>>({});
  const [filterWidget, setFilterWidget] = useState<Widget | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const filtersFor = (id: string): DashboardFilter[] => filtersByWidget[id] ?? [];

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

  const widgetsById = new Map(dash.widgets.map((w) => [w.id, w]));
  // Display widgets in the local order; fall back to server order, and drop any
  // ids the optimistic order hasn't caught up on (e.g. just-removed widget).
  const displayIds = orderIds.filter((id) => widgetsById.has(id));
  const ordered: Widget[] = displayIds.map((id) => widgetsById.get(id) as Widget);
  const canReorder = ordered.length > 1;

  // Every widget mutation persists the WHOLE dashboard (full-representation PUT):
  // build the next widget list, send name + slug (unchanged) + the new widgets.
  const persistWidgets = (widgets: Widget[]) =>
    updateMutation
      .mutateAsync({ id: dash.id, body: { name: dash.name, slug: dash.slug, definition: widgetsToDefinition(widgets) } })
      .catch(() => message.error(t('common.error')));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const prev = displayIds;
    const oldIndex = prev.indexOf(String(active.id));
    const newIndex = prev.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const nextIds = arrayMove(prev, oldIndex, newIndex);
    setOrderIds(nextIds); // optimistic
    const nextWidgets = nextIds.map((id) => widgetsById.get(id) as Widget);
    updateMutation
      .mutateAsync({
        id: dash.id,
        body: { name: dash.name, slug: dash.slug, definition: widgetsToDefinition(nextWidgets) },
      })
      .catch(() => {
        setOrderIds(prev); // revert the optimistic reorder
        message.error(t('common.error'));
      });
  };

  const announce = (id: string) => widgetsById.get(id)?.title ?? '';
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('dashboard.reorder.picked', {
        title: announce(String(active.id)),
        position: displayIds.indexOf(String(active.id)) + 1,
        total: displayIds.length,
      }),
    onDragOver: () => undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('dashboard.reorder.moved', {
            title: announce(String(active.id)),
            position: displayIds.indexOf(String(over.id)) + 1,
            total: displayIds.length,
          })
        : t('dashboard.reorder.cancelled'),
    onDragCancel: () => t('dashboard.reorder.cancelled'),
  };

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

  // The card header carries the drag handle (R102, added in SortableWidget) +
  // this ⋯ menu (Edit / Delete).
  const widgetMenu = (w: Widget) => (
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

      {ordered.length === 0 ? (
        <Card data-component="DashboardNoWidgets">
          <Empty description={t('dashboard.noWidgets')}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setBuilder({})}>
              {t('dashboard.builder.addFirst')}
            </Button>
          </Empty>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{ announcements }}
        >
          <SortableContext items={displayIds} strategy={rectSortingStrategy}>
            <Row gutter={[16, 16]}>
              {ordered.map((w) => (
                <SortableWidget
                  key={w.id}
                  widget={w}
                  canReorder={canReorder}
                  handleLabel={t('dashboard.reorder.handle', { title: w.title })}
                  handleTooltip={t('dashboard.reorder.tooltip')}
                  filterActive={filtersFor(w.id).some((f) => f.values.length > 0)}
                  filterLabel={t('dashboard.filter.iconLabel', { title: w.title })}
                  onOpenFilter={() => {
                    setFilterWidget(w);
                    setFilterDrawerOpen(true);
                  }}
                  menu={widgetMenu(w)}
                  filters={filtersFor(w.id)}
                />
              ))}
            </Row>
          </SortableContext>
        </DndContext>
      )}

      <WidgetBuilder
        open={builder !== null}
        workspaceId={dash.workspaceId}
        initial={builder?.initial}
        onSubmit={submitWidget}
        onCancel={() => setBuilder(null)}
      />

      <WidgetFilterDrawer
        open={filterDrawerOpen}
        widget={filterWidget}
        filters={filterWidget ? filtersFor(filterWidget.id) : []}
        onChange={(next) =>
          filterWidget && setFiltersByWidget((prev) => ({ ...prev, [filterWidget.id]: next }))
        }
        onClose={() => setFilterDrawerOpen(false)}
        afterClose={() => setFilterWidget(null)}
      />
    </PageContainer>
  );
}

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
  DownloadOutlined,
  HolderOutlined,
  InfoCircleOutlined,
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
import { App, Button, Card, Dropdown, Empty, Grid, Popover, Space, Spin, Tooltip, theme } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { NotFoundPage } from '@/components/NotFoundPage';
import { useMetadataQuery } from '@/features/metadata/hooks';
import { ApiErrorThrown } from '@/features/data-management/_shared/types';
import { downloadWidgetExport } from './exportWidget';
import { MetadataEntriesList, MetadataPanel } from '@/features/metadata/MetadataPanel';
import type { MetadataAnchor, MetadataEntries } from '@/features/metadata/types';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import type { DashboardFilter } from './aggregate';
import { useDashboardsQuery, useUpdateDashboardMutation } from './hooks';
import type { DashboardControl, Widget } from './types';
import type { ResolvedParams } from '@/features/data-management/queries/types';
import { WidgetBuilder } from './WidgetBuilder';
import { WidgetFilterDrawer } from './WidgetFilterDrawer';
import { WidgetView } from './WidgetView';
import {
  ControlsEditor,
  ControlsIcon,
  DashboardControlBar,
  DashboardParamsContext,
  ReachBadge,
  bindableParams,
  controlReach,
  controlValuesFrom,
  useWidgetParamContext,
} from './DashboardParams';
import { paramsFromSearch, withParam, withoutParams } from '@/features/data-management/queries/params';
import { useQueriesQuery } from '@/features/data-management/queries/hooks';
import { widgetsToDefinition } from './wire';

// R177 — the dashboard is a CSS grid (was an AntD flex-wrap Row/Col). A flex
// row can only be as tall as its tallest card, so a widget two rows tall left
// empty space under its one-row neighbours; in a 2-D grid the next widgets
// flow into that space, so `Widget.rows` is a layout, not just a bigger box.
// Column count keeps the old responsive collapse: 3 at `xl`, 2 at `md`, else 1.
// Auto-placement is sparse (no `dense`), so a dashboard whose widgets are all
// one row tall keeps exactly the positions the flex grid gave it.
const GRID_GAP = 16;

/** Columns in the grid for the current breakpoints (AntD `useBreakpoint`).
 *  Nothing known yet (first render, or no `matchMedia`) → the desktop 3. */
export function gridColumns(screens: Readonly<Partial<Record<string, boolean>>>): 1 | 2 | 3 {
  if (screens.xl) return 3;
  if (screens.md) return 2;
  if (screens.xs || screens.sm || screens.lg) return 1;
  return 3;
}

/** A widget's cell: its `span` clipped to the grid's columns (a 2-wide widget
 *  on a 2-column grid is a full row, as before), by its `rows` (absent → 1). */
export function gridCell(widget: Pick<Widget, 'span' | 'rows'>, cols: 1 | 2 | 3): { cols: number; rows: number } {
  return { cols: Math.min(widget.span, cols), rows: widget.rows ?? 1 };
}

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
  gridCols,
  canReorder,
  handleLabel,
  handleTooltip,
  filterActive,
  filterLabel,
  onOpenFilter,
  menu,
  filters,
  metadata,
  metadataCurrent,
  badge,
}: Readonly<{
  widget: Widget;
  gridCols: 1 | 2 | 3;
  canReorder: boolean;
  handleLabel: string;
  handleTooltip: string;
  filterActive: boolean;
  filterLabel: string;
  onOpenFilter: () => void;
  menu: React.ReactNode;
  filters: readonly DashboardFilter[];
  /** R180 — this widget's metadata entries (from the dashboard's one read). */
  metadata?: MetadataEntries;
  /** R197 — this widget's anchor for the reader (what its entries are compared with). */
  metadataCurrent?: MetadataAnchor;
  /** R195 — which parameter controls reached this widget. */
  badge?: React.ReactNode;
}>) {
  const { token } = theme.useToken();
  const { t } = useTranslation();
  const metaTooltip = t('metadata.widgetTooltip');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });
  const cell = gridCell(widget, gridCols);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : undefined,
    gridColumn: `span ${cell.cols}`,
    gridRow: `span ${cell.rows}`,
    minWidth: 0,
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
  // R179 — a note binds no query, so it has nothing to filter.
  const filterButton =
    widget.chartType === 'note' ? null : (
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
  // R180 — an info affordance when something is written about this widget;
  // the popover shows the entries read-only (AI badge, stale flag), nothing to edit.
  const metaCount = metadata ? Object.keys(metadata).length : 0;
  const metaButton =
    metaCount > 0 && metadata ? (
      <Popover
        trigger="click"
        placement="bottomRight"
        content={
          <div style={{ maxWidth: 420, maxHeight: 360, overflow: 'auto' }} data-component="WidgetMetadataPopover">
            <MetadataEntriesList entries={metadata} current={metadataCurrent} />
          </div>
        }
      >
        <Tooltip title={metaTooltip}>
          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined />}
            aria-label={metaTooltip}
            data-component="WidgetMetadataButton"
            data-count={metaCount}
          />
        </Tooltip>
      </Popover>
    ) : null;
  // R182 — a table's numbers go out as a file: every row of the same filtered
  // result the table reads, with its totals row; the server names the file.
  const { message } = App.useApp();
  const paramCtx = useWidgetParamContext(widget.id);
  const exportLabel = t('dashboard.export.label');
  const exportButton =
    widget.chartType === 'table' ? (
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            { key: 'xlsx', label: t('dashboard.export.xlsx') },
            { key: 'csv', label: t('dashboard.export.csv') },
          ],
          onClick: ({ key }) => {
            downloadWidgetExport(widget, filters, key as 'csv' | 'xlsx', paramCtx)
              .then((name) => message.success(t('dashboard.export.done', { name })))
              .catch((err: unknown) => {
                const body =
                  err instanceof ApiErrorThrown ? (err.body as { code?: string; rows?: number; max?: number }) : null;
                message.error(
                  body?.code === 'export_too_large'
                    ? t('dashboard.export.tooLarge', { rows: body.rows ?? 0, max: body.max ?? 0 })
                    : t('dashboard.export.failed'),
                );
              });
          },
        }}
      >
        <Tooltip title={exportLabel}>
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            aria-label={exportLabel}
            data-component="WidgetExportButton"
          />
        </Tooltip>
      </Dropdown>
    ) : null;
  return (
    <div ref={setNodeRef} style={style} data-component="DashboardGridCell" data-span={cell.cols} data-rows={cell.rows}>
      <WidgetView
        widget={widget}
        filters={filters}
        badge={badge}
        extra={
          <Space size={0}>
            {handle}
            {metaButton}
            {exportButton}
            {filterButton}
            {menu}
          </Space>
        }
      />
    </div>
  );
}

export function DashboardDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId, slug } = useParams<{ workspaceId: string; slug: string }>();
  const { modal, message } = App.useApp();
  // R177 — grid columns follow the breakpoint (3 / 2 / 1), as the Col spans did.
  const gridCols = gridColumns(Grid.useBreakpoint());

  const dashboardsQ = useDashboardsQuery(workspaceId);
  const dashboard = dashboardsQ.data?.find((d) => d.slug === slug);
  const workspaces = useWorkspacesQuery();
  const updateMutation = useUpdateDashboardMutation();

  const [builder, setBuilder] = useState<{ initial?: Widget } | null>(null);
  // R195 — parameter controls: viewer values in the URL (`?p.<name>=`), the
  // queries' declarations for types and reach, and the controls editor.
  const [searchParams, setSearchParams] = useSearchParams();
  const viewer = paramsFromSearch(searchParams);
  // R180 — one read serves the dashboard's own entries and every widget's;
  // R197 — under the viewer's values (the panel below shares this read).
  const metadataQ = useMetadataQuery('dashboard', dashboard?.id, viewer);
  const workspaceQueries = useQueriesQuery(workspaceId);
  const [controlsOpen, setControlsOpen] = useState(false);
  // What each widget's latest read used (by widget id; dropped when a read
  // answers nothing, e.g. a refusal). The bar shows, and Copy link pins, the
  // values of the controls that target a widget — derived below, so only a
  // targeted widget's viewer/dashboard value counts (code review N-1).
  const [resolvedByWidget, setResolvedByWidget] = useState<Record<string, ResolvedParams>>({});
  const reportResolved = useCallback((widgetId: string, r: ResolvedParams | undefined) => {
    setResolvedByWidget((prev) => {
      if (JSON.stringify(prev[widgetId]) === JSON.stringify(r)) return prev;
      const next = { ...prev };
      if (r) next[widgetId] = r;
      else delete next[widgetId];
      return next;
    });
  }, []);

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
  const queriesById = new Map((workspaceQueries.data ?? []).map((q) => [q.id, q]));
  const controls = dash.controls ?? [];
  const resolvedByControl: Record<string, string | number> = {};
  for (const w of dash.widgets) {
    const r = resolvedByWidget[w.id];
    if (!r) continue;
    for (const [id, v] of Object.entries(controlValuesFrom(controls, w.id, r))) {
      if (resolvedByControl[id] === undefined) resolvedByControl[id] = v;
    }
  }
  const bindable = bindableParams(dash.widgets, queriesById);
  const saveControls = (next: DashboardControl[]) =>
    updateMutation
      .mutateAsync({
        id: dash.id,
        body: { name: dash.name, slug: dash.slug, definition: widgetsToDefinition(dash.widgets, next) },
      })
      .then(() => {
        setControlsOpen(false);
        message.success(t('dashboard.params.savedToast'));
      })
      .catch(() => message.error(t('common.error')));
  // Display widgets in the local order; fall back to server order, and drop any
  // ids the optimistic order hasn't caught up on (e.g. just-removed widget).
  const displayIds = orderIds.filter((id) => widgetsById.has(id));
  const ordered: Widget[] = displayIds.map((id) => widgetsById.get(id) as Widget);
  const canReorder = ordered.length > 1;

  // Every widget mutation persists the WHOLE dashboard (full-representation PUT):
  // build the next widget list, send name + slug (unchanged) + the new widgets.
  const persistWidgets = (widgets: Widget[]) =>
    updateMutation
      .mutateAsync({
        id: dash.id,
        body: { name: dash.name, slug: dash.slug, definition: widgetsToDefinition(widgets, dash.controls) },
      })
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
        body: { name: dash.name, slug: dash.slug, definition: widgetsToDefinition(nextWidgets, dash.controls) },
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
          <Space>
            <Button
              icon={<ControlsIcon />}
              onClick={() => setControlsOpen(true)}
              data-component="DashboardEditControls"
            >
              {t('dashboard.params.edit')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setBuilder({})}
              data-component="DashboardAddWidget"
            >
              {t('dashboard.builder.add')}
            </Button>
          </Space>
        }
        onNavigate={(r) => navigate(r)}
      />

      <DashboardControlBar
        controls={controls}
        params={bindable}
        viewer={viewer}
        resolved={resolvedByControl}
        onChange={(param, value) => setSearchParams(withParam(searchParams, param, value), { replace: true })}
        onReset={() => setSearchParams(withoutParams(searchParams))}
      />

      <DashboardParamsContext.Provider value={{ viewer, dashboardId: dash.id, controls, report: reportResolved }}>
        <MetadataPanel
          kind="dashboard"
          nounId={dash.id}
          params={viewer}
          childLabel={(id) => dash.widgets.find((w) => w.id === id)?.title ?? id}
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
              <div
                data-component="DashboardGrid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                  gap: GRID_GAP,
                }}
              >
                {ordered.map((w) => (
                  <SortableWidget
                    key={w.id}
                    widget={w}
                    gridCols={gridCols}
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
                    metadata={metadataQ.data?.children?.[w.id]}
                    metadataCurrent={metadataQ.data?.childrenCurrent?.[w.id]}
                    filters={filtersFor(w.id)}
                    badge={
                      <ReachBadge
                        reach={controlReach(controls, w, w.queryId ? queriesById.get(w.queryId) : undefined)}
                      />
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        <WidgetFilterDrawer
          open={filterDrawerOpen}
          widget={filterWidget}
          filters={filterWidget ? filtersFor(filterWidget.id) : []}
          onChange={(next) => filterWidget && setFiltersByWidget((prev) => ({ ...prev, [filterWidget.id]: next }))}
          onClose={() => setFilterDrawerOpen(false)}
          afterClose={() => setFilterWidget(null)}
        />
      </DashboardParamsContext.Provider>

      <ControlsEditor
        open={controlsOpen}
        controls={controls}
        widgets={dash.widgets}
        params={bindable}
        saving={updateMutation.isPending}
        onSave={(next) => void saveControls(next)}
        onClose={() => setControlsOpen(false)}
      />

      {/* R195 — the builder's preview reads with the values the dashboard shows
          (the bar's), not as a dashboard widget: a new widget has no saved id yet. */}
      <DashboardParamsContext.Provider
        value={{
          // Only the values of controls reaching every widget (a new widget has no
          // targets yet), plus the URL's (code review N-2).
          viewer: {
            ...Object.fromEntries(
              controls
                .filter((c) => c.targets === 'all' && resolvedByControl[c.id] !== undefined)
                .map((c) => [c.param, String(resolvedByControl[c.id])]),
            ),
            ...viewer,
          },
        }}
      >
        <WidgetBuilder
          open={builder !== null}
          workspaceId={dash.workspaceId}
          initial={builder?.initial}
          onSubmit={submitWidget}
          onCancel={() => setBuilder(null)}
        />
      </DashboardParamsContext.Provider>
    </PageContainer>
  );
}

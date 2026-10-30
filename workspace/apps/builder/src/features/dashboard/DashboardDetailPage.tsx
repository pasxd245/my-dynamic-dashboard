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
import { App, Button, Card, Dropdown, Empty, Grid, Space, Spin, Tooltip, theme } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { NotFoundPage } from '@/components/NotFoundPage';
import { WidgetMetadataBadges } from '@/features/metadata/badges';
import { MetadataBar, MetadataDockRow, dockBeside, useMetadataDock } from '@/features/metadata/dock';
import { ApiErrorThrown } from '@/features/data-management/_shared/types';
import { downloadWidgetExport } from './exportWidget';
import type { MetadataEntries } from '@/features/metadata/types';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import type { DashboardFilter } from './aggregate';
import { useColumnsOfQueries, useDashboardsQuery, useUpdateDashboardMutation } from './hooks';
import { controlParams, type DashboardControl, type ValuesControl, type Widget } from './types';
import type { DataColumn } from './aggregate';
import {
  parseFilterSelections,
  withParamsRaw,
  withSelectionRaw,
  withoutStaleRaw,
  withoutViewerRaw,
} from './sharedFilters';
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
  paramContextFor,
  useWidgetParamContext,
  useWidgetSharedFilters,
  type ValuesSource,
} from './DashboardParams';
import { paramsFromSearch } from '@/features/data-management/queries/params';
import { useQueriesQuery } from '@/features/data-management/queries/hooks';
import { widgetsToDefinition, type DashboardDefinitionWire } from './wire';
import { DefinitionHistoryButton } from '@/features/history/DefinitionHistoryDrawer';

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

// R206 — one empty list, so a widget without filters gets the same object every
// render (its chart data memo keys on it).
const NO_FILTERS: DashboardFilter[] = [];

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
  onOpenMetadata,
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
  /** R202 — open the dock on this widget's notes. */
  onOpenMetadata: () => void;
  /** R195 — which parameter controls reached this widget. */
  badge?: React.ReactNode;
}>) {
  const { token } = theme.useToken();
  const { t } = useTranslation();
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
  // R180 — an affordance when something is written about this widget; R202 —
  // severity chips (+N) or the info button, opening the dock beside the grid.
  const metaButton = <WidgetMetadataBadges entries={metadata} onOpen={onOpenMetadata} />;
  // R182 — a table's numbers go out as a file: every row of the same filtered
  // result the table reads, with its totals row; the server names the file.
  const { message } = App.useApp();
  const paramCtx = useWidgetParamContext(widget.id);
  const shared = useWidgetSharedFilters(widget.id);
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
            downloadWidgetExport(widget, filters, key as 'csv' | 'xlsx', paramCtx, shared)
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
  const screens = Grid.useBreakpoint();
  const pageCols = gridColumns(screens);

  const dashboardsQ = useDashboardsQuery(workspaceId);
  const dashboard = dashboardsQ.data?.find((d) => d.slug === slug);
  const workspaces = useWorkspacesQuery();
  const updateMutation = useUpdateDashboardMutation();

  const [builder, setBuilder] = useState<{ initial?: Widget } | null>(null);
  // R195 — parameter controls: viewer values in the URL (`?p.<name>=`), the
  // queries' declarations for types and reach, and the controls editor.
  const [searchParams] = useSearchParams();
  const viewer = paramsFromSearch(searchParams);
  // R199 — every URL write goes through the ONE raw writer (`sharedFilters`):
  // `f.*` is split before decoding, so its bytes must never be re-serialised by
  // `URLSearchParams` (BA-C2). Reads of `f.*` come from the raw search too.
  const location = useLocation();
  const rawSearch = location.search;
  const selections = parseFilterSelections(rawSearch);
  const writeUrl = (search: string, replace: boolean) =>
    navigate({ pathname: location.pathname, search, hash: location.hash }, { replace });
  // R180 — one read serves the dashboard's own entries and every widget's;
  // R197 — under the viewer's values. R202 — and the dock's state (`?note=`).
  const metaDock = useMetadataDock('dashboard', dashboard?.id, viewer);
  // R202 — the dock sits beside the grid: the grid gives up one column while it is
  // open, so widgets keep a readable width next to the note. R206 — beside only from
  // `xl`; below it the dock goes over the page and the grid keeps its columns.
  const gridCols: 1 | 2 | 3 =
    metaDock.sel && dockBeside(screens) && pageCols > 1 ? ((pageCols - 1) as 1 | 2) : pageCols;
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
  const filtersFor = (id: string): DashboardFilter[] => filtersByWidget[id] ?? NO_FILTERS;

  // R199 (BA-C1) — an `f.` key naming no values control of this dashboard (a link
  // copied before the control was removed) is dropped from the URL on load; the
  // server ignores it too, so the read never failed.
  const cleaned = dashboard ? withoutStaleRaw(rawSearch, dashboard.controls ?? []) : rawSearch;
  useEffect(() => {
    if (dashboard && cleaned !== rawSearch) writeUrl(cleaned, true);
  }, [dashboard?.id, cleaned, rawSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // R199 — the widgets' result columns (D5 reach of a values control; its options' source).
  const columnsByQuery = useColumnsOfQueries((dashboard?.widgets ?? []).flatMap((w) => (w.queryId ? [w.queryId] : [])));

  // R206 — the block's glance config, the same object while its inputs are (its rows
  // memo keys on it). Computed before the early returns, from the loaded dashboard.
  const glanceOrder = orderIds.filter((id) => dashboard?.widgets.some((w) => w.id === id)).join(',');
  const glanceTitles = (dashboard?.widgets ?? []).map((w) => `${w.id}=${w.title}`).join('\n');
  const glance = useMemo(
    () =>
      dashboard
        ? {
            dashboardId: dashboard.id,
            childOrder: glanceOrder ? glanceOrder.split(',') : [],
            childLabel: (id: string) => dashboard.widgets.find((w) => w.id === id)?.title ?? id,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dashboard?.id, glanceOrder, glanceTitles],
  );

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
  // R197 — "written for As of 2026-10-11": a control's label names its parameter;
  // R198 — a range's two parameters read "Period · from" / "Period · to".
  const controlLabels = Object.fromEntries(
    controls.flatMap((c) =>
      c.kind === 'values'
        ? []
        : c.kind === 'date_range'
          ? [
              [c.from, `${c.label} · ${t('dashboard.params.range.from')}`],
              [c.to, `${c.label} · ${t('dashboard.params.range.to')}`],
            ]
          : [[c.param, c.label]],
    ),
  );
  // The server-resolved value per parameter name (R198: was per control id — a
  // range control owns two names; one control per name is a save rule).
  const resolvedByParam: Record<string, string | number> = {};
  for (const w of dash.widgets) {
    const r = resolvedByWidget[w.id];
    if (!r) continue;
    for (const [name, v] of Object.entries(controlValuesFrom(controls, w.id, r))) {
      if (resolvedByParam[name] === undefined) resolvedByParam[name] = v;
    }
  }
  const bindable = bindableParams(dash.widgets, queriesById);
  // R199 — the result column names of a widget (undefined while unknown).
  const widgetColumns = (w: Widget): readonly string[] | undefined => {
    const cols = w.queryId ? columnsByQuery.get(w.queryId) : undefined;
    return cols?.map((c) => c.name);
  };
  // Every result column of the dashboard's queries (the editor's choices), once.
  const allColumns: DataColumn[] = [];
  for (const cols of columnsByQuery.values()) {
    for (const c of cols) if (!allColumns.some((a) => a.name === c.name)) allColumns.push(c);
  }
  const columnWidgets = (column: string) =>
    dash.widgets.filter((w) => w.chartType !== 'note' && widgetColumns(w)?.includes(column)).map((w) => w.id);
  // D4 — a values control's options come from the first targeted widget whose
  // result has the column, read with that widget's parameter context.
  const valuesSource = (c: ValuesControl): ValuesSource => {
    const w = dash.widgets.find(
      (x) =>
        x.chartType !== 'note' &&
        x.queryId &&
        (c.targets === 'all' || c.targets.includes(x.id)) &&
        widgetColumns(x)?.includes(c.column),
    );
    if (!w?.queryId) return undefined;
    return { queryId: w.queryId, ctx: paramContextFor({ viewer, dashboardId: dash.id, controls }, w.id) };
  };
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
  const widgetTitle = (id: string) => widgetsById.get(id)?.title ?? id;
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
            {/* R200 (4.4) — the definition history; Restore re-saves an old definition
                with the current name / slug through the ordinary update. */}
            <DefinitionHistoryButton
              kind="dashboard"
              nounId={dash.id}
              nounName={dash.name}
              restore={(definition) =>
                updateMutation.mutateAsync({
                  id: dash.id,
                  body: { name: dash.name, slug: dash.slug, definition: definition as DashboardDefinitionWire },
                })
              }
            />
          </Space>
        }
        onNavigate={(r) => navigate(r)}
      />

      <DashboardControlBar
        controls={controls}
        params={bindable}
        viewer={viewer}
        resolved={resolvedByParam}
        onChange={(values) => writeUrl(withParamsRaw(rawSearch, values), true)}
        onReset={() => writeUrl(withoutViewerRaw(rawSearch), false)}
        selections={selections}
        onFilterChange={(id, values) => writeUrl(withSelectionRaw(rawSearch, id, values), true)}
        valuesSource={valuesSource}
      />

      <DashboardParamsContext.Provider
        value={{ viewer, dashboardId: dash.id, controls, report: reportResolved, filters: selections }}
      >
        <MetadataDockRow
          api={metaDock}
          cfg={{
            kind: 'dashboard',
            nounLabel: dash.name,
            paramLabels: controlLabels,
            childLabel: widgetTitle,
            childOrder: displayIds,
          }}
        >
          {/* R206 — one Notes & insights block: the bar and its At a glance rows. */}
          <MetadataBar key={dash.id} api={metaDock} glance={glance} />

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
                      metadata={metaDock.read?.children?.[w.id]}
                      onOpenMetadata={() => metaDock.open({ scope: 'child', child: w.id })}
                      filters={filtersFor(w.id)}
                      badge={
                        <ReachBadge
                          reach={controlReach(
                            controls,
                            w,
                            w.queryId ? queriesById.get(w.queryId) : undefined,
                            widgetColumns(w),
                          )}
                        />
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </MetadataDockRow>
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
        columns={allColumns}
        columnWidgets={columnWidgets}
        valuesSource={valuesSource}
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
                .filter((c) => c.targets === 'all')
                .flatMap(controlParams)
                .filter((name) => resolvedByParam[name] !== undefined)
                .map((name) => [name, String(resolvedByParam[name])]),
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

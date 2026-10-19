// R195 (item 3.7b) — dashboard parameter controls (dashboard-filters.md D3–D5).
// R198 (item 4.2) — the `date_range` control: one control, two date parameters.
//
// - `DashboardParamsContext` — the viewer's values (URL `p.*`) and the dashboard
//   id; every widget read sends both, so the SERVER applies viewer → dashboard
//   saved value → query default, and says what it used.
// - `DashboardControlBar` — one input per control above the grid. A change goes
//   to the URL only (never saved); **Reset to saved** drops the URL values;
//   **Copy link** copies the URL that reopens this view. A date-range control is
//   a preset select plus two date inputs; a preset picked here is computed in
//   the browser and written as two absolute dates (a SAVED preset is the
//   server's to resolve, in `backend.time_zone`).
// - `ControlsEditor` — the edit affordance: add / label / bind / target / saved
//   value / remove, saved with the dashboard (a PUT).
// - `controlReach` + `ReachBadge` — which controls reached a widget and which
//   were skipped and why (D5): a control reaches a targeted widget only when its
//   query USES the parameter (a range: `from` or `to`).
// R199 (item 4.3) — the `values` control (a shared filter): a multi-select on one
//   result column, options from `GET /queries/{id}/values`; a viewer selection
//   lives in the URL as `f.<id>=…` (written through `sharedFilters.writeSearch`,
//   never re-serialised); the server applies the saved one; it reaches a targeted
//   widget whose result HAS the column, skipped and badged otherwise (D5).

import { ControlOutlined, DeleteOutlined, LinkOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Input, InputNumber, Select, Space, Tag, Tooltip, Typography, theme } from 'antd';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isRelative, isoToday, usedParams, valueFits } from '@/features/data-management/queries/params';
import type {
  AggregateFilter,
  ParamContext,
  Query,
  QueryParam,
  ResolvedParams,
} from '@/features/data-management/queries/types';
import type { DataColumn } from './aggregate';
import { presetOf, resolvePreset } from './dateRange';
import { useColumnValues } from './hooks';
import {
  F_PREFIX,
  P_PREFIX,
  encodeSelection,
  sharedItemsFor,
  staleFilterKeys,
  writeSearch,
  type FilterSelections,
} from './sharedFilters';
import {
  DATE_RANGE_PRESETS,
  controlParams,
  type DashboardControl,
  type DateRangeControl,
  type DateRangePreset,
  type DateRangeValue,
  type RelativeDay,
  type ValuesControl,
  type Widget,
} from './types';

export const MAX_CONTROLS = 12;
const RANGE_OPTION = '__date_range__';
const VALUES_OPTION = '__values__';
/** The select key of the `(blank)` option (`null` on the wire, `~blank` in the URL). */
const BLANK_KEY = '\u0000blank';

export type DashboardParamsState = {
  viewer: Record<string, string>;
  dashboardId?: string;
  /** The controls — a viewer value reaches only the widgets its control targets. */
  controls?: readonly DashboardControl[];
  /** Each widget reports what its read used (the bar shows, and the link pins,
   *  the server-resolved values of the controls that target it). */
  report?: (widgetId: string, resolved: ResolvedParams | undefined) => void;
  /** R199 — the viewer's shared-filter selections (URL `f.*`), by control id. */
  filters?: FilterSelections;
};
export const DashboardParamsContext = createContext<DashboardParamsState>({ viewer: {} });

function targetsWidget(c: DashboardControl, widgetId: string): boolean {
  return c.targets === 'all' || c.targets.includes(widgetId);
}

/** The parameter context one widget's reads carry. On a dashboard: the viewer
 *  values of the controls that TARGET this widget (D4 — code review P1-2) and
 *  the widget, whose saved values the server applies. Off a dashboard (the
 *  widget builder's preview): the viewer values as given. */
export function useWidgetParamContext(widgetId: string | undefined): ParamContext | undefined {
  return paramContextFor(useContext(DashboardParamsContext), widgetId);
}

/** The pure rule behind `useWidgetParamContext` (R199: the values control's
 *  option read uses it for the widget it reads over, outside the provider). */
export function paramContextFor(
  { viewer, dashboardId, controls }: Pick<DashboardParamsState, 'viewer' | 'dashboardId' | 'controls'>,
  widgetId: string | undefined,
): ParamContext | undefined {
  if (!dashboardId || !widgetId) return Object.keys(viewer).length ? { params: viewer } : undefined;
  const allowed = new Set((controls ?? []).filter((c) => targetsWidget(c, widgetId)).flatMap(controlParams));
  const params = Object.fromEntries(Object.entries(viewer).filter(([k]) => allowed.has(k)));
  return {
    ...(Object.keys(params).length ? { params } : {}),
    dashboard: { id: dashboardId, widgetId },
  };
}

/** R199 — the viewer's shared selections one widget's reads carry (controls
 *  that TARGET it only; the saved ones are the server's to apply). Empty off a
 *  dashboard. Memoised on its content so query keys stay stable. */
export function useWidgetSharedFilters(widgetId: string | undefined): AggregateFilter[] {
  const { dashboardId, controls, filters } = useContext(DashboardParamsContext);
  const items = dashboardId && widgetId ? sharedItemsFor(controls ?? [], filters ?? {}, widgetId) : [];
  const key = JSON.stringify(items);
  return useMemo(() => items, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Report a read's `resolvedParams` to the page (no-op off a dashboard). */
export function useReportResolved(widgetId: string | undefined, resolved: ResolvedParams | undefined): void {
  const { report } = useContext(DashboardParamsContext);
  const key = resolved ? JSON.stringify(resolved) : '';
  useEffect(() => {
    if (report && widgetId) report(widgetId, resolved);
  }, [key, widgetId]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The values a widget's read reports that belong to the dashboard's controls:
 *  only controls that TARGET the widget, and only a viewer or dashboard value
 *  (a widget on its own default says nothing about the control — code review
 *  N-1). Keyed by parameter name (one control per name; a range owns two). */
export function controlValuesFrom(
  controls: readonly DashboardControl[],
  widgetId: string,
  resolved: ResolvedParams,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const c of controls) {
    if (!targetsWidget(c, widgetId)) continue;
    for (const name of controlParams(c)) {
      const r = resolved[name];
      if (r && (r.source === 'viewer' || r.source === 'dashboard')) out[name] = r.value;
    }
  }
  return out;
}

/** A control's saved value for one of its parameters when it is already an
 *  absolute literal (a relative one is the server's to resolve). */
function savedAbsolute(c: DashboardControl, name: string): string | number | undefined {
  if (c.kind === 'param') return c.saved !== undefined && !isRelative(c.saved) ? c.saved : undefined;
  if (c.kind !== 'date_range' || !c.saved || !('from' in c.saved)) return undefined;
  const v = name === c.from ? c.saved.from : c.saved.to;
  return typeof v === 'string' ? v : undefined;
}

/** The URL to share: the current one with every control's value pinned as an
 *  absolute `p.<name>` (the server-resolved value where the viewer set none), so
 *  a relative saved value cannot drift by tomorrow (BA-2; D4: the URL holds
 *  absolute dates). R199 — every `values` control pinned too (`f.<id>`: the
 *  viewer's selection as it is, else the saved one, else `f.<id>=` — no filter),
 *  so the link reopens this view even after the saved selection changes; a stale
 *  `f.` key is dropped (BA-C1). Written through the raw writer: the `f.*` bytes
 *  in the current URL are kept as they are (BA-C2). */
export function shareUrl(
  href: string,
  controls: readonly DashboardControl[],
  viewer: Record<string, string>,
  /** Server-resolved values by parameter name. */
  resolved: Record<string, string | number>,
  selections: FilterSelections = {},
): string {
  const url = new URL(href);
  const set: Record<string, string> = {};
  for (const c of controls) {
    if (c.kind === 'values') {
      if (selections[c.id] === undefined) set[F_PREFIX + c.id] = encodeSelection(c.saved ?? []);
      continue;
    }
    for (const name of controlParams(c)) {
      if (viewer[name] !== undefined) continue;
      const v = resolved[name] ?? savedAbsolute(c, name);
      if (v !== undefined && v !== '') set[P_PREFIX + name] = encodeURIComponent(String(v));
    }
  }
  const stale = new Set(staleFilterKeys(url.search, controls).map((id) => F_PREFIX + id));
  const search = writeSearch(url.search, set, (k) => stale.has(k));
  return `${url.origin}${url.pathname}${search}${url.hash}`;
}

function newControlId(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return `ctl_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Every parameter declared by a query some widget binds, with its declaration
 *  (the first found) and the widgets whose queries USE it. */
export function bindableParams(
  widgets: readonly Widget[],
  queries: ReadonlyMap<string, Query>,
): Map<string, { decl: QueryParam; usedBy: string[] }> {
  const out = new Map<string, { decl: QueryParam; usedBy: string[] }>();
  for (const w of widgets) {
    const q = w.queryId ? queries.get(w.queryId) : undefined;
    if (!q) continue;
    const used = usedParams(q.definition);
    for (const p of q.definition.params ?? []) {
      const entry = out.get(p.name) ?? { decl: p, usedBy: [] };
      if (used.has(p.name)) entry.usedBy.push(w.id);
      out.set(p.name, entry);
    }
  }
  return out;
}

export type Reach = {
  reached: DashboardControl[];
  /** `reason` names the parameter(s) the query does not use — or, for a values
   *  control, the column its result lacks; `count` picks the wording (BA-F1). */
  skipped: { control: DashboardControl; reason: string; count?: number }[];
};

/** D4/D5 — a control reaches a widget when the widget is targeted AND its query
 *  uses the parameter (a range: `from` or `to`); a targeted widget whose query
 *  does not is skipped, the reason naming the parameter(s). A note is never
 *  reached (and never badged). R199 — a `values` control reaches a targeted
 *  widget whose result has its column (`columns`: the result's column names;
 *  `undefined` while unknown — the control is then listed neither way). */
export function controlReach(
  controls: readonly DashboardControl[],
  widget: Widget,
  query: Query | undefined,
  columns?: readonly string[],
): Reach {
  const reach: Reach = { reached: [], skipped: [] };
  if (widget.chartType === 'note' || !widget.queryId) return reach;
  const used = usedParams(query?.definition);
  for (const c of controls) {
    if (!targetsWidget(c, widget.id)) continue;
    if (c.kind === 'values') {
      if (columns === undefined) continue;
      if (columns.includes(c.column)) reach.reached.push(c);
      else reach.skipped.push({ control: c, reason: c.column, count: 1 });
      continue;
    }
    const names = controlParams(c);
    if (names.some((n) => used.has(n))) reach.reached.push(c);
    else reach.skipped.push({ control: c, reason: names.join(', '), count: names.length });
  }
  return reach;
}

/** The card badge: every control that reached the widget; skipped ones warn. */
export function ReachBadge({ reach }: Readonly<{ reach: Reach }>) {
  const { t } = useTranslation();
  if (reach.reached.length === 0 && reach.skipped.length === 0) return null;
  return (
    <Space size={4} wrap data-component="FilterReachBadge">
      {reach.reached.map((c) => (
        <Tag key={c.id} style={{ marginInlineEnd: 0 }} data-component="ReachTag">
          {c.label}
        </Tag>
      ))}
      {reach.skipped.map(({ control, reason, count }) => {
        const why =
          control.kind === 'values'
            ? t('dashboard.params.skippedNoColumn', { column: reason })
            : t(count && count > 1 ? 'dashboard.params.skippedWhyMany' : 'dashboard.params.skippedWhy', {
                param: reason,
              });
        return (
          <Tooltip key={control.id} title={why}>
            <Tag
              color="warning"
              style={{ marginInlineEnd: 0 }}
              aria-label={`${t('dashboard.params.skipped', { label: control.label })} — ${why}`}
              data-component="ReachSkippedTag"
            >
              {t('dashboard.params.skipped', { label: control.label })}
            </Tag>
          </Tooltip>
        );
      })}
    </Space>
  );
}

/** A saved value as text (relative dates as "today ± n"). */
function savedText(
  v: string | number | RelativeDay | undefined,
  t: (k: string, o?: Record<string, unknown>) => string,
) {
  if (v === undefined) return '';
  if (isRelative(v)) return t('dashboard.params.relative', { n: v.offsetDays });
  return String(v);
}

/** The date a saved bound shows before any read has answered (a relative one
 *  in the browser's zone — display only; the server resolves it). */
function boundPreview(v: string | RelativeDay | undefined): string {
  if (v === undefined) return '';
  return isRelative(v) ? isoToday(v.offsetDays) : v;
}

function ValueInput({
  type,
  value,
  onChange,
  ariaLabel,
  status,
  dataName,
}: Readonly<{
  type: QueryParam['type'];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  status?: 'warning';
  dataName: string;
}>) {
  return (
    <Input
      type={type === 'date' ? 'date' : 'text'}
      inputMode={type === 'number' ? 'decimal' : undefined}
      value={value}
      status={status}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: type === 'date' ? 160 : 130 }}
      aria-label={ariaLabel}
      data-component="ParamControlInput"
      data-name={dataName}
    />
  );
}

/** R198 — the bar's period control: a preset select and two date inputs. The
 *  shown dates are the server's resolution where a read has answered (the saved
 *  preset is resolved in `backend.time_zone`), the browser's preview before. */
function DateRangeInput({
  control,
  viewer,
  resolved,
  onChange,
}: Readonly<{
  control: DateRangeControl;
  viewer: Record<string, string>;
  resolved: Record<string, string | number>;
  onChange: (values: Record<string, string>) => void;
}>) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const own = { from: viewer[control.from], to: viewer[control.to] };
  const savedPreview =
    control.saved && 'preset' in control.saved
      ? resolvePreset(control.saved.preset)
      : { from: boundPreview(control.saved?.from), to: boundPreview(control.saved?.to) };
  const shown = {
    from: own.from ?? (resolved[control.from] !== undefined ? String(resolved[control.from]) : savedPreview.from),
    to: own.to ?? (resolved[control.to] !== undefined ? String(resolved[control.to]) : savedPreview.to),
  };
  const changed = own.from !== undefined || own.to !== undefined;
  const fits = { from: valueFits('date', shown.from), to: valueFits('date', shown.to) };
  const reversed = fits.from && fits.to && shown.from > shown.to;
  const preset = presetOf(shown.from, shown.to, DATE_RANGE_PRESETS);
  const presetLabel = (p: DateRangePreset) => t(`dashboard.params.range.presets.${p}`);
  return (
    <label
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      data-component="DateRangeControl"
      data-from={control.from}
      data-to={control.to}
      data-viewer={changed || undefined}
    >
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {control.label}
      </Typography.Text>
      <span
        style={
          changed
            ? {
                outline: `1px solid ${token.colorPrimary}`,
                borderRadius: token.borderRadius,
                display: 'inline-flex',
                gap: 4,
              }
            : { display: 'inline-flex', gap: 4 }
        }
      >
        <Select
          value={preset ?? 'custom'}
          onChange={(p: DateRangePreset | 'custom') => {
            if (p === 'custom') return;
            const r = resolvePreset(p);
            onChange({ [control.from]: r.from, [control.to]: r.to });
          }}
          options={[
            ...DATE_RANGE_PRESETS.map((p) => ({ value: p, label: presetLabel(p) })),
            { value: 'custom', label: t('dashboard.params.range.custom') },
          ]}
          style={{ width: 150 }}
          aria-label={`${control.label} — ${t('dashboard.params.range.preset')}`}
          data-component="DateRangePreset"
        />
        <ValueInput
          type="date"
          value={shown.from}
          onChange={(v) => onChange({ [control.from]: v })}
          ariaLabel={`${control.label} — ${t('dashboard.params.range.from')}`}
          status={(own.from !== undefined && !fits.from) || reversed ? 'warning' : undefined}
          dataName={control.from}
        />
        <Typography.Text type="secondary">→</Typography.Text>
        <ValueInput
          type="date"
          value={shown.to}
          onChange={(v) => onChange({ [control.to]: v })}
          ariaLabel={`${control.label} — ${t('dashboard.params.range.to')}`}
          status={(own.to !== undefined && !fits.to) || reversed ? 'warning' : undefined}
          dataName={control.to}
        />
      </span>
      {reversed ? (
        <Typography.Text type="warning" style={{ fontSize: token.fontSizeSM }} data-component="DateRangeReversed">
          {t('dashboard.params.range.reversed')}
        </Typography.Text>
      ) : null}
    </label>
  );
}

/** R199 — where a values control reads its options: one widget's query and
 *  that widget's parameter context (D4: the first targeted widget whose result
 *  has the column). `undefined` when no targeted widget has it. */
export type ValuesSource = { queryId: string; ctx?: ParamContext } | undefined;

/** R199 — a values control's multi-select (the bar's control and the editor's
 *  saved selection): options from `GET /queries/{id}/values`, `(blank)` as an
 *  option, "First 1 000 values" when the list is partial. Nothing selected =
 *  "All values" (no filter). */
export function ValuesSelect({
  control,
  source,
  value,
  onChange,
  ariaLabel,
  dataComponent,
  width = 220,
}: Readonly<{
  control: ValuesControl;
  source: ValuesSource;
  value: readonly (string | null)[];
  onChange: (values: (string | null)[]) => void;
  ariaLabel: string;
  dataComponent: string;
  width?: number;
}>) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const opts = useColumnValues(source?.queryId, source ? control.column : undefined, source?.ctx);
  const toKey = (v: string | null) => (v === null ? BLANK_KEY : v);
  const label = (v: string | null) => (v === null ? t('dashboard.params.values.blank') : v);
  // A selected value the list does not hold (from a link, or past the cap) stays selectable.
  const all = [...opts.values, ...value.filter((v) => !opts.values.includes(v))];
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <Select
        mode="multiple"
        allowClear
        value={value.map(toKey)}
        onChange={(keys: string[]) => onChange(keys.map((k) => (k === BLANK_KEY ? null : k)))}
        options={all.map((v) => ({ value: toKey(v), label: label(v) }))}
        placeholder={
          source ? t('dashboard.params.values.all') : t('dashboard.params.values.noSource', { column: control.column })
        }
        disabled={!source}
        loading={opts.isLoading && Boolean(source)}
        maxTagCount="responsive"
        // QA-3 — the open list covers the note below, exactly when it matters:
        // say "First 1 000 values" in the list's own footer too.
        popupRender={(menu) =>
          opts.partial ? (
            <>
              {menu}
              <Typography.Text
                type="secondary"
                style={{ display: 'block', padding: '4px 12px', fontSize: token.fontSizeSM }}
                data-component="ValuesPartialFooter"
              >
                {t('dashboard.params.values.partial')}
              </Typography.Text>
            </>
          ) : (
            menu
          )
        }
        style={{ minWidth: width, maxWidth: 360 }}
        aria-label={ariaLabel}
        data-component={dataComponent}
        data-control={control.id}
      />
      {opts.partial ? (
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }} data-component="ValuesPartial">
          {t('dashboard.params.values.partial')}
        </Typography.Text>
      ) : null}
    </span>
  );
}

export function DashboardControlBar({
  controls,
  params,
  viewer,
  resolved,
  onChange,
  onReset,
  selections = {},
  onFilterChange,
  valuesSource,
}: Readonly<{
  controls: readonly DashboardControl[];
  params: ReadonlyMap<string, { decl: QueryParam; usedBy: string[] }>;
  viewer: Record<string, string>;
  /** What the targeted widgets' reads used, by parameter name (the server's resolution). */
  resolved: Record<string, string | number>;
  /** Viewer values to set in the URL (empty = remove), several at once. */
  onChange: (values: Record<string, string>) => void;
  onReset: () => void;
  /** R199 — the viewer's shared selections (URL `f.*`), by control id. */
  selections?: FilterSelections;
  /** R199 — a values control's new viewer selection (`[]` = cleared: no filter). */
  onFilterChange?: (controlId: string, values: (string | null)[]) => void;
  /** R199 — where each values control reads its options. */
  valuesSource?: (c: ValuesControl) => ValuesSource;
}>) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  if (controls.length === 0) return null;
  const changed = controls.some((c) =>
    c.kind === 'values' ? selections[c.id] !== undefined : controlParams(c).some((n) => viewer[n] !== undefined),
  );
  return (
    <div
      data-component="DashboardControlBar"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: token.marginSM,
        padding: '8px 12px',
        marginBottom: 16,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
      }}
    >
      {controls.map((c) => {
        if (c.kind === 'date_range') {
          return <DateRangeInput key={c.id} control={c} viewer={viewer} resolved={resolved} onChange={onChange} />;
        }
        if (c.kind === 'values') {
          const own = selections[c.id];
          return (
            <label
              key={c.id}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              data-component="SharedFilterControl"
              data-column={c.column}
              data-viewer={own !== undefined || undefined}
            >
              <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {c.label}
              </Typography.Text>
              <span
                style={
                  own !== undefined
                    ? { outline: `1px solid ${token.colorPrimary}`, borderRadius: token.borderRadius }
                    : undefined
                }
              >
                <ValuesSelect
                  control={c}
                  source={valuesSource?.(c)}
                  value={own ?? c.saved ?? []}
                  onChange={(v) => onFilterChange?.(c.id, v)}
                  ariaLabel={c.label}
                  dataComponent="SharedFilterSelect"
                />
              </span>
            </label>
          );
        }
        const type = params.get(c.param)?.decl.type ?? 'string';
        const own = viewer[c.param];
        // The server's resolution first (a relative saved value resolves in
        // `backend.time_zone`, not the browser's — BA-3); the browser date only
        // until a read has answered.
        const resolvedValue = resolved[c.param];
        const shown =
          own ??
          (resolvedValue !== undefined
            ? String(resolvedValue)
            : isRelative(c.saved)
              ? isoToday(c.saved.offsetDays)
              : savedText(c.saved, t));
        const invalid = own !== undefined && !valueFits(type, own);
        return (
          <label
            key={c.id}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            data-component="ParamControl"
            data-param={c.param}
            data-viewer={own !== undefined || undefined}
          >
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {c.label}
            </Typography.Text>
            <span
              style={
                own !== undefined
                  ? { outline: `1px solid ${token.colorPrimary}`, borderRadius: token.borderRadius }
                  : undefined
              }
            >
              <ValueInput
                type={type}
                value={shown}
                onChange={(v) => onChange({ [c.param]: v })}
                ariaLabel={c.label}
                status={invalid ? 'warning' : undefined}
                dataName={c.param}
              />
            </span>
          </label>
        );
      })}
      <span style={{ marginInlineStart: 'auto', display: 'inline-flex', gap: 8 }}>
        {changed ? (
          <Button size="small" icon={<UndoOutlined />} onClick={onReset} data-component="ParamResetToSaved">
            {t('dashboard.params.reset')}
          </Button>
        ) : null}
        <Button
          size="small"
          icon={<LinkOutlined />}
          onClick={() => {
            const url = shareUrl(window.location.href, controls, viewer, resolved, selections);
            if (!navigator.clipboard) {
              message.error(t('dashboard.params.copyFailed'));
              return;
            }
            navigator.clipboard
              .writeText(url)
              .then(() => message.success(t('dashboard.params.copied')))
              .catch(() => message.error(t('dashboard.params.copyFailed')));
          }}
          data-component="ParamCopyLink"
        >
          {t('dashboard.params.copyLink')}
        </Button>
      </span>
    </div>
  );
}

/** A range control's saved period is complete and runs forwards. */
function rangeSavedValid(saved: DateRangeValue | undefined): boolean {
  if (!saved || 'preset' in saved) return true;
  const from = typeof saved.from === 'string' ? saved.from : undefined;
  const to = typeof saved.to === 'string' ? saved.to : undefined;
  if (from === undefined || to === undefined) return true; // relative bounds: the server checks
  return valueFits('date', from) && valueFits('date', to) && from <= to;
}

/** The editor's fixed pair: two date inputs (a relative bound shows its
 *  browser-side preview and becomes the typed date when edited). */
function FixedPairInputs({
  pair,
  onChange,
  names,
  fromLabel,
  toLabel,
}: Readonly<{
  pair: { from: string | RelativeDay; to: string | RelativeDay };
  onChange: (pair: { from: string; to: string }) => void;
  names: [string, string];
  fromLabel: string;
  toLabel: string;
}>) {
  const from = typeof pair.from === 'string' ? pair.from : boundPreview(pair.from);
  const to = typeof pair.to === 'string' ? pair.to : boundPreview(pair.to);
  const status = !rangeSavedValid(pair) ? 'warning' : undefined;
  return (
    <Space size={4}>
      <ValueInput
        type="date"
        value={from}
        onChange={(v) => onChange({ from: v, to })}
        ariaLabel={fromLabel}
        status={status}
        dataName={names[0]}
      />
      <Typography.Text type="secondary">→</Typography.Text>
      <ValueInput
        type="date"
        value={to}
        onChange={(v) => onChange({ from, to: v })}
        ariaLabel={toLabel}
        status={status}
        dataName={names[1]}
      />
    </Space>
  );
}

/** The controls editor (the "edit mode" for controls): changes are saved with
 *  the dashboard; viewers never save. */
export function ControlsEditor({
  open,
  controls,
  widgets,
  params,
  saving,
  onSave,
  onClose,
  columns = [],
  columnWidgets = () => [],
  valuesSource = () => undefined,
}: Readonly<{
  open: boolean;
  controls: readonly DashboardControl[];
  widgets: readonly Widget[];
  params: ReadonlyMap<string, { decl: QueryParam; usedBy: string[] }>;
  saving: boolean;
  onSave: (next: DashboardControl[]) => void;
  onClose: () => void;
  /** R199 — every result column of the widgets' queries (a values control's choices). */
  columns?: readonly DataColumn[];
  /** R199 — the widgets whose result has a column ("Chosen widgets" default). */
  columnWidgets?: (column: string) => string[];
  /** R199 — where a values control reads its options. */
  valuesSource?: (c: ValuesControl) => ValuesSource;
}>) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DashboardControl[]>([...controls]);
  useEffect(() => {
    if (open) setDraft([...controls]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps — seed on open only (code review P2-2)
  const bound = new Set(draft.flatMap(controlParams));
  const free = [...params.keys()].filter((p) => !bound.has(p));
  const freeDates = free.filter((p) => params.get(p)?.decl.type === 'date');
  const dateParams = [...params.keys()].filter((p) => params.get(p)?.decl.type === 'date');
  // R199 — one values control per column (`duplicate_column`); a text column first.
  const filteredColumns = new Set(draft.flatMap((c) => (c.kind === 'values' ? [c.column] : [])));
  const freeColumns = columns.filter((c) => !filteredColumns.has(c.name));
  const firstFreeColumn = (freeColumns.find((c) => c.dtype === 'string') ?? freeColumns[0])?.name;
  const set = (i: number, patch: Partial<DashboardControl>) =>
    setDraft(draft.map((c, k) => (k === i ? ({ ...c, ...patch } as DashboardControl) : c)));
  const widgetOptions = widgets.filter((w) => w.chartType !== 'note').map((w) => ({ value: w.id, label: w.title }));
  const invalid = draft.some((c, i) => {
    if (!c.label.trim() || (c.targets !== 'all' && c.targets.length === 0)) return true;
    if (c.kind === 'values')
      return !c.column || draft.some((o, k) => k !== i && o.kind === 'values' && o.column === c.column);
    if (c.kind === 'date_range') return c.from === c.to || !rangeSavedValid(c.saved);
    const type = params.get(c.param)?.decl.type;
    return type !== undefined && typeof c.saved === 'string' && c.saved !== '' && !valueFits(type, c.saved);
  });
  const usedBy = (names: string[]) => [...new Set(names.flatMap((n) => params.get(n)?.usedBy ?? []))];
  const paramOption = (p: string) => (params.get(p)?.decl.label ? `${params.get(p)?.decl.label} (${p})` : p);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('dashboard.params.editorTitle')}
      size="large"
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            loading={saving}
            disabled={invalid}
            onClick={() =>
              onSave(
                draft.map((c) => {
                  if (c.kind === 'values') {
                    const out: ValuesControl = { ...c, label: c.label.trim() };
                    if (!out.saved || out.saved.length === 0) delete out.saved;
                    return out;
                  }
                  if (c.kind === 'date_range') {
                    const out: DateRangeControl = { ...c, label: c.label.trim() };
                    if (!out.saved) delete out.saved;
                    return out;
                  }
                  const out = { ...c, label: c.label.trim() };
                  if (out.saved === '' || out.saved === undefined) delete out.saved;
                  // A number is typed as text (so "1." can become "1.5") and saved as a number.
                  else if (params.get(c.param)?.decl.type === 'number' && typeof out.saved === 'string')
                    out.saved = Number(out.saved);
                  return out;
                }),
              )
            }
            data-component="ControlsSave"
          >
            {t('common.save')}
          </Button>
        </Space>
      }
      data-component="ControlsEditor"
    >
      <Typography.Paragraph type="secondary">{t('dashboard.params.editorHint')}</Typography.Paragraph>
      {params.size === 0 ? (
        <Typography.Paragraph data-component="ControlsNoParams">{t('dashboard.params.noParams')}</Typography.Paragraph>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {draft.map((c, i) => {
          if (c.kind === 'values') {
            const otherColumns = new Set(
              draft.filter((o, k) => k !== i && o.kind === 'values').map((o) => (o as ValuesControl).column),
            );
            return (
              <div
                key={c.id}
                data-component="ControlRow"
                data-kind="values"
                data-column={c.column}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                }}
              >
                <Space wrap>
                  <Input
                    value={c.label}
                    maxLength={60}
                    onChange={(e) => set(i, { label: e.target.value })}
                    aria-label={t('dashboard.params.label')}
                    style={{ width: 180 }}
                    data-component="ControlLabel"
                  />
                  <Typography.Text type="secondary">{t('dashboard.params.values.binds')}</Typography.Text>
                  <Select
                    showSearch
                    value={c.column}
                    // A new column drops a saved selection made for the old one, and
                    // takes a NEW id (BA-F4): a link holding `f.<old id>=North` then
                    // names no control and is dropped (BA-C1) instead of applying
                    // "North" to the new column.
                    onChange={(col: string) => set(i, { column: col, saved: undefined, id: newControlId() })}
                    options={columns
                      .filter((col) => !otherColumns.has(col.name))
                      .map((col) => ({ value: col.name, label: col.name }))}
                    status={otherColumns.has(c.column) ? 'error' : undefined}
                    style={{ width: 200 }}
                    aria-label={t('dashboard.params.values.column')}
                    data-component="ValuesColumn"
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={t('dashboard.params.remove', { label: c.label })}
                    onClick={() => setDraft(draft.filter((_, k) => k !== i))}
                    data-component="ControlRemove"
                  />
                </Space>
                <Space wrap>
                  <Typography.Text>{t('dashboard.params.targets')}</Typography.Text>
                  <Select
                    value={c.targets === 'all' ? 'all' : 'some'}
                    onChange={(v: 'all' | 'some') => set(i, { targets: v === 'all' ? 'all' : columnWidgets(c.column) })}
                    options={[
                      { value: 'all', label: t('dashboard.params.allWidgets') },
                      { value: 'some', label: t('dashboard.params.someWidgets') },
                    ]}
                    style={{ width: 170 }}
                    data-component="ControlTargetMode"
                  />
                  {c.targets !== 'all' ? (
                    <Select
                      mode="multiple"
                      value={c.targets}
                      onChange={(ids: string[]) => set(i, { targets: ids })}
                      options={widgetOptions}
                      style={{ minWidth: 240 }}
                      aria-label={t('dashboard.params.targets')}
                      data-component="ControlTargets"
                    />
                  ) : null}
                </Space>
                <Space wrap>
                  <Typography.Text>{t('dashboard.params.saved')}</Typography.Text>
                  <ValuesSelect
                    control={c}
                    source={valuesSource(c)}
                    value={c.saved ?? []}
                    onChange={(v) => set(i, { saved: v.length ? v : undefined })}
                    ariaLabel={`${c.label} — ${t('dashboard.params.saved')}`}
                    dataComponent="ValuesSaved"
                    width={260}
                  />
                </Space>
              </div>
            );
          }
          const names = controlParams(c);
          const entry = c.kind === 'param' ? params.get(c.param) : undefined;
          const type = entry?.decl.type ?? 'string';
          const relative = c.kind === 'param' && isRelative(c.saved);
          // A range may bind any date parameter no OTHER control binds — its own
          // two included, so a pair added in the wrong order can be swapped
          // (QA-1); `from` = `to` is refused below.
          const boundByOthers = new Set(draft.filter((_, k) => k !== i).flatMap(controlParams));
          const rangeOptions = () =>
            dateParams.filter((p) => !boundByOthers.has(p)).map((p) => ({ value: p, label: paramOption(p) }));
          const savedMode =
            c.kind !== 'date_range' ? undefined : !c.saved ? 'none' : 'preset' in c.saved ? c.saved.preset : 'fixed';
          return (
            <div
              key={c.id}
              data-component="ControlRow"
              data-kind={c.kind}
              data-param={names.join(',')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                paddingBottom: 12,
                borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
              }}
            >
              <Space wrap>
                <Input
                  value={c.label}
                  maxLength={60}
                  onChange={(e) => set(i, { label: e.target.value })}
                  aria-label={t('dashboard.params.label')}
                  style={{ width: 180 }}
                  data-component="ControlLabel"
                />
                {c.kind === 'date_range' ? (
                  <Space size={4} wrap>
                    <Typography.Text type="secondary">{t('dashboard.params.range.binds')}</Typography.Text>
                    <Select
                      value={c.from}
                      onChange={(p: string) => set(i, { from: p })}
                      options={rangeOptions()}
                      style={{ width: 160 }}
                      aria-label={t('dashboard.params.range.from')}
                      data-component="RangeFromParam"
                    />
                    <Typography.Text type="secondary">→</Typography.Text>
                    <Select
                      value={c.to}
                      onChange={(p: string) => set(i, { to: p })}
                      options={rangeOptions()}
                      status={c.from === c.to ? 'error' : undefined}
                      style={{ width: 160 }}
                      aria-label={t('dashboard.params.range.to')}
                      data-component="RangeToParam"
                    />
                  </Space>
                ) : (
                  <Typography.Text type="secondary">
                    {t('dashboard.params.bindsTo', { param: c.param })}
                  </Typography.Text>
                )}
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t('dashboard.params.remove', { label: c.label })}
                  onClick={() => setDraft(draft.filter((_, k) => k !== i))}
                  data-component="ControlRemove"
                />
              </Space>
              <Space wrap>
                <Typography.Text>{t('dashboard.params.targets')}</Typography.Text>
                <Select
                  value={c.targets === 'all' ? 'all' : 'some'}
                  onChange={(v: 'all' | 'some') => set(i, { targets: v === 'all' ? 'all' : usedBy(names) })}
                  options={[
                    { value: 'all', label: t('dashboard.params.allWidgets') },
                    { value: 'some', label: t('dashboard.params.someWidgets') },
                  ]}
                  style={{ width: 170 }}
                  data-component="ControlTargetMode"
                />
                {c.targets !== 'all' ? (
                  <Select
                    mode="multiple"
                    value={c.targets}
                    onChange={(ids: string[]) => set(i, { targets: ids })}
                    options={widgetOptions}
                    style={{ minWidth: 240 }}
                    aria-label={t('dashboard.params.targets')}
                    data-component="ControlTargets"
                  />
                ) : null}
              </Space>
              <Space wrap>
                <Typography.Text>{t('dashboard.params.saved')}</Typography.Text>
                {c.kind === 'date_range' ? (
                  <>
                    <Select
                      value={savedMode}
                      onChange={(m: string) =>
                        set(i, {
                          saved:
                            m === 'none'
                              ? undefined
                              : m === 'fixed'
                                ? { from: '', to: '' }
                                : { preset: m as DateRangePreset },
                        })
                      }
                      options={[
                        { value: 'none', label: t('dashboard.params.range.noSaved') },
                        ...DATE_RANGE_PRESETS.map((p) => ({
                          value: p,
                          label: t(`dashboard.params.range.presets.${p}`),
                        })),
                        { value: 'fixed', label: t('dashboard.params.range.fixed') },
                      ]}
                      style={{ width: 180 }}
                      data-component="RangeSavedMode"
                    />
                    {c.saved && 'from' in c.saved ? (
                      <FixedPairInputs
                        pair={c.saved}
                        onChange={(pair) => set(i, { saved: pair })}
                        names={[c.from, c.to]}
                        fromLabel={t('dashboard.params.range.from')}
                        toLabel={t('dashboard.params.range.to')}
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    {type === 'date' ? (
                      <Select
                        value={relative ? 'today' : 'value'}
                        onChange={(m: 'value' | 'today') =>
                          set(i, { saved: m === 'today' ? { kind: 'today', offsetDays: 0 } : undefined })
                        }
                        options={[
                          { value: 'value', label: t('dashboard.params.fixed') },
                          { value: 'today', label: t('dashboard.params.relativeOption') },
                        ]}
                        style={{ width: 150 }}
                        data-component="ControlSavedMode"
                      />
                    ) : null}
                    {relative && isRelative(c.saved) ? (
                      <Space size={4}>
                        <Typography.Text>{t('queries.params.today')}</Typography.Text>
                        <InputNumber
                          value={c.saved.offsetDays}
                          min={-366}
                          max={366}
                          onChange={(n) => set(i, { saved: { kind: 'today', offsetDays: n ?? 0 } })}
                          style={{ width: 80 }}
                          aria-label={t('queries.params.offset')}
                        />
                        <Typography.Text type="secondary">{t('queries.params.days')}</Typography.Text>
                      </Space>
                    ) : (
                      <ValueInput
                        type={type}
                        value={c.saved === undefined ? '' : String(c.saved)}
                        onChange={(v) => set(i, { saved: v })}
                        ariaLabel={t('dashboard.params.saved')}
                        dataName={c.param}
                      />
                    )}
                  </>
                )}
              </Space>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16 }}>
        <Select
          placeholder={t('dashboard.params.add')}
          value={null}
          disabled={(free.length === 0 && freeDates.length < 2 && !firstFreeColumn) || draft.length >= MAX_CONTROLS}
          onChange={(param: string) => {
            if (param === VALUES_OPTION && firstFreeColumn) {
              setDraft([
                ...draft,
                { id: newControlId(), kind: 'values', label: firstFreeColumn, column: firstFreeColumn, targets: 'all' },
              ]);
              return;
            }
            if (param === RANGE_OPTION) {
              setDraft([
                ...draft,
                {
                  id: newControlId(),
                  kind: 'date_range',
                  label: t('dashboard.params.range.defaultLabel'),
                  from: freeDates[0] as string,
                  to: freeDates[1] as string,
                  targets: 'all',
                },
              ]);
              return;
            }
            const decl = params.get(param)?.decl;
            setDraft([
              ...draft,
              { id: newControlId(), kind: 'param', label: decl?.label ?? param, param, targets: 'all' },
            ]);
          }}
          options={[
            ...(firstFreeColumn ? [{ value: VALUES_OPTION, label: t('dashboard.params.values.add') }] : []),
            ...(freeDates.length >= 2 ? [{ value: RANGE_OPTION, label: t('dashboard.params.range.add') }] : []),
            ...free.map((p) => ({ value: p, label: paramOption(p) })),
          ]}
          style={{ width: 260 }}
          suffixIcon={<PlusOutlined />}
          data-component="ControlAdd"
        />
      </div>
    </Drawer>
  );
}

export const ControlsIcon = ControlOutlined;

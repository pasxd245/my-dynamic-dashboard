// R195 (item 3.7b) — dashboard parameter controls (dashboard-filters.md D3–D5).
//
// - `DashboardParamsContext` — the viewer's values (URL `p.*`) and the dashboard
//   id; every widget read sends both, so the SERVER applies viewer → dashboard
//   saved value → query default, and says what it used.
// - `DashboardControlBar` — one input per control above the grid. A change goes
//   to the URL only (never saved); **Reset to saved** drops the URL values;
//   **Copy link** copies the URL that reopens this view.
// - `ControlsEditor` — the edit affordance: add / label / bind / target / saved
//   value / remove, saved with the dashboard (a PUT).
// - `controlReach` + `ReachBadge` — which controls reached a widget and which
//   were skipped and why (D5): a control reaches a targeted widget only when its
//   query USES the parameter.

import { ControlOutlined, DeleteOutlined, LinkOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Input, InputNumber, Select, Space, Tag, Tooltip, Typography, theme } from 'antd';
import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isRelative, isoToday, usedParams, valueFits } from '@/features/data-management/queries/params';
import type { ParamContext, Query, QueryParam, ResolvedParams } from '@/features/data-management/queries/types';
import type { DashboardControl, Widget } from './types';

export const MAX_CONTROLS = 12;

export type DashboardParamsState = {
  viewer: Record<string, string>;
  dashboardId?: string;
  /** The controls — a viewer value reaches only the widgets its control targets. */
  controls?: readonly DashboardControl[];
  /** Each widget reports what its read used (the bar shows, and the link pins,
   *  the server-resolved values). */
  report?: (resolved: ResolvedParams) => void;
};
export const DashboardParamsContext = createContext<DashboardParamsState>({ viewer: {} });

/** The parameter context one widget's reads carry. On a dashboard: the viewer
 *  values of the controls that TARGET this widget (D4 — code review P1-2) and
 *  the widget, whose saved values the server applies. Off a dashboard (the
 *  widget builder's preview): the viewer values as given. */
export function useWidgetParamContext(widgetId: string | undefined): ParamContext | undefined {
  const { viewer, dashboardId, controls } = useContext(DashboardParamsContext);
  if (!dashboardId || !widgetId) return Object.keys(viewer).length ? { params: viewer } : undefined;
  const allowed = new Set(
    (controls ?? []).filter((c) => c.targets === 'all' || c.targets.includes(widgetId)).map((c) => c.param),
  );
  const params = Object.fromEntries(Object.entries(viewer).filter(([k]) => allowed.has(k)));
  return {
    ...(Object.keys(params).length ? { params } : {}),
    dashboard: { id: dashboardId, widgetId },
  };
}

/** Report a read's `resolvedParams` to the page (no-op off a dashboard). */
export function useReportResolved(resolved: ResolvedParams | undefined): void {
  const { report } = useContext(DashboardParamsContext);
  const key = resolved ? JSON.stringify(resolved) : '';
  useEffect(() => {
    if (resolved && report) report(resolved);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The URL to share: the current one with every control's value pinned as an
 *  absolute `p.<name>` (the server-resolved value where the viewer set none), so
 *  a relative saved value cannot drift by tomorrow (BA-2; D4: the URL holds
 *  absolute dates). */
export function shareUrl(
  href: string,
  controls: readonly DashboardControl[],
  viewer: Record<string, string>,
  resolved: Record<string, string | number>,
): string {
  const url = new URL(href);
  for (const c of controls) {
    if (viewer[c.param] !== undefined) continue;
    const v = resolved[c.param] ?? (c.saved !== undefined && !isRelative(c.saved) ? c.saved : undefined);
    if (v !== undefined && v !== '') url.searchParams.set(`p.${c.param}`, String(v));
  }
  return url.toString();
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

export type Reach = { reached: DashboardControl[]; skipped: { control: DashboardControl; reason: string }[] };

/** D4/D5 — a control reaches a widget when the widget is targeted AND its query
 *  uses the parameter; a targeted widget whose query does not is skipped. A note
 *  is never reached (and never badged). */
export function controlReach(controls: readonly DashboardControl[], widget: Widget, query: Query | undefined): Reach {
  const reach: Reach = { reached: [], skipped: [] };
  if (widget.chartType === 'note' || !widget.queryId) return reach;
  const used = usedParams(query?.definition);
  for (const c of controls) {
    const targeted = c.targets === 'all' || c.targets.includes(widget.id);
    if (!targeted) continue;
    if (used.has(c.param)) reach.reached.push(c);
    else reach.skipped.push({ control: c, reason: c.param });
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
      {reach.skipped.map(({ control, reason }) => (
        <Tooltip key={control.id} title={t('dashboard.params.skippedWhy', { param: reason })}>
          <Tag
            color="warning"
            style={{ marginInlineEnd: 0 }}
            aria-label={`${t('dashboard.params.skipped', { label: control.label })} — ${t('dashboard.params.skippedWhy', { param: reason })}`}
            data-component="ReachSkippedTag"
          >
            {t('dashboard.params.skipped', { label: control.label })}
          </Tag>
        </Tooltip>
      ))}
    </Space>
  );
}

/** A saved value as text (relative dates as "today ± n"). */
function savedText(v: DashboardControl['saved'], t: (k: string, o?: Record<string, unknown>) => string): string {
  if (v === undefined) return '';
  if (isRelative(v)) return t('dashboard.params.relative', { n: v.offsetDays });
  return String(v);
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

export function DashboardControlBar({
  controls,
  params,
  viewer,
  resolved,
  onChange,
  onReset,
}: Readonly<{
  controls: readonly DashboardControl[];
  params: ReadonlyMap<string, { decl: QueryParam; usedBy: string[] }>;
  viewer: Record<string, string>;
  /** What the widgets' reads used, by parameter (the server's resolution). */
  resolved: Record<string, string | number>;
  onChange: (param: string, value: string) => void;
  onReset: () => void;
}>) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  if (controls.length === 0) return null;
  const changed = controls.some((c) => viewer[c.param] !== undefined);
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
                onChange={(v) => onChange(c.param, v)}
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
            const url = shareUrl(window.location.href, controls, viewer, resolved);
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
}: Readonly<{
  open: boolean;
  controls: readonly DashboardControl[];
  widgets: readonly Widget[];
  params: ReadonlyMap<string, { decl: QueryParam; usedBy: string[] }>;
  saving: boolean;
  onSave: (next: DashboardControl[]) => void;
  onClose: () => void;
}>) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DashboardControl[]>([...controls]);
  useEffect(() => {
    if (open) setDraft([...controls]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps — seed on open only (code review P2-2)
  const free = [...params.keys()].filter((p) => !draft.some((c) => c.param === p));
  const set = (i: number, patch: Partial<DashboardControl>) =>
    setDraft(draft.map((c, k) => (k === i ? ({ ...c, ...patch } as DashboardControl) : c)));
  const widgetOptions = widgets.filter((w) => w.chartType !== 'note').map((w) => ({ value: w.id, label: w.title }));
  const invalid = draft.some((c) => {
    const type = params.get(c.param)?.decl.type;
    return (
      !c.label.trim() ||
      (c.targets !== 'all' && c.targets.length === 0) ||
      (type !== undefined && typeof c.saved === 'string' && c.saved !== '' && !valueFits(type, c.saved))
    );
  });

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
                  const out = { ...c, label: c.label.trim() };
                  if (out.saved === '' || out.saved === undefined) delete out.saved;
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
          const entry = params.get(c.param);
          const type = entry?.decl.type ?? 'string';
          const relative = isRelative(c.saved);
          return (
            <div
              key={c.id}
              data-component="ControlRow"
              data-param={c.param}
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
                <Typography.Text type="secondary">{t('dashboard.params.bindsTo', { param: c.param })}</Typography.Text>
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
                  onChange={(v: 'all' | 'some') =>
                    set(i, { targets: v === 'all' ? 'all' : entry?.usedBy.length ? [...entry.usedBy] : [] })
                  }
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
                    onChange={(v) =>
                      set(i, { saved: type === 'number' && v !== '' && valueFits('number', v) ? Number(v) : v })
                    }
                    ariaLabel={t('dashboard.params.saved')}
                    dataName={c.param}
                  />
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
          disabled={free.length === 0 || draft.length >= MAX_CONTROLS}
          onChange={(param: string) => {
            const decl = params.get(param)?.decl;
            setDraft([
              ...draft,
              { id: newControlId(), kind: 'param', label: decl?.label ?? param, param, targets: 'all' },
            ]);
          }}
          options={free.map((p) => ({
            value: p,
            label: params.get(p)?.decl.label ? `${params.get(p)?.decl.label} (${p})` : p,
          }))}
          style={{ width: 260 }}
          suffixIcon={<PlusOutlined />}
          data-component="ControlAdd"
        />
      </div>
    </Drawer>
  );
}

export const ControlsIcon = ControlOutlined;

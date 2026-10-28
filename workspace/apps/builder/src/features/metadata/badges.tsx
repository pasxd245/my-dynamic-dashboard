// R202 (item 5.2) — the first layer: what kind of note sits on a noun, and how
// serious, before anyone opens it. A widget shows up to two severity chips
// (one per distinct severity among error / decide / warn) and `+N` for the
// rest; with no severity anywhere, the shipped info button and its count. A
// dataset column shows one dot in its highest severity's colour. Both open the
// dock on that noun. "At a glance" (dashboard) lifts the serious, current
// summaries to the top of the page.

import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { entryState } from './MetadataPanel';
import type { NoteSel } from './dock';
import { type ReadEntry, type Severity, firstLine, readEntries, severityRank, topSeverity } from './reserved';
import { SeverityTag, useSeverityDotColor } from './severity';
import type { MetadataEntries, MetadataRead } from './types';

const BADGE_SEVERITIES: readonly Severity[] = ['error', 'decide', 'warn'];
const MAX_CHIPS = 2;

export function badgeParts(read: readonly ReadEntry[]): { chips: Severity[]; rest: number } {
  const present = BADGE_SEVERITIES.filter((s) => read.some((r) => r.severity === s)).slice(0, MAX_CHIPS);
  const covered = read.filter((r) => r.severity && present.includes(r.severity)).length;
  return { chips: present, rest: read.length - covered };
}

/** The widget header's metadata affordance (replaces R180's info button when a
 *  note carries a severity). Nothing written → nothing. */
export function WidgetMetadataBadges({
  entries,
  onOpen,
}: Readonly<{ entries: MetadataEntries | undefined; onOpen: () => void }>) {
  const { t } = useTranslation();
  const read = useMemo(() => readEntries(entries), [entries]);
  if (read.length === 0) return null;
  const { chips, rest } = badgeParts(read);
  const label = t('metadata.widgetTooltip');
  const titles = read.map((r) => r.title ?? r.namespace).join(' · ');
  if (chips.length === 0)
    return (
      <Tooltip title={`${label}: ${titles}`}>
        <Button
          type="text"
          size="small"
          icon={<InfoCircleOutlined />}
          aria-label={label}
          onClick={onOpen}
          data-component="WidgetMetadataButton"
          data-count={read.length}
        />
      </Tooltip>
    );
  return (
    <Tooltip title={titles}>
      <Button
        type="text"
        size="small"
        aria-label={`${label} (${read.length})`}
        onClick={onOpen}
        data-component="WidgetMetadataButton"
        data-count={read.length}
        style={{ paddingInline: 2, height: 'auto' }}
      >
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          {chips.map((s) => (
            <SeverityTag key={s} severity={s} />
          ))}
          {rest > 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="WidgetMetadataMore">
              +{rest}
            </Typography.Text>
          ) : null}
        </span>
      </Button>
    </Tooltip>
  );
}

/** A dataset column header's dot: the column has notes; colour = its highest severity. */
export function ColumnNoteDot({
  entries,
  column,
  onOpen,
}: Readonly<{ entries: MetadataEntries | undefined; column: string; onOpen: () => void }>) {
  const { t } = useTranslation();
  const read = useMemo(() => readEntries(entries), [entries]);
  const top = topSeverity(read);
  const color = useSeverityDotColor(top);
  if (read.length === 0) return null;
  const label = t('metadata.columnTooltip', { column, count: read.length });
  return (
    <Tooltip title={`${label}: ${read.map((r) => r.title ?? r.namespace).join(' · ')}`}>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        data-component="ColumnNoteDot"
        data-severity={top ?? ''}
        data-count={read.length}
        style={{
          border: 0,
          background: 'transparent',
          padding: 4,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      </button>
    </Tooltip>
  );
}

// ─── At a glance ───────────────────────────────────────────────────────────

export const GLANCE_MAX = 3;
const GLANCE_SEVERITIES = new Set<Severity>(['error', 'decide', 'warn']);

export type GlanceItem = { item: ReadEntry; childId?: string; childLabel?: string };

/** The entries worth the top of the page: severity ≥ warn, read `current` or
 *  `refreshed` (another period's note is not this period's news), most serious
 *  first, then the dashboard's own, then widget order; at most three. */
export function glanceItems(
  read: MetadataRead | undefined,
  childOrder: readonly string[],
  childLabel: (id: string) => string,
): GlanceItem[] {
  const out: (GlanceItem & { order: number })[] = [];
  const take = (entries: MetadataEntries | undefined, order: number, childId?: string) => {
    for (const r of readEntries(entries)) {
      const st = entryState(r.entry);
      if (!r.severity || !GLANCE_SEVERITIES.has(r.severity) || (st !== 'current' && st !== 'refreshed')) continue;
      out.push({ item: r, childId, childLabel: childId ? childLabel(childId) : undefined, order });
    }
  };
  take(read?.entries, -1);
  for (const [id, entries] of Object.entries(read?.children ?? {})) {
    const i = childOrder.indexOf(id);
    take(entries as MetadataEntries, i === -1 ? childOrder.length : i, id);
  }
  out.sort(
    (a, b) =>
      severityRank(a.item.severity) - severityRank(b.item.severity) ||
      a.order - b.order ||
      a.item.namespace.localeCompare(b.item.namespace),
  );
  return out.slice(0, GLANCE_MAX).map(({ order: _o, ...g }) => g);
}

const GLANCE_KEY = 'mdd.atAGlance.collapsed.';

function loadCollapsed(id: string): boolean {
  try {
    return globalThis.localStorage?.getItem(GLANCE_KEY + id) === '1';
  } catch {
    return false;
  }
}

function saveCollapsed(id: string, collapsed: boolean) {
  try {
    if (collapsed) globalThis.localStorage?.setItem(GLANCE_KEY + id, '1');
    else globalThis.localStorage?.removeItem(GLANCE_KEY + id);
  } catch {
    /* storage blocked — the choice lasts this visit only */
  }
}

export function AtAGlance({
  dashboardId,
  read,
  childOrder,
  childLabel,
  onOpen,
}: Readonly<{
  dashboardId: string;
  read: MetadataRead | undefined;
  childOrder: readonly string[];
  childLabel: (id: string) => string;
  onOpen: (sel: NoteSel) => void;
}>) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => loadCollapsed(dashboardId));
  const items = useMemo(() => glanceItems(read, childOrder, childLabel), [read, childOrder, childLabel]);
  if (items.length === 0) return null;
  const toggle = () => {
    saveCollapsed(dashboardId, !collapsed);
    setCollapsed(!collapsed);
  };
  return (
    <section
      data-component="AtAGlance"
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label={t('metadata.glance.title')}
      style={{
        marginBottom: 16,
        padding: '10px 14px',
        border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        borderRadius: 8,
        background: 'var(--ant-color-bg-container, #fff)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Typography.Text strong>{t('metadata.glance.title')}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('metadata.glance.hint')}
        </Typography.Text>
        <Button size="small" type="text" onClick={toggle} style={{ marginLeft: 'auto' }} aria-expanded={!collapsed}>
          {collapsed ? t('metadata.show') : t('metadata.hide')}
        </Button>
      </div>
      {collapsed ? null : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(220px, 1fr))`,
            gap: 10,
            marginTop: 8,
          }}
        >
          {items.map(({ item, childId, childLabel: label }) => (
            <button
              key={`${childId ?? '.'}:${item.namespace}`}
              type="button"
              onClick={() =>
                onOpen(
                  childId
                    ? { scope: 'child', child: childId, ns: item.namespace }
                    : { scope: 'self', ns: item.namespace },
                )
              }
              data-component="AtAGlanceItem"
              data-severity={item.severity}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                borderRadius: 8,
                background: 'var(--ant-color-fill-quaternary, rgba(0,0,0,0.02))',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                font: 'inherit',
                color: 'inherit',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {item.severity ? <SeverityTag severity={item.severity} /> : null}
                <Typography.Text strong ellipsis style={{ minWidth: 0 }}>
                  {item.title ?? item.namespace}
                </Typography.Text>
              </span>
              <Typography.Text style={{ fontSize: 13 }}>{item.summary ?? firstLine(item.body)}</Typography.Text>
              {label ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {label}
                </Typography.Text>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

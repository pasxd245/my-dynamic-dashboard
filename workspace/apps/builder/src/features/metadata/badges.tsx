// R202 (item 5.2) — the first layer: what kind of note sits on a noun, and how
// serious, before anyone opens it. A widget shows up to two severity chips
// (one per distinct severity among error / decide / warn) and `+N` for the
// rest; with no severity anywhere, the shipped info button and its count. A
// dataset column shows one dot in its highest severity's colour. Both open the
// dock on that noun. "At a glance" (dashboard) lifts the serious, current
// summaries to the top of the page.

import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Tooltip, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { entryState } from './MetadataPanel';
import type { NoteSel } from './dock';
import {
  type ReadEntry,
  type Severity,
  displayLine,
  displayTitle,
  readEntries,
  severityRank,
  topSeverity,
} from './reserved';
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
  const titles = read.map(displayTitle).join(' · ');
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
    <Tooltip title={`${label}: ${read.map(displayTitle).join(' · ')}`}>
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

export function loadCollapsed(id: string): boolean {
  try {
    return globalThis.localStorage?.getItem(GLANCE_KEY + id) === '1';
  } catch {
    return false;
  }
}

export function saveCollapsed(id: string, collapsed: boolean) {
  try {
    if (collapsed) globalThis.localStorage?.setItem(GLANCE_KEY + id, '1');
    else globalThis.localStorage?.removeItem(GLANCE_KEY + id);
  } catch {
    /* storage blocked — the choice lasts this visit only */
  }
}

/** Is this entry the one the dock is reading? */
function isReading(sel: NoteSel | null, namespace: string, childId: string | undefined): boolean {
  if (!sel || sel.scope === 'all' || sel.ns !== namespace) return false;
  return childId ? sel.scope === 'child' && sel.child === childId : sel.scope === 'self';
}

/** R206 — At a glance as rows INSIDE the Notes & insights block (was its own strip):
 *  each row one button — chip, title, the widget's name, a two-line summary and a
 *  decorative "Details ›"; the row the dock is reading is marked. */
export function GlanceRows({
  items,
  sel,
  onOpen,
}: Readonly<{ items: readonly GlanceItem[]; sel: NoteSel | null; onOpen: (sel: NoteSel) => void }>) {
  const { t } = useTranslation();
  return (
    <ul
      role="list"
      data-component="AtAGlance"
      aria-label={t('metadata.glance.label')}
      style={{
        listStyle: 'none',
        margin: '8px 0 0',
        padding: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 8,
      }}
    >
      {items.map(({ item, childId, childLabel: label }) => {
        const current = isReading(sel, item.namespace, childId);
        const line = displayLine(item);
        return (
          <li key={`${childId ?? '.'}:${item.namespace}`} style={{ minWidth: 0 }}>
            <button
              type="button"
              onClick={() =>
                onOpen(
                  childId
                    ? { scope: 'child', child: childId, ns: item.namespace }
                    : { scope: 'self', ns: item.namespace },
                )
              }
              aria-current={current ? 'true' : undefined}
              data-component="AtAGlanceItem"
              data-severity={item.severity}
              style={{
                width: '100%',
                height: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                border: `1px solid ${current ? 'var(--ant-color-primary-border, #91caff)' : 'var(--ant-color-border-secondary, #f0f0f0)'}`,
                borderRadius: 6,
                background: current
                  ? 'var(--ant-color-primary-bg, #e6f4ff)'
                  : 'var(--ant-color-fill-quaternary, rgba(0,0,0,0.02))',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                font: 'inherit',
                color: 'inherit',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                {item.severity ? <SeverityTag severity={item.severity} /> : null}
                <Typography.Text strong ellipsis style={{ flex: '1 1 auto', minWidth: 0 }}>
                  {displayTitle(item)}
                  {label ? (
                    <Typography.Text type="secondary" style={{ fontWeight: 400 }}>
                      {` · ${label}`}
                    </Typography.Text>
                  ) : null}
                </Typography.Text>
                <span
                  aria-hidden="true"
                  style={{ color: 'var(--ant-color-link, #1677ff)', fontSize: 12, whiteSpace: 'nowrap' }}
                >
                  {current ? null : `${t('metadata.glance.details')} ›`}
                </span>
              </span>
              {line ? (
                <span
                  style={{
                    fontSize: 13,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {line}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

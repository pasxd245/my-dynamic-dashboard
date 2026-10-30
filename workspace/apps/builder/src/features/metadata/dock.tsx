// R202 (item 5.2) — metadata read by layer, beside the data.
//
// A page asks `useMetadataDock` for its noun's metadata (one read; children —
// a dashboard's widgets, a dataset's columns — ride along) and the dock's
// state; it puts its content in a `MetadataDockRow` (which renders the dock), so from `lg` up the dock sits BESIDE the
// content (the content narrows, nothing is covered) and below `lg` it is a
// drawer. The open note lives in the URL (`?note=`), written through the raw
// search writer so no other parameter is re-serialised (R199).
//
// Two views: Notes (one card per namespace) and Read (one entry in full). The
// dock only reads — nothing in it edits an entry (R180).

import {
  ArrowLeftOutlined,
  CloseOutlined,
  DownOutlined,
  RightOutlined,
  RobotOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Empty, Grid, Tag, Typography } from 'antd';
import type { MouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { SafeMarkdown } from '@/features/dashboard/SafeMarkdown';
import { writeSearch } from '@/features/dashboard/sharedFilters';
import { AnchorLines, PairsTable, anchorNotes, entryState, stateTag, when } from './MetadataPanel';
import { GlanceRows, glanceItems, loadCollapsed, saveCollapsed } from './badges';
import { useMetadataQuery } from './hooks';
import {
  type ReadEntry,
  type Severity,
  TITLE_MAX,
  displayLine,
  displayTitle,
  normText,
  readEntries,
  withoutLeadingTitle,
} from './reserved';
import { SeverityTag } from './severity';
import type { MetadataAnchor, MetadataEntries, MetadataKind, MetadataParams, MetadataRead } from './types';

// ─── the URL ───────────────────────────────────────────────────────────────

/** What the dock shows. `scope`: the page's noun, one child, or everything;
 *  `ns`: an entry to read in full (else the list). */
export type NoteSel =
  | { scope: 'self'; ns?: string }
  | { scope: 'child'; child: string; ns?: string }
  | { scope: 'all' };

export const NOTE_PARAM = 'note';

/** `*` all · `.` the noun's list · `<ns>` read the noun's · `@<child>` a child's
 *  list · `<ns>@<child>` read a child's. */
export function serializeNote(sel: NoteSel): string {
  if (sel.scope === 'all') return '*';
  if (sel.scope === 'self') return sel.ns ?? '.';
  return `${sel.ns ?? ''}@${sel.child}`;
}

export function parseNote(v: string | null | undefined): NoteSel | null {
  if (!v) return null;
  if (v === '*') return { scope: 'all' };
  if (v === '.') return { scope: 'self' };
  const at = v.indexOf('@');
  if (at === -1) return { scope: 'self', ns: v };
  const child = v.slice(at + 1);
  if (!child) return { scope: 'self', ns: v.slice(0, at) || undefined };
  const ns = v.slice(0, at);
  return ns ? { scope: 'child', child, ns } : { scope: 'child', child };
}

export function readNoteRaw(search: string): string | null {
  for (const part of search.replace(/^\?/, '').split('&')) {
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    if (key !== NOTE_PARAM) continue;
    try {
      // `URLSearchParams` (a page's own writes) re-encodes a space as `+`.
      return decodeURIComponent((eq === -1 ? '' : part.slice(eq + 1)).replace(/\+/g, ' '));
    } catch {
      return null;
    }
  }
  return null;
}

export function useNoteParam(): [NoteSel | null, (sel: NoteSel | null) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const sel = parseNote(readNoteRaw(location.search));
  const set = useCallback(
    (next: NoteSel | null) =>
      navigate(
        {
          pathname: location.pathname,
          search: writeSearch(location.search, { [NOTE_PARAM]: next ? encodeURIComponent(serializeNote(next)) : null }),
          hash: location.hash,
        },
        { replace: true },
      ),
    [navigate, location.pathname, location.search, location.hash],
  );
  return [sel, set];
}

// ─── the hook ──────────────────────────────────────────────────────────────

export type DockConfig = {
  kind: MetadataKind;
  /** The page noun's name (dataset, query, workflow, dashboard). */
  nounLabel: string;
  /** R197 — the page's parameter labels, for "written for …". */
  paramLabels?: Readonly<Record<string, string>>;
  /** A child's display name (a widget title, a column name). */
  childLabel?: (childId: string) => string;
  /** The children's order on the page (widget order, column order). */
  childOrder?: readonly string[];
};

export type MetadataDockApi = {
  read: MetadataRead | undefined;
  sel: NoteSel | null;
  /** Back from Read goes to All notes (the list it was opened from). */
  fromAll: boolean;
  open: (sel: NoteSel) => void;
  close: () => void;
};

/** The page's metadata read and the dock's state (the URL's `note`). Render the
 *  content inside `MetadataDockRow`, which renders the dock. */
export function useMetadataDock(
  kind: MetadataKind,
  nounId: string | undefined,
  params?: MetadataParams,
): MetadataDockApi {
  const q = useMetadataQuery(kind, nounId, params);
  const [sel, setSel] = useNoteParam();
  const [fromAll, setFromAll] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const open = useCallback(
    (next: NoteSel) => {
      if (!sel && typeof document !== 'undefined') opener.current = document.activeElement as HTMLElement | null;
      if (next.scope === 'all') setFromAll(true);
      else if (!next.ns) setFromAll(false);
      setSel(next);
    },
    [sel, setSel],
  );
  const close = useCallback(() => {
    setSel(null);
    setFromAll(false);
    const el = opener.current;
    opener.current = null;
    if (el && typeof el.focus === 'function') setTimeout(() => el.focus(), 0);
  }, [setSel]);
  return { read: q.data, sel, fromAll, open, close };
}

// ─── layout ────────────────────────────────────────────────────────────────

export const DOCK_WIDTH = 400;

/** The page content and the dock, side by side from `xl` (R206; was `lg`); below
 *  it the dock goes OVER the page — a 400 px drawer from the right, a bottom sheet
 *  below `md` — and the content keeps its width and grid. `fill`: the row fills a
 *  bounded page column (dataset, query, workflow pages) instead of growing. */
export function MetadataDockRow({
  children,
  api,
  cfg,
  fill = false,
}: Readonly<{ children: ReactNode; api: MetadataDockApi; cfg: DockConfig; fill?: boolean }>) {
  const screens = Grid.useBreakpoint();
  const beside = dockBeside(screens);
  const sheet = screens.md === false;
  const dock = api.sel ? (
    <MetadataDock cfg={cfg} read={api.read} sel={api.sel} fromAll={api.fromAll} onOpen={api.open} onClose={api.close} />
  ) : null;
  return (
    <div
      data-component="MetadataDockRow"
      data-docked={dock && beside ? 'true' : 'false'}
      style={{
        display: 'flex',
        gap: 16,
        alignItems: fill ? 'stretch' : 'flex-start',
        ...(fill ? { flex: '1 1 auto', minHeight: 0 } : {}),
      }}
    >
      <div
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          ...(fill ? { display: 'flex', flexDirection: 'column', minHeight: 0 } : {}),
        }}
      >
        {children}
      </div>
      {dock && beside ? (
        <div
          style={{
            flex: `0 0 ${DOCK_WIDTH}px`,
            width: DOCK_WIDTH,
            ...(fill
              ? // R206 — as tall as its content, up to the page column's height.
                { alignSelf: 'flex-start', maxHeight: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }
              : {
                  position: 'sticky',
                  top: 16,
                  maxHeight: 'calc(100svh - 120px)',
                  display: 'flex',
                  flexDirection: 'column',
                }),
          }}
        >
          {dock}
        </div>
      ) : null}
      {dock && !beside ? (
        <OverDock sheet={sheet} onClose={api.close}>
          {dock}
        </OverDock>
      ) : null}
    </div>
  );
}

/** R206 — where the dock goes for these breakpoints: beside the content from `xl`
 *  (≥ 1200 px). Nothing known yet (first render, no `matchMedia`) → beside, as before. */
export function dockBeside(screens: Readonly<Partial<Record<string, boolean>>>): boolean {
  return screens.xl !== false;
}

/** Below `xl` the same dock content OVER the page (R206, design C): a 400 px drawer
 *  from the right, or a bottom sheet below `md`. A light mask; a click on it closes,
 *  as `Esc` and × do. The grid under it keeps its columns. */
function OverDock({
  children,
  sheet,
  onClose,
}: Readonly<{ children: ReactNode; sheet: boolean; onClose: () => void }>) {
  return (
    <Drawer
      open
      placement={sheet ? 'bottom' : 'right'}
      size={sheet ? '85%' : DOCK_WIDTH}
      closable={false}
      onClose={onClose}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
      data-component="MetadataDockDrawer"
      data-placement={sheet ? 'bottom' : 'right'}
    >
      {children}
    </Drawer>
  );
}

// ─── the dock ──────────────────────────────────────────────────────────────

type Group = { childId?: string; label: string; current?: MetadataAnchor; read: ReadEntry[] };

function groupsFor(cfg: DockConfig, read: MetadataRead | undefined, sel: NoteSel): Group[] {
  const own: Group = { label: cfg.nounLabel, current: read?.current, read: readEntries(read?.entries) };
  const childGroup = (id: string): Group => ({
    childId: id,
    label: cfg.childLabel ? cfg.childLabel(id) : id,
    current: read?.childrenCurrent?.[id],
    read: readEntries(read?.children?.[id]),
  });
  if (sel.scope === 'self') return [own];
  if (sel.scope === 'child') return [childGroup(sel.child)];
  const ids = Object.keys(read?.children ?? {}).filter((id) => Object.keys(read?.children?.[id] ?? {}).length > 0);
  const order = cfg.childOrder ?? [];
  ids.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
    return childGroup(a).label.localeCompare(childGroup(b).label);
  });
  return [own, ...ids.map(childGroup)].filter((g) => g.read.length > 0);
}

function childKind(kind: MetadataKind): MetadataKind | null {
  if (kind === 'dashboard') return 'widget';
  if (kind === 'dataset') return 'column';
  return null;
}

function MetadataDock({
  cfg,
  read,
  sel,
  fromAll,
  onOpen,
  onClose,
}: Readonly<{
  cfg: DockConfig;
  read: MetadataRead | undefined;
  sel: NoteSel;
  fromAll: boolean;
  onOpen: (sel: NoteSel) => void;
  onClose: () => void;
}>) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLDivElement>(null);
  const selKey = serializeNote(sel);
  useEffect(() => {
    headingRef.current?.focus();
  }, [selKey]);
  // Esc closes the dock — unless another overlay (a modal, a popover) has it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const target = e.target as Element | null;
      if (target?.closest?.('.ant-modal, .ant-popover, .ant-select-dropdown, .ant-dropdown')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const reading = sel.scope !== 'all' && sel.ns ? sel : null;
  const group = reading ? groupsFor(cfg, read, { ...reading, ns: undefined } as NoteSel)[0] : undefined;
  const entry = reading ? group?.read.find((r) => r.namespace === reading.ns) : undefined;
  const kindLabel =
    sel.scope === 'child' ? t(`metadata.kind.${childKind(cfg.kind) ?? cfg.kind}`) : t(`metadata.kind.${cfg.kind}`);
  const nounLabel = sel.scope === 'child' ? (cfg.childLabel ? cfg.childLabel(sel.child) : sel.child) : cfg.nounLabel;
  const back = (): NoteSel =>
    fromAll || !reading
      ? { scope: 'all' }
      : reading.scope === 'child'
        ? { scope: 'child', child: reading.child }
        : { scope: 'self' };

  return (
    <aside
      data-component="MetadataDock"
      data-view={entry ? 'read' : 'notes'}
      aria-label={t('metadata.title')}
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ant-color-bg-container, #fff)',
        border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          padding: '12px 12px 8px 16px',
          borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        }}
      >
        <div ref={headingRef} tabIndex={-1} style={{ flex: '1 1 auto', minWidth: 0, outline: 'none' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {t('metadata.title')} · {sel.scope === 'all' ? t('metadata.dock.allNotes') : kindLabel}
          </Typography.Text>
          <Typography.Text
            strong
            style={{ fontSize: 15 }}
            ellipsis={{ tooltip: nounLabel }}
            data-component="MetadataDockNoun"
          >
            {nounLabel}
          </Typography.Text>
        </div>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          aria-label={t('metadata.dock.close')}
          onClick={onClose}
          data-component="MetadataDockClose"
        />
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: 16 }}>
        {entry && reading && group ? (
          <ReadView
            item={entry}
            current={group.current}
            paramLabels={cfg.paramLabels}
            onBack={() => onOpen(back())}
            backLabel={fromAll || !reading ? t('metadata.dock.allNotes') : t('metadata.dock.notes')}
          />
        ) : (
          <NotesView
            cfg={cfg}
            read={read}
            sel={reading ? ({ ...reading, ns: undefined } as NoteSel) : sel}
            onOpen={onOpen}
          />
        )}
      </div>
    </aside>
  );
}

function NotesView({
  cfg,
  read,
  sel,
  onOpen,
}: Readonly<{ cfg: DockConfig; read: MetadataRead | undefined; sel: NoteSel; onOpen: (sel: NoteSel) => void }>) {
  const { t } = useTranslation();
  const groups = groupsFor(cfg, read, sel);
  const total = groups.reduce((n, g) => n + g.read.length, 0);
  if (total === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('metadata.empty')} />;
  const many = sel.scope === 'all';
  return (
    <div data-component="MetadataNotes">
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        {t('metadata.count', { count: total })}
      </Typography.Text>
      {groups.map((g) => (
        <section
          key={g.childId ?? '.'}
          data-component="MetadataGroup"
          data-child={g.childId ?? ''}
          style={{ marginBottom: 16 }}
        >
          {many ? (
            <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
              {g.childId ? g.label : `${t(`metadata.kind.${cfg.kind}`)} · ${g.label}`}
            </Typography.Text>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {g.read.map((r) => (
              <NoteCard
                key={r.namespace}
                item={r}
                onRead={() =>
                  onOpen(
                    g.childId
                      ? { scope: 'child', child: g.childId, ns: r.namespace }
                      : { scope: 'self', ns: r.namespace },
                  )
                }
              />
            ))}
          </div>
        </section>
      ))}
      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
        {t('metadata.readOnlyHint')}
      </Typography.Text>
    </div>
  );
}

const MAX_CARD_PAIRS = 3;

function Chips({ item }: Readonly<{ item: ReadEntry }>) {
  const { t } = useTranslation();
  return (
    <>
      {item.severity ? <SeverityTag severity={item.severity} /> : null}
      {item.entry.source === 'ai' ? (
        <Tag color="purple" icon={<RobotOutlined />} style={{ marginInlineEnd: 0 }} data-component="MetadataAiBadge">
          {t('metadata.ai')}
        </Tag>
      ) : null}
      {stateTag(entryState(item.entry), t)}
    </>
  );
}

export function NoteCard({ item, onRead }: Readonly<{ item: ReadEntry; onRead: () => void }>) {
  const { t, i18n } = useTranslation();
  const title = displayTitle(item);
  const line = displayLine(item);
  const shown = item.pairs.filter(([k]) => k !== '').slice(0, MAX_CARD_PAIRS);
  const more = item.pairs.filter(([k]) => k !== '').length - shown.length;
  // R206 — a pointer click anywhere on the card opens it; the keyboard way in is the
  // "View details" link-button. A click on a link or button inside, or one that ends a
  // text selection, is left alone.
  const onCardClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element | null;
    if (target?.closest?.('a, button')) return;
    if (typeof window !== 'undefined' && (window.getSelection?.()?.toString() ?? '') !== '') return;
    onRead();
  };
  return (
    <div
      data-component="MetadataCard"
      data-namespace={item.namespace}
      data-severity={item.severity ?? ''}
      onClick={onCardClick}
      style={{
        border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <Typography.Text strong style={{ flex: '1 1 auto', minWidth: 0 }} data-component="MetadataCardTitle">
          {title}
        </Typography.Text>
        <Chips item={item} />
      </div>
      {line ? (
        <Typography.Text style={{ fontSize: 13 }} data-component="MetadataCardSummary">
          {line}
        </Typography.Text>
      ) : null}
      {shown.length > 0 ? (
        <dl
          style={{
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(80px, max-content) minmax(0, 1fr)',
            columnGap: 10,
            rowGap: 2,
            fontSize: 12,
          }}
        >
          {shown.map(([k, v], i) => (
            <div key={`${k}-${i}`} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--ant-color-text-secondary, #666)' }}>{k}</dt>
              <dd style={{ margin: 0, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {more > 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('metadata.dock.more', { count: more })}
        </Typography.Text>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, minWidth: 0 }} data-component="MetadataCardBy">
          {t('metadata.by', { author: item.entry.author, when: when(item.entry.writtenAt, i18n.language) })}
        </Typography.Text>
        <Button
          type="link"
          size="small"
          onClick={onRead}
          aria-label={t('metadata.card.detailsFor', { title })}
          data-component="MetadataCardRead"
          style={{ marginLeft: 'auto', paddingInline: 0 }}
        >
          {t('metadata.card.details')}
          <RightOutlined />
        </Button>
      </div>
    </div>
  );
}

function ReadView({
  item,
  current,
  paramLabels,
  onBack,
  backLabel,
}: Readonly<{
  item: ReadEntry;
  current?: MetadataAnchor;
  paramLabels?: Readonly<Record<string, string>>;
  onBack: () => void;
  backLabel: string;
}>) {
  const { t, i18n } = useTranslation();
  const state = entryState(item.entry);
  const { summary, assumed, beforePeriods } = anchorNotes(item.entry, current, paramLabels, t);
  const title = displayTitle(item);
  // R206 — a body that opens with the title as a heading does not print it twice.
  const body = withoutLeadingTitle(item.body, title);
  // The summary under the heading — unless it became the heading (no title, short enough).
  const lead = item.summary && (item.title || item.summary.length > TITLE_MAX) ? item.summary : undefined;
  return (
    <div data-component="MetadataRead" data-namespace={item.namespace}>
      <Button
        type="link"
        size="small"
        icon={<ArrowLeftOutlined />}
        onClick={onBack}
        style={{ padding: 0, marginBottom: 8 }}
        data-component="MetadataReadBack"
      >
        {backLabel}
      </Button>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 6 }} data-component="MetadataReadTitle">
        {title}
      </Typography.Title>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {title !== item.namespace ? (
          <Tag style={{ marginInlineEnd: 0 }} data-component="MetadataNamespace">
            {item.namespace}
          </Tag>
        ) : null}
        <Chips item={item} />
      </div>
      {summary ? (
        <Typography.Text
          type="secondary"
          style={{ fontSize: 12, display: 'block', marginBottom: 6 }}
          data-component="MetadataWrittenFor"
        >
          {summary}
        </Typography.Text>
      ) : null}
      <AnchorLines state={state} assumed={assumed} beforePeriods={beforePeriods} paramLabels={paramLabels} />
      {lead && !sameText(body, lead) ? (
        <Typography.Paragraph style={{ marginBottom: 8 }} data-component="MetadataReadSummary">
          {lead}
        </Typography.Paragraph>
      ) : null}
      <PairsTable pairs={item.pairs} />
      <SafeMarkdown md={body} />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
        {t('metadata.by', { author: item.entry.author, when: when(item.entry.writtenAt, i18n.language) })}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
        {t('metadata.readOnlyHint')}
      </Typography.Text>
    </div>
  );
}

/** True when the body already says the summary (whitespace and marks aside) —
 *  the Read view then does not print it twice. */
function sameText(body: string, summary: string): boolean {
  const s = normText(summary).replace(/…$/, '');
  return s.length > 0 && normText(body).includes(s);
}

// ─── the bar ───────────────────────────────────────────────────────────────

/** Every entry of a read: the noun's and its children's. */
export function allRead(read: MetadataRead | undefined): ReadEntry[] {
  const out = readEntries(read?.entries);
  for (const entries of Object.values(read?.children ?? {})) out.push(...readEntries(entries as MetadataEntries));
  return out;
}

/** Counts per severity, most serious first. */
export function severityCounts(read: readonly ReadEntry[]): [Severity, number][] {
  const counts = new Map<Severity, number>();
  for (const r of read) if (r.severity) counts.set(r.severity, (counts.get(r.severity) ?? 0) + 1);
  return (['error', 'decide', 'warn', 'info'] as const)
    .filter((s) => counts.has(s))
    .map((s) => [s, counts.get(s) ?? 0]);
}

/** R206 — what a dashboard adds to the bar: its At a glance rows. */
export type GlanceConfig = Readonly<{
  dashboardId: string;
  childOrder: readonly string[];
  childLabel: (id: string) => string;
}>;

/** The Notes & insights bar (R202 → R206): label, counts, the two most serious
 *  severities and a "View all" link to All notes — never a toggle; the dock's ×
 *  or `Esc` closes. While All notes shows, the same element reads "Showing all
 *  notes" (`aria-disabled`), so focus has somewhere to return on close. With
 *  `glance` (a dashboard) the bar is one block holding the At a glance rows,
 *  collapsible. Nothing written → nothing. R205: an optional `hint` line under it. */
export function MetadataBar({
  api,
  hint,
  glance,
}: Readonly<{ api: MetadataDockApi; hint?: ReactNode; glance?: GlanceConfig }>) {
  const { t } = useTranslation();
  const all = useMemo(() => allRead(api.read), [api.read]);
  const rows = useMemo(
    () => (glance ? glanceItems(api.read, glance.childOrder, glance.childLabel) : []),
    [glance, api.read],
  );
  const [collapsed, setCollapsed] = useState(() => (glance ? loadCollapsed(glance.dashboardId) : false));
  if (all.length === 0) return null;
  const ai = all.filter((r) => r.entry.source === 'ai').length;
  const showingAll = api.sel?.scope === 'all';
  const toggle = () => {
    if (glance) saveCollapsed(glance.dashboardId, !collapsed);
    setCollapsed(!collapsed);
  };
  const header = (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <Typography.Text strong>{t('metadata.title')}</Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('metadata.count', { count: all.length })}
        {ai > 0 ? ` · ${t('metadata.aiCount', { count: ai })}` : ''}
      </Typography.Text>
      {severityCounts(all)
        .slice(0, 2)
        .map(([s, n]) => (
          <SeverityTag key={s} severity={s} count={n} />
        ))}
      <Button
        type="link"
        size="small"
        onClick={() => {
          if (!showingAll) api.open({ scope: 'all' });
        }}
        aria-disabled={showingAll}
        data-component="MetadataBarOpen"
        data-showing={showingAll ? 'true' : 'false'}
        style={{
          paddingInline: 4,
          ...(showingAll ? { color: 'var(--ant-color-text-secondary, #595959)', cursor: 'default' } : {}),
        }}
      >
        {showingAll ? (
          t('metadata.bar.showing')
        ) : (
          <>
            {t('metadata.bar.viewAll')}
            <RightOutlined />
          </>
        )}
      </Button>
      {glance && rows.length > 0 ? (
        <Button
          type="text"
          size="small"
          onClick={toggle}
          aria-expanded={!collapsed}
          icon={collapsed ? <DownOutlined /> : <UpOutlined />}
          data-component="MetadataBarCollapse"
          style={{ marginLeft: 'auto' }}
        >
          {collapsed ? t('metadata.glance.expand') : t('metadata.glance.collapse')}
        </Button>
      ) : null}
    </div>
  );
  const hintLine = hint ? (
    // R205 — one secondary line under the bar, e.g. what the dataset page's column dots mean.
    <Typography.Text
      type="secondary"
      style={{ display: 'block', fontSize: 12, marginTop: 4 }}
      data-component="MetadataBarHint"
    >
      {hint}
    </Typography.Text>
  ) : null;
  if (!glance)
    return (
      <div data-component="MetadataBar" style={{ flex: '0 0 auto', marginBottom: 12 }}>
        {header}
        {hintLine}
      </div>
    );
  return (
    <section
      data-component="MetadataBar"
      data-block="true"
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label={t('metadata.title')}
      style={{
        flex: '0 0 auto',
        marginBottom: 16,
        padding: '10px 14px',
        border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        borderRadius: 8,
        background: 'var(--ant-color-bg-container, #fff)',
      }}
    >
      {header}
      {!collapsed && rows.length > 0 ? <GlanceRows items={rows} sel={api.sel} onOpen={api.open} /> : null}
      {hintLine}
    </section>
  );
}

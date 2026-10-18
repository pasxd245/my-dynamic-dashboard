// R180 — the read-only metadata panel. Shows every namespace's entry on a
// noun: who wrote it (an **AI** badge when `source === 'ai'`), when, the
// frontmatter as a key/value table, and the markdown body through the same
// `SafeMarkdown` as a note widget. There is deliberately nothing to click that
// edits: an entry is the writer's statement, changed only by the writer
// through the API.
//
// R197 (3.8) — each entry is read against the reader's view (`state`): the same
// (`current`), data refreshed since (`refreshed`, a small flag), another period
// (`other_period`) or an earlier definition (`other_definition`) — the last two
// collapsed to one line saying what it was written for, opened on click.

import { HistoryOutlined, RobotOutlined, SyncOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Collapse, Empty, Tag, Typography } from 'antd';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SafeMarkdown } from '@/features/dashboard/SafeMarkdown';
import { splitFrontmatter } from './frontmatter';
import { useMetadataQuery } from './hooks';
import type {
  MetadataAnchor,
  MetadataEntries,
  MetadataEntry,
  MetadataKind,
  MetadataParams,
  MetadataState,
} from './types';

function when(iso: string, lang: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
}

/** The entry's state; an rc.2 server sends only `stale`. */
export function entryState(entry: MetadataEntry): MetadataState {
  return entry.state ?? (entry.stale ? 'other_definition' : 'current');
}

/** `as_of 2026-10-11, team North` — only the names whose values differ between
 *  the two anchors (all of `a`'s when `b` has none). */
function differing(a: MetadataAnchor['params'], b: MetadataAnchor['params']): string {
  const names = Object.keys(a ?? {}).filter((n) => !b || !(n in b) || b[n] !== a?.[n]);
  return names.map((n) => `${n} ${String(a?.[n])}`).join(', ');
}

function stateTag(state: MetadataState, t: TFunction) {
  if (state === 'refreshed')
    return (
      <Tag
        color="blue"
        icon={<SyncOutlined />}
        style={{ marginInlineEnd: 0 }}
        data-component="MetadataState"
        data-state={state}
      >
        {t('metadata.state.refreshed')}
      </Tag>
    );
  if (state === 'other_period')
    return (
      <Tag
        color="gold"
        icon={<HistoryOutlined />}
        style={{ marginInlineEnd: 0 }}
        data-component="MetadataState"
        data-state={state}
      >
        {t('metadata.state.otherPeriod')}
      </Tag>
    );
  if (state === 'other_definition')
    return (
      <Tag
        color="warning"
        icon={<WarningOutlined />}
        style={{ marginInlineEnd: 0 }}
        data-component="MetadataState"
        data-state={state}
      >
        {t('metadata.state.otherDefinition')}
      </Tag>
    );
  return null;
}

/** One entry: header line + frontmatter table + body. Exported so a widget
 *  popover and the page panel render the same thing. `current` is the reader's
 *  anchor (R197), used to say what an entry was written for. */
export function MetadataEntryView({
  namespace,
  entry,
  current,
}: Readonly<{ namespace: string; entry: MetadataEntry; current?: MetadataAnchor }>) {
  const { t, i18n } = useTranslation();
  const state = entryState(entry);
  const collapsible = state === 'other_period' || state === 'other_definition';
  const [open, setOpen] = useState(!collapsible);
  const { pairs, body } = splitFrontmatter(entry.md);
  const anchor = entry.anchor;
  const summary =
    state === 'other_period'
      ? t('metadata.writtenFor', {
          written: differing(anchor?.params, current?.params),
          viewing: differing(current?.params, anchor?.params) || t('metadata.noValue'),
        })
      : state === 'other_definition'
        ? t('metadata.writtenForDefinition')
        : null;
  const assumed = anchor?.assumedParams ?? [];
  const beforePeriods = !anchor?.params && current?.params !== undefined && Object.keys(current.params).length > 0;
  return (
    <div
      data-component="MetadataEntry"
      data-namespace={namespace}
      data-source={entry.source}
      data-state={state}
      style={{ marginBottom: 12, opacity: collapsible && !open ? 0.75 : 1 }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Tag style={{ marginInlineEnd: 0 }} data-component="MetadataNamespace">
          {namespace}
        </Tag>
        {entry.source === 'ai' ? (
          <Tag color="purple" icon={<RobotOutlined />} style={{ marginInlineEnd: 0 }} data-component="MetadataAiBadge">
            {t('metadata.ai')}
          </Tag>
        ) : null}
        {stateTag(state, t)}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('metadata.by', { author: entry.author, when: when(entry.writtenAt, i18n.language) })}
        </Typography.Text>
      </div>
      {summary ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: open ? 6 : 0 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="MetadataWrittenFor">
            {summary}
          </Typography.Text>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto', fontSize: 12 }}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            data-component="MetadataToggle"
          >
            {open ? t('metadata.hide') : t('metadata.show')}
          </Button>
        </div>
      ) : null}
      {open ? (
        <>
          {state === 'other_definition' ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 8, fontSize: 12 }}
              message={t('metadata.definitionWarning')}
              data-component="MetadataDefinitionWarning"
            />
          ) : null}
          {assumed.length > 0 ? (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, display: 'block', marginBottom: 6 }}
              data-component="MetadataAssumed"
            >
              {t('metadata.assumed', { names: assumed.join(', ') })}
            </Typography.Text>
          ) : beforePeriods ? (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, display: 'block', marginBottom: 6 }}
              data-component="MetadataBeforePeriods"
            >
              {t('metadata.beforePeriods')}
            </Typography.Text>
          ) : null}
          {pairs.length > 0 ? (
            <table
              data-component="MetadataFrontmatter"
              style={{ fontSize: 12, borderCollapse: 'collapse', marginBottom: 8 }}
            >
              <tbody>
                {pairs.map(([k, v], i) => (
                  <tr key={`${k}-${i}`}>
                    <td
                      style={{
                        padding: '2px 12px 2px 0',
                        color: 'var(--ant-color-text-secondary, #666)',
                        verticalAlign: 'top',
                      }}
                    >
                      {k}
                    </td>
                    <td style={{ padding: '2px 0' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <SafeMarkdown md={body} />
        </>
      ) : null}
    </div>
  );
}

export function MetadataEntriesList({
  entries,
  current,
}: Readonly<{ entries: MetadataEntries; current?: MetadataAnchor }>) {
  const names = Object.keys(entries).sort();
  return (
    <>
      {names.map((ns) => (
        <MetadataEntryView key={ns} namespace={ns} entry={entries[ns] as MetadataEntry} current={current} />
      ))}
    </>
  );
}

type MetadataPanelProps = Readonly<{
  kind: MetadataKind;
  nounId: string | undefined;
  /** How to label a child group (a column name, a widget title). */
  childLabel?: (childId: string) => string;
  /** Render nothing at all when there are no entries (the default shows a
   *  collapsed header with the empty state only when `alwaysShow`). */
  alwaysShow?: boolean;
  /** R197 — the page's parameter values (query page URL, dashboard viewer values). */
  params?: MetadataParams;
}>;

/** The page-level panel: the noun's own entries, then each child's. Renders
 *  nothing while loading or when nothing is written (unless `alwaysShow`). */
export function MetadataPanel({ kind, nounId, childLabel, alwaysShow = false, params }: MetadataPanelProps) {
  const { t } = useTranslation();
  const q = useMetadataQuery(kind, nounId, params);
  const entries = q.data?.entries ?? {};
  const children = q.data?.children ?? {};
  const ownCount = Object.keys(entries).length;
  const childCount = Object.values(children).reduce((n, e) => n + Object.keys(e).length, 0);
  const total = ownCount + childCount;
  if (!alwaysShow && (q.isLoading || total === 0)) return null;
  const aiCount =
    Object.values(entries).filter((e) => e.source === 'ai').length +
    Object.values(children)
      .flatMap((e) => Object.values(e))
      .filter((e) => e.source === 'ai').length;
  return (
    <Collapse
      size="small"
      defaultActiveKey={total > 0 ? ['m'] : []}
      style={{ marginBottom: 16 }}
      data-component="MetadataPanel"
      items={[
        {
          key: 'm',
          label: (
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <Typography.Text strong>{t('metadata.title')}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('metadata.count', { count: total })}
                {aiCount > 0 ? ` · ${t('metadata.aiCount', { count: aiCount })}` : ''}
              </Typography.Text>
            </span>
          ),
          children:
            total === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('metadata.empty')} />
            ) : (
              <>
                <MetadataEntriesList entries={entries} current={q.data?.current} />
                {Object.keys(children)
                  .sort()
                  .map((childId) => (
                    <div key={childId} data-component="MetadataChild" data-child={childId} style={{ marginTop: 8 }}>
                      <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                        {childLabel ? childLabel(childId) : childId}
                      </Typography.Text>
                      <MetadataEntriesList
                        entries={children[childId] as MetadataEntries}
                        current={q.data?.childrenCurrent?.[childId]}
                      />
                    </div>
                  ))}
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {t('metadata.readOnlyHint')}
                </Typography.Text>
              </>
            ),
        },
      ]}
    />
  );
}

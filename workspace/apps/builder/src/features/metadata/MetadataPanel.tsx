// R180 — the read-only metadata panel. Shows every namespace's entry on a
// noun: who wrote it (an **AI** badge when `source === 'ai'`), when, whether
// the noun has changed since (`stale`), the frontmatter as a key/value table,
// and the markdown body through the same `SafeMarkdown` as a note widget.
// There is deliberately nothing to click that edits: an entry is the
// writer's statement, changed only by the writer through the API.

import { RobotOutlined, WarningOutlined } from '@ant-design/icons';
import { Collapse, Empty, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { SafeMarkdown } from '@/features/dashboard/SafeMarkdown';
import { splitFrontmatter } from './frontmatter';
import { useMetadataQuery } from './hooks';
import type { MetadataEntries, MetadataEntry, MetadataKind } from './types';

function when(iso: string, lang: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
}

/** One entry: header line + frontmatter table + body. Exported so a widget
 *  popover and the page panel render the same thing. */
export function MetadataEntryView({ namespace, entry }: Readonly<{ namespace: string; entry: MetadataEntry }>) {
  const { t, i18n } = useTranslation();
  const { pairs, body } = splitFrontmatter(entry.md);
  return (
    <div data-component="MetadataEntry" data-namespace={namespace} data-source={entry.source} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Tag style={{ marginInlineEnd: 0 }} data-component="MetadataNamespace">
          {namespace}
        </Tag>
        {entry.source === 'ai' ? (
          <Tag color="purple" icon={<RobotOutlined />} style={{ marginInlineEnd: 0 }} data-component="MetadataAiBadge">
            {t('metadata.ai')}
          </Tag>
        ) : null}
        {entry.stale ? (
          <Tag color="warning" icon={<WarningOutlined />} style={{ marginInlineEnd: 0 }} data-component="MetadataStale">
            {t('metadata.stale')}
          </Tag>
        ) : null}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('metadata.by', { author: entry.author, when: when(entry.writtenAt, i18n.language) })}
        </Typography.Text>
      </div>
      {pairs.length > 0 ? (
        <table data-component="MetadataFrontmatter" style={{ fontSize: 12, borderCollapse: 'collapse', marginBottom: 8 }}>
          <tbody>
            {pairs.map(([k, v], i) => (
              <tr key={`${k}-${i}`}>
                <td style={{ padding: '2px 12px 2px 0', color: 'var(--ant-color-text-secondary, #666)', verticalAlign: 'top' }}>
                  {k}
                </td>
                <td style={{ padding: '2px 0' }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <SafeMarkdown md={body} />
    </div>
  );
}

export function MetadataEntriesList({ entries }: Readonly<{ entries: MetadataEntries }>) {
  const names = Object.keys(entries).sort();
  return (
    <>
      {names.map((ns) => (
        <MetadataEntryView key={ns} namespace={ns} entry={entries[ns] as MetadataEntry} />
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
}>;

/** The page-level panel: the noun's own entries, then each child's. Renders
 *  nothing while loading or when nothing is written (unless `alwaysShow`). */
export function MetadataPanel({ kind, nounId, childLabel, alwaysShow = false }: MetadataPanelProps) {
  const { t } = useTranslation();
  const q = useMetadataQuery(kind, nounId);
  const entries = q.data?.entries ?? {};
  const children = q.data?.children ?? {};
  const ownCount = Object.keys(entries).length;
  const childCount = Object.values(children).reduce((n, e) => n + Object.keys(e).length, 0);
  const total = ownCount + childCount;
  if (!alwaysShow && (q.isLoading || total === 0)) return null;
  const aiCount =
    Object.values(entries).filter((e) => e.source === 'ai').length +
    Object.values(children).flatMap((e) => Object.values(e)).filter((e) => e.source === 'ai').length;
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
                <MetadataEntriesList entries={entries} />
                {Object.keys(children)
                  .sort()
                  .map((childId) => (
                    <div key={childId} data-component="MetadataChild" data-child={childId} style={{ marginTop: 8 }}>
                      <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                        {childLabel ? childLabel(childId) : childId}
                      </Typography.Text>
                      <MetadataEntriesList entries={children[childId] as MetadataEntries} />
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

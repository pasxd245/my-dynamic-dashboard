// R200 (item 4.4) — the History drawer of a query, dashboard or workflow
// (design: .agents/design/data-management/_shared/definition-history.md).
//
// Read-only list of every saved definition, newest first; a row's technical
// definition (JSON) expands in place; Restore re-saves an old definition through
// the noun's OWN update (the page passes `restore`), so it runs every check an
// edit runs and records a new version. Labels always use the CLICKED row's seq
// (the version read answers the newest row with that hash, which can be another).

import { HistoryOutlined, WarningOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Drawer, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { historyApi } from '@/api/historyApi';
import { ApiErrorThrown } from '@/features/data-management/_shared/types';
import { historyKey, useHistoryQuery, useHistoryVersionQuery } from './hooks';
import { canRestore, currentSeqOf, sameAsOf } from './sameAs';
import type { HistoryEntry, HistoryKind } from './types';

type TFn = ReturnType<typeof useTranslation>['t'];

function when(iso: string, lang: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
}

/** BA-C9 — one readable line for a refused restore; the raw error (a FastAPI
 *  `detail[]` 422 included) goes to the console, never into the toast. */
export function restoreErrorText(err: unknown, t: TFn): string {
  if (err instanceof ApiErrorThrown) {
    if (err.body.code === 'not_found') return t('history.refusedGone');
    if (err.body.code === 'name_taken' || err.body.code === 'slug_taken') return t('history.refusedName');
  }
  return t('history.refused');
}

type RestoreFn = (definition: Record<string, unknown>) => Promise<unknown>;

type DrawerProps = Readonly<{
  kind: HistoryKind;
  nounId: string;
  nounName: string;
  open: boolean;
  onClose: () => void;
  restore: RestoreFn;
}>;

function JsonPanel({ kind, nounId, entry }: Readonly<{ kind: HistoryKind; nounId: string; entry: HistoryEntry }>) {
  const { t } = useTranslation();
  const q = useHistoryVersionQuery(kind, nounId, entry.version, entry.seq);
  return (
    <div data-component="HistoryJson" data-seq={entry.seq} style={{ marginTop: 8 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('history.jsonTitle', { seq: entry.seq })}
      </Typography.Text>
      {q.isLoading ? <Skeleton active paragraph={{ rows: 3 }} title={false} /> : null}
      {q.isError ? <Alert type="error" showIcon message={t('history.loadError')} /> : null}
      {q.data ? (
        <pre
          style={{
            margin: '4px 0 0',
            padding: 8,
            maxHeight: 320,
            overflow: 'auto',
            fontSize: 12,
            background: 'var(--ant-color-fill-alter, #fafafa)',
            borderRadius: 6,
            fontFamily: 'var(--ant-font-family-code, monospace)',
          }}
        >
          {JSON.stringify(q.data.definition, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function ConfirmBody({ kind, seq, sourceChanged }: Readonly<{ kind: HistoryKind; seq: number; sourceChanged: boolean }>) {
  const { t } = useTranslation();
  return (
    <div data-component="HistoryRestoreConfirm" data-seq={seq}>
      <Typography.Paragraph style={{ marginBottom: 8 }}>{t('history.confirmBody', { seq })}</Typography.Paragraph>
      <Typography.Paragraph style={{ marginBottom: 8 }}>{t(`history.kindLine.${kind}`, { seq })}</Typography.Paragraph>
      {sourceChanged ? (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={t('history.sourceChanged')}
          data-component="HistorySourceChanged"
        />
      ) : null}
    </div>
  );
}

export function DefinitionHistoryDrawer({ kind, nounId, nounName, open, onClose, restore }: DrawerProps) {
  const { t, i18n } = useTranslation();
  const { modal, message } = App.useApp();
  const queryClient = useQueryClient();
  const list = useHistoryQuery(kind, nounId, open);
  const [jsonSeq, setJsonSeq] = useState<number | null>(null);

  const startRestore = async (entry: HistoryEntry) => {
    let version;
    try {
      // QA-1 — always a fresh read: the source warning must reflect a refresh made
      // since the JSON view (or anything else) cached this version (app staleTime 60 s).
      version = await queryClient.fetchQuery({
        queryKey: [...historyKey(kind, nounId), entry.version, entry.seq],
        queryFn: () => historyApi.version(kind, nounId, entry.version, entry.seq),
        staleTime: 0,
      });
    } catch (err) {
      console.warn('history: version read failed', err);
      message.error(t('history.loadError'));
      return;
    }
    modal.confirm({
      title: t('history.confirmTitle', { seq: entry.seq }),
      content: <ConfirmBody kind={kind} seq={entry.seq} sourceChanged={kind === 'query' && version.sourceChangedSince === true} />,
      okText: t('history.restore'),
      cancelText: t('common.cancel'),
      width: 480,
      onOk: async () => {
        // BA-F4 — the newest row right before the PUT (another tab or an agent may have
        // saved since the list was read), so "already current" is judged on fresh data.
        const before = await historyApi.list(kind, nounId).catch(() => null);
        const newestBefore = (before ?? list.data)?.entries[0]?.seq;
        try {
          await restore(version.definition);
        } catch (err) {
          console.warn('history: restore refused', err);
          message.error(restoreErrorText(err, t));
          return;
        }
        const fresh = await historyApi.list(kind, nounId).catch(() => null);
        if (fresh) queryClient.setQueryData(historyKey(kind, nounId), fresh);
        else void queryClient.invalidateQueries({ queryKey: historyKey(kind, nounId) });
        const newest = fresh?.entries[0]?.seq;
        if (newest !== undefined && newest === newestBefore) {
          // CR-5 — the save wrote no row (the definition was already this version).
          message.info(t('history.alreadyCurrent', { from: entry.seq }));
        } else {
          message.success(
            newest !== undefined
              ? t('history.restored', { from: entry.seq, to: newest })
              : t('history.restoredPlain', { from: entry.seq }),
          );
        }
      },
    });
  };

  let body: ReactNode;
  if (list.isLoading) {
    body = <Skeleton active paragraph={{ rows: 4 }} />;
  } else if (list.isError || !list.data) {
    body = <Alert type="error" showIcon message={t('history.loadError')} data-component="HistoryError" />;
  } else if (list.data.entries.length === 0) {
    body = <Empty description={t('history.empty')} />;
  } else {
    const { entries, current } = list.data;
    const sameAs = sameAsOf(entries);
    const currentSeq = currentSeqOf(entries, current);
    body = (
      <div data-component="HistoryList">
        {entries.map((e) => {
          const same = sameAs.get(e.seq);
          return (
            <div
              key={e.seq}
              data-component="HistoryRow"
              data-seq={e.seq}
              style={{ padding: '10px 0', borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <Space size={6} wrap>
                  <Typography.Text strong>#{e.seq}</Typography.Text>
                  {e.seq === currentSeq ? <Tag color="processing">{t('history.current')}</Tag> : null}
                  {same !== undefined ? <Tag>{t('history.sameAs', { seq: same })}</Tag> : null}
                  {e.change === 'baseline' ? <Tag>{t('history.started')}</Tag> : null}
                </Space>
                <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="HistoryWhen">
                  {when(e.changedAt, i18n.language)}
                  {e.changedBy ? ` · ${e.changedBy}` : ''}
                </Typography.Text>
              </div>
              {e.change === 'baseline' ? (
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>
                  {t('history.baselineNote')}
                </Typography.Paragraph>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('history.version', { version: e.version })}
                </Typography.Text>
                <Space size={4}>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => setJsonSeq(jsonSeq === e.seq ? null : e.seq)}
                    data-component="HistoryJsonToggle"
                  >
                    {t('history.json')}
                  </Button>
                  {canRestore(e, current) ? (
                    <Button
                      size="small"
                      type="link"
                      onClick={() => void startRestore(e)}
                      data-component="HistoryRestore"
                    >
                      {t('history.restore')}
                    </Button>
                  ) : null}
                </Space>
              </div>
              {jsonSeq === e.seq ? <JsonPanel kind={kind} nounId={nounId} entry={e} /> : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Drawer
      title={t('history.title', { name: nounName })}
      open={open}
      onClose={onClose}
      size={520}
      destroyOnHidden
      data-component="DefinitionHistoryDrawer"
    >
      <Typography.Paragraph type="secondary" data-component="HistoryIntro">
        {t('history.intro', { resource: t(`history.resource.${kind}`) })}
      </Typography.Paragraph>
      {body}
    </Drawer>
  );
}

/** The header button that opens the drawer. */
export function DefinitionHistoryButton(props: Readonly<Omit<DrawerProps, 'open' | 'onClose'>>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<HistoryOutlined />} onClick={() => setOpen(true)} data-component="DefinitionHistoryButton">
        {t('history.button')}
      </Button>
      <DefinitionHistoryDrawer {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** BA-C8 — "This also deletes its N saved versions." for a delete confirm;
 *  nothing while the count loads or when it cannot be read. */
export function SavedVersionsLine({ kind, nounId }: Readonly<{ kind: HistoryKind; nounId: string }>) {
  const { t } = useTranslation();
  const q = useHistoryQuery(kind, nounId);
  if (!q.data) return null;
  return (
    <Typography.Paragraph style={{ marginBottom: 4 }} data-component="SavedVersionsLine">
      {t('history.deleteLine', { count: q.data.entries.length })}
    </Typography.Paragraph>
  );
}

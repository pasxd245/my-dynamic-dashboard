// QueryDetailPage (R69) — query mode at /data-management/queries/:id.
//
// REUSES the standard detail layout (PageHeader + PageCard + the shared
// <PagedRowsView>) — the same shell dataset-detail uses — and adds two
// sections of its own: a read-only predicate summary and a source-dataset
// link. Predicates are not editable this round; the saved definition is the
// source of truth and the rows come from the live re-run (GET /queries/:id/rows).

import { ArrowLeftOutlined, DatabaseOutlined, WarningOutlined } from '@ant-design/icons';
import { PageCard, PageHeader } from '@mdd/ui';
import { App, Button, Skeleton, Tag, Typography } from 'antd';
import i18n from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useDatasetQuery } from '@/features/data-management/datasets/hooks';
import { formatChipText } from '@/features/data-management/datasets/filters/ActiveFilterChips';
import { groupsToText } from '@/features/data-management/datasets/advanced-query/serialize';
import { ApiErrorThrown } from '../_shared/types';
import { DeleteConfirmModal } from '../_shared/DeleteConfirmModal';
import { PagedRowsView } from '../_shared/PagedRowsView';
import { useDeleteQueryMutation, useQueryQuery, useQueryRowsQuery } from './hooks';

const ALLOWED_PAGE_SIZES = [25, 50, 100] as const;

function clampPageSize(raw: string | null): number {
  const n = Number(raw);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? n : 50;
}
function clampPage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
function isNotFound(err: unknown): boolean {
  return err instanceof ApiErrorThrown && err.body.code === 'not_found';
}
function isStale(err: unknown): boolean {
  return err instanceof ApiErrorThrown && err.body.code === 'query_stale';
}

export function QueryDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = App.useApp();

  const page = clampPage(searchParams.get('page'));
  const pageSize = clampPageSize(searchParams.get('page_size'));

  const queryQuery = useQueryQuery(id);
  const query = queryQuery.data;
  const datasetQuery = useDatasetQuery(query?.datasetId);
  const dataset = datasetQuery.data;
  const rowsQuery = useQueryRowsQuery(id, page, pageSize);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useDeleteQueryMutation();

  const notFound = isNotFound(queryQuery.error) || isNotFound(rowsQuery.error);
  const stale = isStale(rowsQuery.error);

  const BREADCRUMB = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dataManagement'), route: '/data-management/workspaces' },
    { label: t('nav.queries'), route: '/data-management/queries' },
    { label: query?.name ?? '…' },
  ];

  const handlePageChange = (nextPage: number, nextPageSize: number) => {
    const params = new URLSearchParams(searchParams);
    if (nextPageSize !== pageSize) {
      params.set('page_size', String(nextPageSize));
      params.delete('page');
    } else if (nextPage === 1) {
      params.delete('page');
    } else {
      params.set('page', String(nextPage));
    }
    setSearchParams(params);
  };

  const confirmDelete = () => {
    if (!query) return;
    deleteMutation.mutate(query.id, {
      onSuccess: () => {
        message.success(t('queries.detail.deleteSuccess', { name: query.name }));
        navigate('/data-management/queries', { replace: true });
      },
    });
  };

  // ─── 404 ───────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <>
        <PageHeader
          breadcrumb={[...BREADCRUMB.slice(0, 3), { label: '?' }]}
          title={t('queries.detail.notFoundTitle')}
          onNavigate={(r) => navigate(r)}
        />
        <PageCard>
          <div data-component="QueryDetailNotFound" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <DatabaseOutlined style={{ fontSize: 36, opacity: 0.45, marginBottom: 12 }} />
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('queries.detail.notFoundTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('queries.detail.notFoundHint')}</Typography.Text>
            <div style={{ marginTop: 20 }}>
              <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate('/data-management/queries')}>
                {t('queries.detail.backToQueries')}
              </Button>
            </div>
          </div>
        </PageCard>
      </>
    );
  }

  // ─── Loading (query metadata) ──────────────────────────────────────
  if (!query) {
    return (
      <>
        <PageHeader breadcrumb={BREADCRUMB} title={t('queries.detail.loadingTitle')} onNavigate={(r) => navigate(r)} />
        <PageCard>
          <Skeleton active paragraph={{ rows: 8 }} data-component="QueryDetailLoading" />
        </PageCard>
      </>
    );
  }

  const sourceName = dataset?.name ?? query.datasetId;
  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span>{query.name}</span>
      <Tag color={stale ? 'warning' : 'processing'}>
        {stale ? t('queries.detail.badgeStale') : t('queries.detail.badgeLive')}
      </Tag>
    </span>
  );
  const sourceLink = (
    <Typography.Link
      onClick={() => navigate(`/data-management/datasets/${query.datasetId}`)}
      data-component="QuerySourceDatasetLink"
    >
      {sourceName} ↗
    </Typography.Link>
  );

  const actions = (
    <Button danger onClick={() => setDeleteOpen(true)} data-component="QueryDetailDelete">
      {t('common.delete')}
    </Button>
  );

  // ─── Stale ─────────────────────────────────────────────────────────
  if (stale) {
    return (
      <>
        <PageHeader breadcrumb={BREADCRUMB} title={title} actions={actions} onNavigate={(r) => navigate(r)} />
        <PageCard>
          <div data-component="QueryDetailStale" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <WarningOutlined style={{ fontSize: 36, color: 'var(--ant-color-warning, #faad14)', marginBottom: 12 }} />
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('queries.detail.staleTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('queries.detail.staleHint', { dataset: sourceName })}
            </Typography.Text>
            <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button type="primary" onClick={() => navigate(`/data-management/datasets/${query.datasetId}`)}>
                {t('queries.detail.openSourceDataset')}
              </Button>
              <Button danger onClick={() => setDeleteOpen(true)}>
                {t('queries.detail.deleteQuery')}
              </Button>
            </div>
          </div>
        </PageCard>
        <DeleteConfirmModal
          resourceLabel="query"
          resourceName={query.name}
          open={deleteOpen}
          isPending={deleteMutation.isPending}
          onConfirm={confirmDelete}
          onClose={() => !deleteMutation.isPending && setDeleteOpen(false)}
        />
      </>
    );
  }

  // ─── Populated ─────────────────────────────────────────────────────
  const total = rowsQuery.data?.total ?? 0;
  const columns = dataset?.columns ?? [];
  const locale = i18n.language;
  const def = query.definition;

  const predicateTags = (
    <div
      data-component="QueryPredicateSummary"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '8px 12px',
        background: 'var(--ant-color-fill-quaternary, #fafafa)',
        border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        borderRadius: 6,
        marginBottom: 12,
        flex: '0 0 auto',
      }}
    >
      <Typography.Text
        type="secondary"
        style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}
      >
        {t('queries.detail.appliedPredicates')}
      </Typography.Text>
      {def.q ? <Tag color="default">{t('queries.detail.searchTag', { q: def.q })}</Tag> : null}
      {def.filters.map((p) => (
        <Tag key={`f-${p.col}`} color="default">
          {formatChipText(p, columns, locale, t)}
        </Tag>
      ))}
      {def.advanced.length > 0 ? (
        <Tag color="default">{groupsToText(def.advanced, columns)}</Tag>
      ) : null}
    </div>
  );

  return (
    <div
      data-component="QueryDetailPage"
      style={{ height: 'calc(100vh - 88px)', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <PageHeader
        breadcrumb={BREADCRUMB}
        title={title}
        subtitle={t('queries.detail.subtitle')}
        actions={actions}
        onNavigate={(r) => navigate(r)}
      />
      <PageCard variant="fill">
        <div style={{ flex: '0 0 auto', marginBottom: 8 }}>
          <Typography.Text type="secondary">
            {t('queries.detail.sourceLabel')} {sourceLink}
          </Typography.Text>
        </div>
        {predicateTags}
        <div style={{ flex: '0 0 auto', marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('queries.detail.matchedOfTotal', {
              matched: total.toLocaleString(locale),
              total: (dataset?.rowCount ?? 0).toLocaleString(locale),
            })}
          </Typography.Text>
        </div>
        <PagedRowsView
          columns={columns}
          rows={rowsQuery.data?.rows}
          loading={rowsQuery.isFetching || datasetQuery.isLoading}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          emptyState={
            <>
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                {t('queries.detail.zeroRowsTitle')}
              </Typography.Title>
              <Typography.Text type="secondary">{t('queries.detail.zeroRowsHint')}</Typography.Text>
            </>
          }
        />
      </PageCard>
      <DeleteConfirmModal
        resourceLabel="query"
        resourceName={query.name}
        open={deleteOpen}
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => !deleteMutation.isPending && setDeleteOpen(false)}
      />
    </div>
  );
}

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

import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '@/_generated/constants';
import { useDatasetQuery } from '@/features/data-management/datasets/hooks';
import { formatChipText } from '@/features/data-management/datasets/filters/ActiveFilterChips';
import { groupsToText } from '@/features/data-management/datasets/advanced-query/serialize';
import { ApiErrorThrown } from '../_shared/types';
import { readChain, readRels } from './chain';
import { DeleteConfirmModal } from '../_shared/DeleteConfirmModal';
import { PagedRowsView } from '../_shared/PagedRowsView';
import { QueryBuilderPanel } from './QueryBuilderPanel';
import { useQueryBuilder } from './useQueryBuilder';
import { useDeleteQueryMutation, useQueryQuery, useQueryRowsQuery } from './hooks';

function clampPageSize(raw: string | null): number {
  const n = Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
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
// R71 — a joined query whose consumed edge's key column drifted: the join
// is blocked (distinct from query_stale, which is a predicate-atom drift).
function isRelStale(err: unknown): boolean {
  return err instanceof ApiErrorThrown && err.body.code === 'relationship_stale';
}
// R76 — a composed query whose base (transitively) builds back on itself: the
// run is blocked rather than recursing forever (the composition_cycle guard).
function isCompositionCycle(err: unknown): boolean {
  return err instanceof ApiErrorThrown && err.body.code === 'composition_cycle';
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
  // R79 — the source is the polymorphic `sourceId`; resolve a Dataset only when it
  // is a `ds_` (dataset-rooted). A composed query (`qr_` source) shows its BASE
  // QUERY as the source (the composition summary below), not a source dataset.
  const sourceDatasetId = query?.sourceId.startsWith('ds_') ? query.sourceId : undefined;
  const datasetQuery = useDatasetQuery(sourceDatasetId);
  const dataset = datasetQuery.data;
  const rowsQuery = useQueryRowsQuery(id, page, pageSize);

  // R76 — a COMPOSED query's driving source is another Query (`qr_…`); fetch it
  // to render the read-only "based on" summary + the open-base link. (A `ds_`
  // source / no sourceId is the unchanged dataset-rooted path.)
  const baseQueryId = query?.sourceId?.startsWith('qr_') ? query.sourceId : undefined;
  const isComposed = Boolean(baseQueryId);
  const baseQueryQuery = useQueryQuery(baseQueryId);
  const baseQueryName = baseQueryQuery.data?.name ?? baseQueryId;

  // R71 — a joined query consumes a Relationship; fetch it (+ the right
  // dataset) to render the read-only join summary. Hooks run unconditionally;
  // both are `enabled` only when their id resolves.
  // R73 — a Query may now chain 2+ hops; read either wire shape into the chain.
  const chain = query ? readChain(query.definition) : [];
  // R88 — the read-only join summary reads the query's OWN relationships
  // (snapshots in the definition), not the governed store: a saved query runs on
  // its copies, so the summary reflects exactly what it will execute.
  const qrelById = new Map((query ? readRels(query.definition) : []).map((r) => [r.id, r]));
  const firstJoin = chain[0];
  const isJoined = chain.length > 0;
  const relationship = firstJoin ? qrelById.get(firstJoin.queryRelId) : undefined;
  const rightDatasetQuery = useDatasetQuery(relationship?.rightSourceId);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const deleteMutation = useDeleteQueryMutation();

  // R72 — the construction surface's state lives here (not in the panel) so the
  // page header can drive Save/Cancel. Inactive (no preview) until edit mode.
  const builder = useQueryBuilder({
    query,
    datasetColumns: dataset?.columns ?? [],
    active: editing,
    onDone: () => setEditing(false),
  });

  const notFound = isNotFound(queryQuery.error) || isNotFound(rowsQuery.error);
  const stale = isStale(rowsQuery.error);
  const relStale = isRelStale(rowsQuery.error);
  // R76 — the composition guard fired (the base loops back); block the run.
  const cycle = isCompositionCycle(rowsQuery.error);

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

  const sourceName = dataset?.name ?? baseQueryName ?? query.sourceId;
  const warn = stale || relStale || cycle;
  let badgeKey = 'queries.detail.badgeLive';
  if (cycle) badgeKey = 'queries.detail.badgeCompositionUnavailable';
  else if (relStale) badgeKey = 'queries.detail.badgeJoinUnavailable';
  else if (stale) badgeKey = 'queries.detail.badgeStale';
  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span>{query.name}</span>
      <Tag color={warn ? 'warning' : 'processing'}>{t(badgeKey)}</Tag>
      {isComposed ? <Tag color="purple">{t('queries.detail.badgeComposed')}</Tag> : null}
      {isJoined ? <Tag color="geekblue">{t('queries.detail.badgeJoin')}</Tag> : null}
    </span>
  );
  // The source-dataset link — only for a dataset-rooted query. A composed query's
  // source is its base query, surfaced by the composition summary below (R79).
  const sourceLink = sourceDatasetId ? (
    <Typography.Link
      onClick={() => navigate(`/data-management/datasets/${sourceDatasetId}`)}
      data-component="QuerySourceDatasetLink"
    >
      {sourceName} ↗
    </Typography.Link>
  ) : null;

  const actions = (
    <Button danger onClick={() => setDeleteOpen(true)} data-component="QueryDetailDelete">
      {t('common.delete')}
    </Button>
  );
  // R72 — the populated header offers [Edit]; in edit mode it swaps to
  // [Cancel] [Save] (the app's header-actions convention — the builder no
  // longer has a footer). Absent from the stale / join-unavailable headers
  // (repair the source/edge first).
  const populatedActions = editing ? (
    <span style={{ display: 'inline-flex', gap: 8 }}>
      <Button onClick={builder.cancel} data-component="QueryBuilderCancel">
        {t('common.cancel')}
      </Button>
      <Button
        type="primary"
        onClick={builder.save}
        disabled={!builder.canSave}
        loading={builder.isSaving}
        data-component="QueryBuilderSave"
      >
        {t('queries.builder.save')}
      </Button>
    </span>
  ) : (
    <span style={{ display: 'inline-flex', gap: 8 }}>
      <Button type="primary" onClick={() => setEditing(true)} data-component="QueryDetailEdit">
        {t('queries.builder.edit')}
      </Button>
      {/* R77 — "Build on this query": open the builder in CREATE mode with this
          Query preset as the base. Present only on the runnable (Populated)
          detail (these actions are; the stale / unavailable headers use `actions`). */}
      <Button
        onClick={() => navigate(`/data-management/queries/new?base=${query.id}`)}
        data-component="QueryDetailBuildOn"
      >
        {t('queries.detail.buildOnThis')}
      </Button>
      {actions}
    </span>
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
            <Typography.Text type="secondary">{t('queries.detail.staleHint', { dataset: sourceName })}</Typography.Text>
            <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button
                type="primary"
                onClick={() =>
                  navigate(
                    sourceDatasetId
                      ? `/data-management/datasets/${sourceDatasetId}`
                      : `/data-management/queries/${baseQueryId}`,
                  )
                }
              >
                {t(sourceDatasetId ? 'queries.detail.openSourceDataset' : 'queries.detail.openBaseQuery')}
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

  // ─── Join unavailable (relationship_stale) — R71 ───────────────────
  // A joined query whose consumed edge's key column drifted: block the join,
  // point the user at the workspace Relationships view (flag, don't crash).
  if (relStale) {
    const relsRoute = `/data-management/workspaces/${query.workspaceId}/relationships`;
    return (
      <>
        <PageHeader breadcrumb={BREADCRUMB} title={title} actions={actions} onNavigate={(r) => navigate(r)} />
        <PageCard>
          <div
            data-component="QueryDetailJoinUnavailable"
            role="alert"
            style={{ padding: '40px 24px', textAlign: 'center' }}
          >
            <WarningOutlined style={{ fontSize: 36, color: 'var(--ant-color-warning, #faad14)', marginBottom: 12 }} />
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('queries.detail.joinUnavailableTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('queries.detail.joinUnavailableHint')}</Typography.Text>
            <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Button type="primary" onClick={() => navigate(relsRoute)}>
                {t('queries.detail.openRelationships')}
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

  // ─── Composition unavailable (composition_cycle) — R76 ─────────────
  // A composed query whose base (transitively) builds back on itself: block the
  // run, point the user at the base query (flag, don't crash / don't recurse).
  if (cycle) {
    return (
      <>
        <PageHeader breadcrumb={BREADCRUMB} title={title} actions={actions} onNavigate={(r) => navigate(r)} />
        <PageCard>
          <div
            data-component="QueryDetailCompositionUnavailable"
            role="alert"
            style={{ padding: '40px 24px', textAlign: 'center' }}
          >
            <WarningOutlined style={{ fontSize: 36, color: 'var(--ant-color-warning, #faad14)', marginBottom: 12 }} />
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('queries.detail.cyclicTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t('queries.detail.cyclicHint', { base: baseQueryName })}
            </Typography.Text>
            <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
              {baseQueryId ? (
                <Button type="primary" onClick={() => navigate(`/data-management/queries/${baseQueryId}`)}>
                  {t('queries.detail.openBaseQuery')}
                </Button>
              ) : null}
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
  // R71 — a joined query's columns are its server-computed effective space
  // (left ++ right, collision-qualified); a single-source query uses its
  // source dataset's columns (unchanged).
  // R76 — a composed query's columns are its server-computed effective space
  // (the base's effective columns ++ any joined datasets), like a joined query.
  const columns = isJoined || isComposed ? [...(query.resolvedColumns ?? [])] : (dataset?.columns ?? []);
  const locale = i18n.language;
  const def = query.definition;

  // R76 — read-only "based on" composition summary (above the join summary).
  const compositionSummary = isComposed ? (
    <div
      data-component="QueryCompositionSummary"
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
      <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {t('queries.detail.composedLabel')}
      </Typography.Text>
      <Typography.Text>{baseQueryName}</Typography.Text>
      <Typography.Link
        onClick={() => navigate(`/data-management/queries/${baseQueryId}`)}
        data-component="QueryBaseSourceLink"
      >
        {t('queries.detail.openBaseQuery')} ↗
      </Typography.Link>
    </div>
  ) : null;

  // R71 — read-only join summary (above the predicate summary).
  const joinSummary =
    isJoined && relationship ? (
      <div
        data-component="QueryJoinSummary"
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
        <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {t('queries.detail.joinLabel')}
        </Typography.Text>
        <Typography.Text>
          {dataset?.name ?? relationship.leftSourceId} ⋈ {t(`queries.detail.joinType.${chain[0]?.type ?? 'inner'}`)} ⋈{' '}
          {rightDatasetQuery.data?.name ?? relationship.rightSourceId}
        </Typography.Text>
        <Tag color="default">
          {relationship.leftColumn} ↔ {relationship.rightColumn}
        </Tag>
        <Tag color="default">{t(`relationships.cardinality.${relationship.cardinality}`)}</Tag>
        {/* R73 — additional hops in a multi-hop chain (the 2nd onward); R75 — each
            hop names its join type so an outer hop isn't mislabelled as inner. */}
        {chain.slice(1).map((hop) => {
          const r = qrelById.get(hop.queryRelId);
          const cardinality = r ? t(`relationships.cardinality.${r.cardinality}`) : null;
          return (
            <Tag key={hop.queryRelId} color="default" data-component="QueryJoinHop">
              ⋈ {t(`queries.detail.joinType.${hop.type}`)} ⋈ {r ? `${r.leftColumn} ↔ ${r.rightColumn}` : hop.queryRelId}
              {cardinality ? ` · ${cardinality}` : ''}
            </Tag>
          );
        })}
      </div>
    ) : null;

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
      <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {t('queries.detail.appliedPredicates')}
      </Typography.Text>
      {def.q ? <Tag color="default">{t('queries.detail.searchTag', { q: def.q })}</Tag> : null}
      {def.filters.map((p) => (
        <Tag key={`f-${p.col}`} color="default">
          {formatChipText(p, columns, locale, t)}
        </Tag>
      ))}
      {def.advanced.length > 0 ? <Tag color="default">{groupsToText(def.advanced, columns)}</Tag> : null}
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
        actions={populatedActions}
        onNavigate={(r) => navigate(r)}
      />
      <PageCard variant="fill">
        {sourceLink ? (
          <div style={{ flex: '0 0 auto', marginBottom: 8 }}>
            <Typography.Text type="secondary">
              {t('queries.detail.sourceLabel')} {sourceLink}
            </Typography.Text>
          </div>
        ) : null}
        {editing ? (
          <QueryBuilderPanel builder={builder} />
        ) : (
          <>
            {compositionSummary}
            {joinSummary}
            {def.q || def.filters.length > 0 || def.advanced.length > 0 ? predicateTags : null}
            <div style={{ flex: '0 0 auto', marginBottom: 12 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {isJoined
                  ? t('queries.detail.matchedRows', { matched: total.toLocaleString(locale) })
                  : t('queries.detail.matchedOfTotal', {
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
          </>
        )}
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

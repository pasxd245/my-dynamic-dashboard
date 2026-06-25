// QueriesPage (R69) — the Queries catalog at /data-management/queries.
//
// A Query is its own archetype (own list home + URL) but REUSES the standard
// Page-List layout (PageHeader + PageCard + AntD <Table>) — not a duplicated
// DatasetsPage. Per-segment column config is the only feature-local part.
//
// The list API is workspace-scoped (GET /workspaces/{id}/queries); the "All"
// view fans out across workspaces with useQueries and flattens.

import { SearchOutlined, TableOutlined } from '@ant-design/icons';
import { PageCard, PageContainer, PageHeader } from '@mdd/ui';
import { useQueries } from '@tanstack/react-query';
import { Alert, Input, Select, Skeleton, Table, Typography } from 'antd';
import i18n from 'i18next';
import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { queriesApi } from '@/api/queriesApi';
import { useDatasetsQuery } from '@/features/data-management/datasets/hooks';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import type { Query } from './types';

const ALL_VALUE = '__all__';

function predicateSummary(q: Query, t: ReturnType<typeof useTranslation>['t']): string {
  const parts: string[] = [];
  const f = q.definition.filters.length;
  const a = q.definition.advanced.length;
  if (f > 0) parts.push(t('queries.list.predFilters', { count: f }));
  if (a > 0) parts.push(t('queries.list.predAdvanced', { count: a }));
  if (q.definition.q) parts.push(t('queries.list.predSearch'));
  return parts.length > 0 ? parts.join(' + ') : t('queries.list.predNone');
}

export function QueriesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceParam = searchParams.get('workspace') ?? undefined;
  const [nameQuery, setNameQuery] = useState('');

  const workspaces = useWorkspacesQuery();
  const datasets = useDatasetsQuery();
  const datasetById = useMemo(
    () => new Map((datasets.data ?? []).map((d) => [d.id, d.name])),
    [datasets.data],
  );
  const workspaceById = useMemo(
    () => new Map((workspaces.data ?? []).map((w) => [w.id, w.name])),
    [workspaces.data],
  );

  // The set of workspaces to query: one when filtered, all when "All".
  const wsIds = useMemo(() => {
    if (workspaceParam) return [workspaceParam];
    return (workspaces.data ?? []).map((w) => w.id);
  }, [workspaceParam, workspaces.data]);

  const queryResults = useQueries({
    queries: wsIds.map((wsId) => ({
      queryKey: ['queries', { workspaceId: wsId }] as const,
      queryFn: () => queriesApi.list(wsId),
    })),
  });

  const isLoading = workspaces.isLoading || queryResults.some((r) => r.isLoading);
  const isError = queryResults.some((r) => r.isError);
  const allQueries = useMemo(() => {
    const flat = queryResults.flatMap((r) => r.data ?? []);
    return [...flat].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [queryResults]);
  // R79 — a Query's source is the polymorphic `sourceId`: a `ds_` dataset or a
  // `qr_` base query. Resolve a base-query name from the loaded list.
  const queryNameById = useMemo(
    () => new Map(allQueries.map((q) => [q.id, q.name])),
    [allQueries],
  );

  const normalised = nameQuery.trim().toLowerCase();
  const visible =
    normalised.length === 0
      ? allQueries
      : allQueries.filter((q) => q.name.toLowerCase().includes(normalised));

  const onFilterChange = (value: string) => {
    if (value === ALL_VALUE) setSearchParams({});
    else setSearchParams({ workspace: value });
  };

  const BREADCRUMB = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dataManagement') },
    { label: t('nav.queries') },
  ];

  let body: React.ReactNode;
  if (isLoading) {
    body = <Skeleton active paragraph={{ rows: 8 }} data-component="QueriesLoading" />;
  } else if (isError) {
    body = (
      <Alert
        type="error"
        showIcon
        title={t('queries.list.loadCouldnt')}
        data-component="QueriesError"
      />
    );
  } else if (allQueries.length === 0) {
    body = (
      <div data-component="QueriesEmpty" style={{ padding: '40px 0', textAlign: 'center' }}>
        <TableOutlined style={{ fontSize: 48, opacity: 0.45 }} />
        <Typography.Title level={5} style={{ marginTop: 12, marginBottom: 4 }}>
          {t('queries.list.emptyTitle')}
        </Typography.Title>
        <Typography.Text type="secondary">
          <Trans
            i18nKey="queries.list.emptyHint"
            components={{
              link: <Typography.Link onClick={() => navigate('/data-management/datasets')} />,
            }}
          />
        </Typography.Text>
      </div>
    );
  } else if (visible.length === 0) {
    body = (
      <div data-component="QueriesNoMatch" style={{ padding: '32px 0', textAlign: 'center' }}>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
          {t('queries.list.noMatch', { query: nameQuery.trim() })}
        </Typography.Title>
        <Typography.Text type="secondary">
          <Trans
            i18nKey="queries.list.noMatchHint"
            components={{ link: <Typography.Link onClick={() => setNameQuery('')} /> }}
          />
        </Typography.Text>
      </div>
    );
  } else {
    body = (
      <Table
        size="middle"
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        dataSource={visible.map((q) => ({ ...q, key: q.id }))}
        rowKey="id"
        data-component="QueriesTable"
        onRow={(record) => ({
          onClick: () => navigate(`/data-management/queries/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          {
            title: t('queries.list.colName'),
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (name: string) => (
              <span data-component="QueryNameCell">
                <SearchOutlined style={{ marginRight: 6, opacity: 0.7 }} />
                <span style={{ fontWeight: 500 }}>{name}</span>
              </span>
            ),
          },
          {
            title: t('queries.list.colSource'),
            dataIndex: 'sourceId',
            key: 'sourceId',
            render: (sourceId: string) => {
              const isDataset = sourceId.startsWith('ds_');
              const name = (isDataset ? datasetById.get(sourceId) : queryNameById.get(sourceId)) ?? sourceId;
              const route = isDataset
                ? `/data-management/datasets/${sourceId}`
                : `/data-management/queries/${sourceId}`;
              return (
                <Typography.Link
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(route);
                  }}
                  data-component="QuerySourceLink"
                >
                  {name}
                </Typography.Link>
              );
            },
          },
          {
            title: t('queries.list.colWorkspace'),
            dataIndex: 'workspaceId',
            key: 'workspaceId',
            sorter: (a, b) =>
              (workspaceById.get(a.workspaceId) ?? '').localeCompare(
                workspaceById.get(b.workspaceId) ?? '',
              ),
            render: (workspaceId: string) => workspaceById.get(workspaceId) ?? workspaceId,
          },
          {
            title: t('queries.list.colPredicates'),
            key: 'predicates',
            render: (_v, row) => (
              <Typography.Text type="secondary">{predicateSummary(row, t)}</Typography.Text>
            ),
          },
          {
            title: t('queries.list.colSaved'),
            dataIndex: 'createdAt',
            key: 'createdAt',
            defaultSortOrder: 'descend',
            sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
            render: (iso: string) => new Date(iso).toLocaleDateString(i18n.language),
          },
        ]}
      />
    );
  }

  return (
    // R95 (D3): cap + center the list on wide screens (data width).
    <PageContainer width="data">
      <PageHeader
        breadcrumb={BREADCRUMB}
        title={t('queries.list.title')}
        subtitle={t('queries.list.subtitle')}
        onNavigate={(route) => navigate(route)}
      />
      <PageCard>
        <div
          style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
          data-component="QueriesFilterBar"
        >
          <div>
            <Typography.Text strong style={{ marginRight: 8 }}>
              {t('queries.list.workspaceLabel')}
            </Typography.Text>
            <Select
              value={workspaceParam ?? ALL_VALUE}
              onChange={onFilterChange}
              style={{ minWidth: 220 }}
              data-component="QueriesWorkspaceFilter"
              options={[
                { value: ALL_VALUE, label: t('queries.list.allWorkspaces') },
                ...(workspaces.data ?? []).map((w) => ({ value: w.id, label: w.name })),
              ]}
            />
          </div>
          <Input
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder={t('queries.list.searchPlaceholder')}
            prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
            allowClear
            style={{ maxWidth: 280, flex: '1 1 240px' }}
            data-component="QueriesSearch"
          />
        </div>
        {body}
      </PageCard>
    </PageContainer>
  );
}

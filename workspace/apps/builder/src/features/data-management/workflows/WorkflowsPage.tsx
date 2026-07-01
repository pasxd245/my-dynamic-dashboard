// WorkflowsPage (R137) — the Workflows catalog at /data-management/workflows.
//
// A Workflow is its own noun (own list home + URL), reusing the standard
// Page-List layout (PageHeader + PageCard + AntD <Table>) — the SAME shell the
// Queries catalog uses. The list API is workspace-scoped
// (GET /workspaces/{id}/workflows); the "All" view fans out with useQueries.

import { PlusOutlined, PartitionOutlined, SearchOutlined } from '@ant-design/icons';
import { PageCard, PageContainer, PageHeader } from '@mdd/ui';
import { useQueries } from '@tanstack/react-query';
import { Alert, Button, Input, Select, Skeleton, Table, Tag, Typography } from 'antd';
import i18n from 'i18next';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { workflowsApi } from '@/api/workflowsApi';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import type { Workflow } from './types';

const ALL_VALUE = '__all__';

export function WorkflowsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceParam = searchParams.get('workspace') ?? undefined;
  const [nameQuery, setNameQuery] = useState('');

  const workspaces = useWorkspacesQuery();
  const workspaceById = useMemo(
    () => new Map((workspaces.data ?? []).map((w) => [w.id, w.name])),
    [workspaces.data],
  );

  const wsIds = useMemo(() => {
    if (workspaceParam) return [workspaceParam];
    return (workspaces.data ?? []).map((w) => w.id);
  }, [workspaceParam, workspaces.data]);

  const results = useQueries({
    queries: wsIds.map((wsId) => ({
      queryKey: ['workflows', { workspaceId: wsId }] as const,
      queryFn: () => workflowsApi.list(wsId),
    })),
  });

  const isLoading = workspaces.isLoading || results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);
  const allWorkflows = useMemo(() => {
    const flat = results.flatMap((r) => r.data ?? []);
    return [...flat].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [results]);

  const normalised = nameQuery.trim().toLowerCase();
  const visible =
    normalised.length === 0
      ? allWorkflows
      : allWorkflows.filter((w) => w.name.toLowerCase().includes(normalised));

  const onFilterChange = (value: string) => {
    if (value === ALL_VALUE) setSearchParams({});
    else setSearchParams({ workspace: value });
  };

  const BREADCRUMB = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dataManagement') },
    { label: t('nav.workflows') },
  ];

  const newButton = (
    <Button
      type="primary"
      icon={<PlusOutlined />}
      onClick={() => navigate(`/data-management/workflows/new${workspaceParam ? `?workspace=${workspaceParam}` : ''}`)}
      data-component="WorkflowsNew"
    >
      {t('workflows.list.newWorkflow')}
    </Button>
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = <Skeleton active paragraph={{ rows: 8 }} data-component="WorkflowsLoading" />;
  } else if (isError) {
    body = <Alert type="error" showIcon message={t('workflows.list.loadCouldnt')} data-component="WorkflowsError" />;
  } else if (allWorkflows.length === 0) {
    body = (
      <div data-component="WorkflowsEmpty" style={{ padding: '40px 0', textAlign: 'center' }}>
        <PartitionOutlined style={{ fontSize: 48, opacity: 0.45 }} />
        <Typography.Title level={5} style={{ marginTop: 12, marginBottom: 4 }}>
          {t('workflows.list.emptyTitle')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('workflows.list.emptyHint')}</Typography.Text>
      </div>
    );
  } else if (visible.length === 0) {
    body = (
      <div data-component="WorkflowsNoMatch" style={{ padding: '32px 0', textAlign: 'center' }}>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
          {t('workflows.list.noMatch', { query: nameQuery.trim() })}
        </Typography.Title>
      </div>
    );
  } else {
    body = (
      <Table
        size="middle"
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        dataSource={visible.map((w) => ({ ...w, key: w.id }))}
        rowKey="id"
        data-component="WorkflowsTable"
        onRow={(record) => ({
          onClick: () => navigate(`/data-management/workflows/${record.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          {
            title: t('workflows.list.colName'),
            dataIndex: 'name',
            key: 'name',
            sorter: (a: Workflow, b: Workflow) => a.name.localeCompare(b.name),
            render: (name: string) => (
              <span data-component="WorkflowNameCell">
                <PartitionOutlined style={{ marginRight: 6, opacity: 0.7 }} />
                <span style={{ fontWeight: 500 }}>{name}</span>
              </span>
            ),
          },
          {
            title: t('workflows.list.colSources'),
            key: 'sources',
            render: (_v, row: Workflow) => row.definition.sources.length,
          },
          {
            title: t('workflows.list.colSteps'),
            key: 'steps',
            render: (_v, row: Workflow) => row.definition.steps?.length ?? 0,
          },
          {
            title: t('workflows.list.colWorkspace'),
            dataIndex: 'workspaceId',
            key: 'workspaceId',
            render: (workspaceId: string) => workspaceById.get(workspaceId) ?? workspaceId,
          },
          {
            title: t('workflows.list.colLastRun'),
            dataIndex: 'materializedAt',
            key: 'materializedAt',
            render: (iso: string | undefined) =>
              iso ? (
                new Date(iso).toLocaleString(i18n.language)
              ) : (
                <Tag color="default">{t('workflows.list.neverRun')}</Tag>
              ),
          },
        ]}
      />
    );
  }

  return (
    <PageContainer width="data">
      <PageHeader
        breadcrumb={BREADCRUMB}
        title={t('workflows.list.title')}
        subtitle={t('workflows.list.subtitle')}
        actions={newButton}
        onNavigate={(route) => navigate(route)}
      />
      <PageCard>
        <div
          style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
          data-component="WorkflowsFilterBar"
        >
          <div>
            <Typography.Text strong style={{ marginRight: 8 }}>
              {t('workflows.list.workspaceLabel')}
            </Typography.Text>
            <Select
              value={workspaceParam ?? ALL_VALUE}
              onChange={onFilterChange}
              style={{ minWidth: 220 }}
              data-component="WorkflowsWorkspaceFilter"
              options={[
                { value: ALL_VALUE, label: t('workflows.list.allWorkspaces') },
                ...(workspaces.data ?? []).map((w) => ({ value: w.id, label: w.name })),
              ]}
            />
          </div>
          <Input
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder={t('workflows.list.searchPlaceholder')}
            prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
            allowClear
            style={{ maxWidth: 280, flex: '1 1 240px' }}
            data-component="WorkflowsSearch"
          />
        </div>
        {body}
      </PageCard>
    </PageContainer>
  );
}

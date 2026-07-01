// WorkflowDetailPage (R137) — workflow detail + output at
// /data-management/workflows/:id. Shows the definition summary + a [Run] that
// MATERIALIZES the output, then pages the frozen result via <PagedRowsView>
// (the same shell query/dataset detail use). No live preview — Run is explicit
// (the frozen-output model). 409 query_stale / composition_cycle surface as a
// re-run-blocked message (a source drifted or wasn't run yet).

import { ArrowLeftOutlined, PartitionOutlined, PlayCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { PageCard, PageContainer, PageHeader } from '@mdd/ui';
import { App, Button, Skeleton, Tag, Typography } from 'antd';
import i18n from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '@/_generated/constants';
import { ApiErrorThrown } from '../_shared/types';
import { DeleteConfirmModal } from '../_shared/DeleteConfirmModal';
import { PagedRowsView } from '../_shared/PagedRowsView';
import { useDeleteWorkflowMutation, useRunWorkflowMutation, useWorkflowQuery, useWorkflowRowsQuery } from './hooks';

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

export function WorkflowDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = App.useApp();

  const page = clampPage(searchParams.get('page'));
  const pageSize = clampPageSize(searchParams.get('page_size'));

  const workflowQuery = useWorkflowQuery(id);
  const workflow = workflowQuery.data;
  const materialized = Boolean(workflow?.materializedAt);
  const rowsQuery = useWorkflowRowsQuery(id, page, pageSize, materialized);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const runMutation = useRunWorkflowMutation();
  const deleteMutation = useDeleteWorkflowMutation();

  const notFound = isNotFound(workflowQuery.error);

  const BREADCRUMB = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dataManagement'), route: '/data-management/workspaces' },
    { label: t('nav.workflows'), route: '/data-management/workflows' },
    { label: workflow?.name ?? '…' },
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

  const run = () => {
    if (!workflow) return;
    runMutation.mutate(workflow.id, {
      onSuccess: () => message.success(t('workflows.detail.runSuccess')),
      onError: (err) => {
        if (err instanceof ApiErrorThrown && err.body.code === 'composition_cycle') {
          message.error(t('workflows.detail.runCycle'));
        } else if (err instanceof ApiErrorThrown && err.body.code === 'query_stale') {
          message.error(t('workflows.detail.runStale'));
        } else {
          message.error(t('workflows.detail.runFailed'));
        }
      },
    });
  };

  const confirmDelete = () => {
    if (!workflow) return;
    deleteMutation.mutate(workflow.id, {
      onSuccess: () => {
        message.success(t('workflows.detail.deleteSuccess', { name: workflow.name }));
        navigate('/data-management/workflows', { replace: true });
      },
    });
  };

  // ─── 404 ───────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <>
        <PageHeader
          breadcrumb={[...BREADCRUMB.slice(0, 3), { label: '?' }]}
          title={t('workflows.detail.notFoundTitle')}
          onNavigate={(r) => navigate(r)}
        />
        <PageCard>
          <div data-component="WorkflowDetailNotFound" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <PartitionOutlined style={{ fontSize: 36, opacity: 0.45, marginBottom: 12 }} />
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('workflows.detail.notFoundTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('workflows.detail.notFoundHint')}</Typography.Text>
            <div style={{ marginTop: 20 }}>
              <Button
                type="primary"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/data-management/workflows')}
              >
                {t('workflows.detail.backToWorkflows')}
              </Button>
            </div>
          </div>
        </PageCard>
      </>
    );
  }

  // ─── Loading ───────────────────────────────────────────────────────
  if (!workflow) {
    return (
      <>
        <PageHeader breadcrumb={BREADCRUMB} title={t('workflows.detail.loadingTitle')} onNavigate={(r) => navigate(r)} />
        <PageCard>
          <Skeleton active paragraph={{ rows: 8 }} data-component="WorkflowDetailLoading" />
        </PageCard>
      </>
    );
  }

  const locale = i18n.language;
  const columns = [...(workflow.resolvedColumns ?? [])];
  const total = rowsQuery.data?.total ?? 0;

  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span>{workflow.name}</span>
      {materialized ? (
        <Tag color="processing">{t('workflows.detail.badgeMaterialized')}</Tag>
      ) : (
        <Tag color="default">{t('workflows.detail.badgeNeverRun')}</Tag>
      )}
    </span>
  );

  const actions = (
    <span style={{ display: 'inline-flex', gap: 8 }}>
      <Button
        type="primary"
        icon={<PlayCircleOutlined />}
        onClick={run}
        loading={runMutation.isPending}
        data-component="WorkflowRun"
      >
        {materialized ? t('workflows.detail.rerun') : t('workflows.detail.run')}
      </Button>
      <Button danger onClick={() => setDeleteOpen(true)} data-component="WorkflowDetailDelete">
        {t('common.delete')}
      </Button>
    </span>
  );

  const summary = (
    <div
      data-component="WorkflowSummary"
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
        {t('workflows.detail.definitionLabel')}
      </Typography.Text>
      <Tag color="default">{t('workflows.detail.sourcesCount', { count: workflow.definition.sources.length })}</Tag>
      <Tag color="default">{t('workflows.detail.stepsCount', { count: workflow.definition.steps?.length ?? 0 })}</Tag>
      {workflow.materializedAt ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('workflows.detail.materializedAt', { at: new Date(workflow.materializedAt).toLocaleString(locale) })}
        </Typography.Text>
      ) : null}
    </div>
  );

  return (
    <PageContainer fill="bounded" width="data" dataComponent="WorkflowDetailPage">
      <PageHeader
        breadcrumb={BREADCRUMB}
        title={title}
        subtitle={t('workflows.detail.subtitle')}
        actions={actions}
        onNavigate={(r) => navigate(r)}
      />
      <PageCard variant="fill">
        {summary}
        {materialized ? (
          <PagedRowsView
            columns={columns}
            rows={rowsQuery.data?.rows}
            loading={rowsQuery.isFetching}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            emptyState={
              <>
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  {t('workflows.detail.zeroRowsTitle')}
                </Typography.Title>
                <Typography.Text type="secondary">{t('workflows.detail.zeroRowsHint')}</Typography.Text>
              </>
            }
          />
        ) : (
          <div data-component="WorkflowNeverRun" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <WarningOutlined style={{ fontSize: 36, color: 'var(--ant-color-warning, #faad14)', marginBottom: 12 }} />
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('workflows.detail.neverRunTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('workflows.detail.neverRunHint')}</Typography.Text>
            <div style={{ marginTop: 20 }}>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={run}
                loading={runMutation.isPending}
                data-component="WorkflowNeverRunRun"
              >
                {t('workflows.detail.run')}
              </Button>
            </div>
          </div>
        )}
      </PageCard>
      <DeleteConfirmModal
        resourceLabel="workflow"
        resourceName={workflow.name}
        open={deleteOpen}
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => !deleteMutation.isPending && setDeleteOpen(false)}
      />
    </PageContainer>
  );
}

// WorkspaceRelationshipsPage (R70) — the workspace-scoped relationship
// governance view at /data-management/workspaces/:id/relationships.
//
// A Relationship is a governed EDGE, not a table-source — but this view REUSES
// the standard Page-List layout (PageHeader + PageCard + AntD <Table>), not a
// duplicated DatasetsPage. Reached from the workspace card (J-1). Governance
// only: declare / list / delete + the computed valid|stale status. No joined
// rows (that is the Query Builder, R71).

import { DeleteOutlined, PlusOutlined, WarningFilled } from '@ant-design/icons';
import { PageCard, PageHeader } from '@mdd/ui';
import { App, Alert, Button, Empty, Skeleton, Table, Tag, Tooltip, Typography, theme } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { useDatasetsQuery } from '@/features/data-management/datasets/hooks';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import { DeleteConfirmModal } from '../_shared/DeleteConfirmModal';
import { ApiErrorThrown } from '../_shared/types';
import { DeclareRelationshipModal } from './DeclareRelationshipModal';
import { useCreateRelationshipMutation, useDeleteRelationshipMutation, useRelationshipsQuery } from './hooks';
import type { CreateRelationshipRequest, Relationship } from './types';

export function WorkspaceRelationshipsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { id: workspaceId } = useParams<{ id: string }>();

  const workspaces = useWorkspacesQuery();
  const datasets = useDatasetsQuery(workspaceId);
  const relationships = useRelationshipsQuery(workspaceId);
  const createMutation = useCreateRelationshipMutation();
  const deleteMutation = useDeleteRelationshipMutation();

  const [declareOpen, setDeclareOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Relationship | null>(null);

  const workspaceName = useMemo(
    () => workspaces.data?.find((w) => w.id === workspaceId)?.name,
    [workspaces.data, workspaceId],
  );
  const datasetById = useMemo(
    () => new Map((datasets.data ?? []).map((d) => [d.id, d.name])),
    [datasets.data],
  );
  const dsName = (id: string) => datasetById.get(id) ?? id;

  const BREADCRUMB = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dataManagement') },
    { label: t('nav.workspaces'), route: '/data-management/workspaces' },
    { label: workspaceName ?? t('nav.relationships') },
    { label: t('nav.relationships') },
  ];

  const onDeclare = (body: CreateRelationshipRequest) => {
    if (!workspaceId) return;
    createMutation.mutate(
      { workspaceId, body },
      {
        onSuccess: () => {
          message.success(t('relationships.declare.success'));
          setDeclareOpen(false);
        },
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        message.success(t('relationships.delete.success'));
        setDeleteTarget(null);
      },
    });
  };

  const rels = relationships.data ?? [];
  const showActions = !relationships.isLoading && !relationships.isError;

  let body: React.ReactNode;
  if (relationships.isLoading) {
    body = <Skeleton active paragraph={{ rows: 6 }} data-component="RelationshipsLoading" />;
  } else if (relationships.isError) {
    body = (
      <Alert type="error" showIcon title={t('relationships.list.loadCouldnt')} data-component="RelationshipsError" />
    );
  } else if (rels.length === 0) {
    body = (
      <Empty
        description={
          <>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
              {t('relationships.list.emptyTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('relationships.list.emptyHint')}</Typography.Text>
          </>
        }
        style={{ padding: '48px 0' }}
        data-component="RelationshipsEmpty"
      >
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDeclareOpen(true)}>
          {t('relationships.list.declareAction')}
        </Button>
      </Empty>
    );
  } else {
    body = (
      <Table
        size="middle"
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        dataSource={rels.map((r) => ({ ...r, key: r.id }))}
        rowKey="id"
        data-component="RelationshipsTable"
        columns={[
          {
            title: t('relationships.list.colLeft'),
            dataIndex: 'leftDatasetId',
            key: 'left',
            render: (id: string) => dsName(id),
          },
          {
            title: t('relationships.list.colRight'),
            dataIndex: 'rightDatasetId',
            key: 'right',
            render: (id: string) => dsName(id),
          },
          {
            title: t('relationships.list.colKeys'),
            key: 'keys',
            render: (_v, r) => (
              <Typography.Text code data-component="RelationshipKeys">
                {r.leftColumn} ↔ {r.rightColumn}
              </Typography.Text>
            ),
          },
          {
            title: t('relationships.list.colCardinality'),
            dataIndex: 'cardinality',
            key: 'cardinality',
            render: (c: Relationship['cardinality']) => <Tag>{t(`relationships.cardinality.${c}`)}</Tag>,
          },
          {
            title: t('relationships.list.colStatus'),
            dataIndex: 'status',
            key: 'status',
            render: (status: Relationship['status']) =>
              status === 'stale' ? (
                <Tooltip title={t('relationships.list.staleHint')}>
                  <Tag icon={<WarningFilled />} color="warning" data-component="RelationshipStaleTag">
                    {t('relationships.status.stale')}
                  </Tag>
                </Tooltip>
              ) : (
                <Tag color="success" data-component="RelationshipValidTag">
                  {t('relationships.status.valid')}
                </Tag>
              ),
          },
          {
            title: '',
            key: 'actions',
            width: 48,
            render: (_v, r) => (
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setDeleteTarget(r)}
                aria-label={t('common.actionsForResource', {
                  resource: t('resources.relationship'),
                  name: `${r.leftColumn} ↔ ${r.rightColumn}`,
                })}
                data-component="RelationshipDeleteButton"
              />
            ),
          },
        ]}
      />
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={BREADCRUMB}
        title={t('relationships.list.title')}
        subtitle={t('relationships.list.subtitle')}
        onNavigate={(route) => navigate(route)}
        actions={
          showActions ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setDeclareOpen(true)}
              data-component="DeclareRelationshipAction"
            >
              {t('relationships.list.declareAction')}
            </Button>
          ) : undefined
        }
      />
      <PageCard>{body}</PageCard>

      <DeclareRelationshipModal
        open={declareOpen}
        datasets={datasets.data ?? []}
        isPending={createMutation.isPending}
        error={createMutation.error}
        onSubmit={onDeclare}
        onClose={() => {
          if (createMutation.isPending) return;
          createMutation.reset();
          setDeclareOpen(false);
        }}
      />
      <DeleteConfirmModal
        resourceLabel="relationship"
        resourceName={deleteTarget ? `${deleteTarget.leftColumn} ↔ ${deleteTarget.rightColumn}` : ''}
        open={deleteTarget !== null}
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={() => {
          if (deleteMutation.isPending) return;
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

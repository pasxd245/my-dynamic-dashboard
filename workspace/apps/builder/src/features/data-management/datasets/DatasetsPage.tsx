import {
  DeleteOutlined,
  EditOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  InboxOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { PageCard, PageContainer, PageHeader } from '@mdd/ui';
import { Alert, App, Button, Dropdown, Empty, Input, Select, Skeleton, Table, Typography } from 'antd';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { NAME_LENGTHS } from '@/_generated/constants';
import { appConfig } from '@/config';
import { formatBytes, formatBytesCoarse } from '@/lib/formatBytes';
import { DeleteConfirmModal } from '../_shared/DeleteConfirmModal';
import { RenameModal } from '../_shared/RenameModal';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import { useDatasetsQuery, useDeleteDatasetMutation, useRenameDatasetMutation } from './hooks';
import type { Dataset } from './types';

type ModalState = { kind: 'idle' } | { kind: 'rename'; target: Dataset } | { kind: 'delete'; target: Dataset };

const ALL_VALUE = '__all__';

export function DatasetsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaceParam = searchParams.get('workspace') ?? undefined;
  const { message } = App.useApp();
  const BREADCRUMB = [
    { label: t('nav.home'), route: '/' },
    { label: t('nav.dataManagement') },
    { label: t('nav.datasets') },
  ];

  const datasets = useDatasetsQuery(workspaceParam);
  const workspaces = useWorkspacesQuery();
  const workspaceById = new Map((workspaces.data ?? []).map((w) => [w.id, w.name]));

  const [query, setQuery] = useState('');
  const [modalState, setModalState] = useState<ModalState>({ kind: 'idle' });
  const renameMutation = useRenameDatasetMutation();
  const deleteMutation = useDeleteDatasetMutation();

  const onRename = (ds: Dataset) => {
    renameMutation.reset();
    setModalState({ kind: 'rename', target: ds });
  };
  const onDelete = (ds: Dataset) => {
    deleteMutation.reset();
    setModalState({ kind: 'delete', target: ds });
  };
  const closeModal = () => {
    if (renameMutation.isPending || deleteMutation.isPending) return;
    setModalState({ kind: 'idle' });
    renameMutation.reset();
    deleteMutation.reset();
  };
  const submitRename = (newName: string) => {
    if (modalState.kind !== 'rename') return;
    const target = modalState.target;
    renameMutation.mutate(
      { id: target.id, name: newName },
      {
        onSuccess: () => {
          message.success(t('datasets.renameSuccess', { name: newName }));
          setModalState({ kind: 'idle' });
        },
      },
    );
  };
  const confirmDelete = () => {
    if (modalState.kind !== 'delete') return;
    const target = modalState.target;
    deleteMutation.mutate(target.id, {
      onSuccess: () => {
        message.success(t('datasets.deleteSuccess', { name: target.name }));
        setModalState({ kind: 'idle' });
      },
    });
  };
  const normalisedQuery = query.trim().toLowerCase();
  const allRows = datasets.data ?? [];
  const visibleRows =
    normalisedQuery.length === 0 ? allRows : allRows.filter((r) => r.name.toLowerCase().includes(normalisedQuery));

  const onFilterChange = (value: string) => {
    if (value === ALL_VALUE) {
      setSearchParams({});
    } else {
      setSearchParams({ workspace: value });
    }
  };

  const goNew = () => {
    const target = workspaceParam
      ? `/data-management/datasets/new?workspace=${encodeURIComponent(workspaceParam)}`
      : '/data-management/datasets/new';
    navigate(target);
  };

  const header = (
    <PageHeader
      breadcrumb={BREADCRUMB}
      title={t('datasets.title')}
      subtitle={t('datasets.subtitle')}
      onNavigate={(route) => navigate(route)}
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={goNew}>
          {t('datasets.upload')}
        </Button>
      }
    />
  );

  let body: React.ReactNode;
  if (datasets.isLoading || workspaces.isLoading) {
    // R31: 8-row skeleton pre-allocates roughly the height of a
    // typical loaded table (header + ~8 rows above the fold) so
    // the layout doesn't jump when data arrives.
    body = <Skeleton active paragraph={{ rows: 8 }} data-component="DatasetsLoading" />;
  } else if (datasets.isError) {
    body = (
      <Alert
        type="error"
        showIcon
        title={t('datasets.loadCouldnt')}
        description={datasets.error?.message ?? t('common.unknownError')}
        data-component="DatasetsError"
      />
    );
  } else if (allRows.length === 0) {
    body = <DatasetsEmpty onClick={goNew} hasWorkspaceFilter={!!workspaceParam} />;
  } else if (visibleRows.length === 0) {
    body = (
      <div data-component="DatasetsNoMatch" style={{ padding: '32px 0', textAlign: 'center' }}>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
          {t('datasets.noMatch', { query: query.trim() })}
        </Typography.Title>
        <Typography.Text type="secondary">
          <Trans
            i18nKey="datasets.noMatchHint"
            components={{ link: <Typography.Link onClick={() => setQuery('')} /> }}
          />
        </Typography.Text>
      </div>
    );
  } else {
    body = (
      <DatasetTable
        rows={visibleRows}
        workspaceById={workspaceById}
        onWorkspaceClick={(id) => setSearchParams({ workspace: id })}
        onRename={onRename}
        onDelete={onDelete}
        onRowClick={(ds) => navigate(`/data-management/datasets/${ds.id}`)}
      />
    );
  }

  return (
    // R95 (D3): cap + center the list on wide screens (data width).
    <PageContainer width="data">
      {header}
      <PageCard>
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
          data-component="DatasetsFilterBar"
        >
          <div>
            <Typography.Text strong style={{ marginRight: 8 }}>
              {t('datasets.workspaceLabel')}
            </Typography.Text>
            <Select
              value={workspaceParam ?? ALL_VALUE}
              onChange={onFilterChange}
              style={{ minWidth: 220 }}
              data-component="WorkspaceFilter"
              options={[
                { value: ALL_VALUE, label: t('datasets.allWorkspaces') },
                ...(workspaces.data ?? []).map((w) => ({
                  value: w.id,
                  label: w.name,
                })),
              ]}
            />
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('datasets.searchPlaceholder')}
            prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
            allowClear
            style={{ maxWidth: 280, flex: '1 1 240px' }}
            data-component="DatasetsSearch"
          />
        </div>
        {body}
      </PageCard>
      <RenameModal
        resourceLabel="dataset"
        maxLength={NAME_LENGTHS.DATASET_MAX}
        currentName={modalState.kind === 'rename' ? modalState.target.name : ''}
        open={modalState.kind === 'rename'}
        isPending={renameMutation.isPending}
        error={renameMutation.error}
        onSubmit={submitRename}
        onClose={closeModal}
      />
      <DeleteConfirmModal
        resourceLabel="dataset"
        resourceName={modalState.kind === 'delete' ? modalState.target.name : ''}
        open={modalState.kind === 'delete'}
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={closeModal}
      />
    </PageContainer>
  );
}

type EmptyProps = Readonly<{
  onClick: () => void;
  hasWorkspaceFilter: boolean;
}>;

// Standard empty state (matches Workspaces / the dashboard catalog): an Empty
// with an icon + a primary CTA that launches the upload wizard. (Replaced the
// old fake "dropzone" — a dashed zone that advertised drag-and-drop but never
// handled a drop; the real drag-drop lives in the upload wizard's source step.)
function DatasetsEmpty({ onClick, hasWorkspaceFilter }: EmptyProps) {
  const { t } = useTranslation();
  return (
    <Empty
      image={
        hasWorkspaceFilter ? (
          <TableOutlined style={{ fontSize: 48, opacity: 0.4 }} />
        ) : (
          <InboxOutlined style={{ fontSize: 48, opacity: 0.4 }} />
        )
      }
      styles={{ image: { height: 80, display: 'flex', justifyContent: 'center', alignItems: 'center' } }}
      description={
        <>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
            {hasWorkspaceFilter ? t('datasets.emptyTitleFiltered') : t('datasets.emptyTitle')}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('datasets.emptyHint', { maxSize: formatBytesCoarse(appConfig.uploadMaxBytes()) })}
          </Typography.Text>
        </>
      }
      style={{ padding: '48px 0' }}
      data-component="DatasetsEmpty"
    >
      <Button type="primary" icon={<PlusOutlined />} size="large" onClick={onClick}>
        {t('datasets.uploadFirst')}
      </Button>
    </Empty>
  );
}

type TableProps = Readonly<{
  rows: Dataset[];
  workspaceById: Map<string, string>;
  onWorkspaceClick: (id: string) => void;
  onRename: (ds: Dataset) => void;
  onDelete: (ds: Dataset) => void;
  /** R36: row click opens the dataset detail page. */
  onRowClick: (ds: Dataset) => void;
}>;

function DatasetTable({ rows, workspaceById, onWorkspaceClick, onRename, onDelete, onRowClick }: TableProps) {
  const { t } = useTranslation();
  const data = rows.map((r) => ({ ...r, key: r.id }));
  return (
    <Table
      size="middle"
      pagination={{ pageSize: 20, hideOnSinglePage: true }}
      dataSource={data}
      onRow={(record) => ({
        onClick: () => onRowClick(record),
        style: { cursor: 'pointer' },
      })}
      rowKey="id"
      data-component="DatasetTable"
      columns={[
        {
          title: t('datasets.table.uploaded'),
          dataIndex: 'createdAt',
          key: 'createdAt',
          render: (iso: string) => relativeTime(iso, t),
          sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
          defaultSortOrder: 'descend',
        },
        {
          title: t('datasets.table.name'),
          dataIndex: 'name',
          key: 'name',
          sorter: (a, b) => a.name.localeCompare(b.name),
          render: (name: string, row) => (
            <span data-component="DatasetNameCell">
              <SourceIcon
                format={row.sourceFormat}
                sheetName={row.sheetName}
                style={{ marginRight: 6, opacity: 0.85 }}
              />
              <span style={{ fontWeight: 500 }}>{name}</span>
              {row.sheetName ? (
                <Typography.Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
                  · {row.sheetName}
                </Typography.Text>
              ) : null}
            </span>
          ),
        },
        {
          title: t('datasets.table.workspace'),
          dataIndex: 'workspaceId',
          key: 'workspaceId',
          render: (id: string) => {
            const name = workspaceById.get(id) ?? id;
            return (
              <Typography.Link
                onClick={(e) => {
                  e.stopPropagation();
                  onWorkspaceClick(id);
                }}
                data-component="DatasetWorkspaceLink"
              >
                {name}
              </Typography.Link>
            );
          },
        },
        {
          title: t('datasets.table.rows'),
          dataIndex: 'rowCount',
          key: 'rowCount',
          align: 'right',
          sorter: (a, b) => a.rowCount - b.rowCount,
          render: (n: number) => n.toLocaleString(),
        },
        {
          title: t('datasets.table.cols'),
          dataIndex: 'columnCount',
          key: 'columnCount',
          align: 'right',
        },
        {
          title: t('datasets.table.size'),
          dataIndex: 'sizeBytes',
          key: 'sizeBytes',
          align: 'right',
          render: formatBytes,
          sorter: (a, b) => a.sizeBytes - b.sizeBytes,
        },
        {
          title: '',
          key: 'actions',
          width: 48,
          align: 'center',
          render: (_v, row) => (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'rename',
                    icon: <EditOutlined />,
                    label: t('common.rename'),
                    onClick: ({ domEvent }) => {
                      domEvent.stopPropagation();
                      onRename(row);
                    },
                  },
                  {
                    key: 'delete',
                    icon: <DeleteOutlined />,
                    label: t('common.delete'),
                    danger: true,
                    onClick: ({ domEvent }) => {
                      domEvent.stopPropagation();
                      onDelete(row);
                    },
                  },
                ],
              }}
              trigger={['click']}
            >
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                onClick={(e) => e.stopPropagation()}
                aria-label={t('common.actionsForResource', {
                  resource: t('resources.dataset'),
                  name: row.name,
                })}
                data-component="DatasetRowMoreButton"
              />
            </Dropdown>
          ),
        },
      ]}
    />
  );
}

type SourceIconProps = Readonly<{
  format: Dataset['sourceFormat'];
  sheetName?: string | null;
  style?: React.CSSProperties;
}>;

function SourceIcon({ format, sheetName, style }: SourceIconProps) {
  const title = format === 'excel' ? `Excel${sheetName ? ` · ${sheetName}` : ''}` : 'CSV';
  if (format === 'excel') {
    return (
      <FileExcelOutlined
        title={title}
        style={{ color: '#117a3a', ...style }}
        data-component="DatasetSourceIcon"
        data-format="excel"
      />
    );
  }
  return (
    <FileTextOutlined
      title={title}
      style={{ color: '#1677ff', ...style }}
      data-component="DatasetSourceIcon"
      data-format="csv"
    />
  );
}


type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function relativeTime(iso: string, t: TFunc): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso.slice(0, 10);
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return t('datasets.relativeTime.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('datasets.relativeTime.minutesAgo', { count: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (then >= startOfToday.getTime()) {
    return new Date(then).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const startOfYesterday = startOfToday.getTime() - 24 * 60 * 60 * 1000;
  if (then >= startOfYesterday) return t('datasets.relativeTime.yesterday');
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return t('datasets.relativeTime.daysAgo', { count: diffDay });
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 5) return t('datasets.relativeTime.weekAgo', { count: diffWk });
  return iso.slice(0, 10);
}

import {
  ArrowLeftOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  FileExcelOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { PageCard, PageHeader } from '@mdd/ui';
import { Alert, App, Button, Dropdown, Input, Pagination, Skeleton, Tag, Typography } from 'antd';
import i18n from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { NAME_LENGTHS } from '@/_generated/constants';
import { formatBytes } from '@/lib/formatBytes';
import { formatCell } from '@/lib/formatCell';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import { ApiErrorThrown } from '../_shared/types';
import { DeleteConfirmModal } from '../_shared/DeleteConfirmModal';
import { RenameModal } from '../_shared/RenameModal';
import {
  useDatasetQuery,
  useDatasetRowsQuery,
  useDeleteDatasetMutation,
  useRenameDatasetMutation,
} from './hooks';
import { ActiveFilterChips } from './filters/ActiveFilterChips';
import { FilterPopover } from './filters/FilterPopover';
import { useFiltersState } from './filters/useFiltersState';
import { AdvancedQueryInput } from './advanced-query/AdvancedQueryInput';
import { useAdvancedQueryState } from './advanced-query/useAdvancedQueryState';
import type { Column, Dataset } from './types';

const DEFAULT_PAGE_SIZE = 50;
const ALLOWED_PAGE_SIZES = [25, 50, 100] as const;
const DEBOUNCE_MS = 300;

function clampPageSize(raw: string | null): number {
  const n = Number(raw);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

function clampPage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function relativeTime(iso: string, t: ReturnType<typeof useTranslation>['t']): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const minutes = Math.round((now - then) / 60_000);
  if (minutes < 1) return t('datasets.relativeTime.justNow');
  if (minutes < 60) return t('datasets.relativeTime.minutesAgo', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const days = Math.round(hours / 24);
  if (days === 1) return t('datasets.relativeTime.yesterday');
  if (days < 7) return t('datasets.relativeTime.daysAgo', { count: days });
  const weeks = Math.round(days / 7);
  return t('datasets.relativeTime.weekAgo', { count: weeks });
}

function isNotFound(err: unknown): boolean {
  return err instanceof ApiErrorThrown && err.body.code === 'not_found';
}

function DtypeBadge({ dtype }: { dtype: Column['dtype'] }) {
  const { t } = useTranslation();
  return (
    <Tag
      style={{ marginInlineStart: 6, fontSize: 10, padding: '0 6px', lineHeight: '16px' }}
      data-component="DtypeBadge"
      data-dtype={dtype}
    >
      {t(`datasets.detail.dtype.${dtype}`)}
    </Tag>
  );
}

function SourceIcon({ format }: { format: Dataset['sourceFormat'] }) {
  if (format === 'excel') {
    return <FileExcelOutlined style={{ color: '#117a3a' }} />;
  }
  return <FileTextOutlined style={{ color: '#1677ff' }} />;
}

export function DatasetDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = App.useApp();

  const page = clampPage(searchParams.get('page'));
  const pageSize = clampPageSize(searchParams.get('page_size'));
  const qParam = searchParams.get('q') ?? '';

  // Local input state for debounced URL sync. The URL is the source of
  // truth for the query; this is just the typing buffer.
  const [searchInput, setSearchInput] = useState(qParam);
  const debounceRef = useRef<number | undefined>(undefined);

  // Keep the input in sync with URL changes that come from outside (e.g.
  // Clear button, back/forward, deep-link entry).
  useEffect(() => {
    setSearchInput(qParam);
  }, [qParam]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== undefined) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const onSearchChange = (next: string) => {
    setSearchInput(next);
    if (debounceRef.current !== undefined) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      const trimmed = next.trim();
      if (trimmed.length === 0) {
        params.delete('q');
      } else {
        params.set('q', trimmed);
      }
      params.delete('page'); // q-change resets to page 1
      setSearchParams(params, { replace: true });
    }, DEBOUNCE_MS);
  };

  const onClearSearch = () => {
    if (debounceRef.current !== undefined) {
      window.clearTimeout(debounceRef.current);
    }
    setSearchInput('');
    const params = new URLSearchParams(searchParams);
    params.delete('q');
    params.delete('page');
    setSearchParams(params, { replace: true });
  };

  const datasetQuery = useDatasetQuery(id);
  const datasetColumns = useMemo<Column[]>(
    () => datasetQuery.data?.columns ?? [],
    [datasetQuery.data?.columns],
  );
  const { filters, applyFilter, removeFilter, clearAll } = useFiltersState(datasetColumns);
  const {
    groups: advancedGroups,
    text: advancedText,
    applyAdvanced,
    clearAdvanced,
  } = useAdvancedQueryState(datasetColumns);
  const rowsQuery = useDatasetRowsQuery(
    id,
    page,
    pageSize,
    qParam.length > 0 ? qParam : undefined,
    filters,
    advancedGroups,
  );
  const workspacesQuery = useWorkspacesQuery();

  const dataset = datasetQuery.data;
  const rowsPage = rowsQuery.data;
  const queryNotFound = isNotFound(datasetQuery.error) || isNotFound(rowsQuery.error);
  const workspaceName = useMemo(() => {
    if (!dataset || !workspacesQuery.data) return undefined;
    return workspacesQuery.data.find((w) => w.id === dataset.workspaceId)?.name;
  }, [dataset, workspacesQuery.data]);

  // Rename / delete modal state — same pattern as DatasetsPage.
  type ModalState = { kind: 'idle' } | { kind: 'rename' } | { kind: 'delete' };
  const [modalState, setModalState] = useState<ModalState>({ kind: 'idle' });
  const renameMutation = useRenameDatasetMutation();
  const deleteMutation = useDeleteDatasetMutation();

  const closeModal = () => {
    if (renameMutation.isPending || deleteMutation.isPending) return;
    setModalState({ kind: 'idle' });
    renameMutation.reset();
    deleteMutation.reset();
  };
  const submitRename = (newName: string) => {
    if (!dataset) return;
    renameMutation.mutate(
      { id: dataset.id, name: newName },
      {
        onSuccess: () => {
          message.success(t('datasets.renameSuccess', { name: newName }));
          setModalState({ kind: 'idle' });
        },
      },
    );
  };
  const confirmDelete = () => {
    if (!dataset) return;
    deleteMutation.mutate(dataset.id, {
      onSuccess: () => {
        message.success(t('datasets.deleteSuccess', { name: dataset.name }));
        navigate('/data-management/datasets', { replace: true });
      },
    });
  };

  const BREADCRUMB = useMemo(
    () => [
      { label: t('nav.home'), route: '/' },
      { label: t('nav.dataManagement'), route: '/data-management/workspaces' },
      { label: t('nav.datasets'), route: '/data-management/datasets' },
      { label: dataset?.name ?? '…' },
    ],
    [t, dataset?.name],
  );

  // ─── 404 state ─────────────────────────────────────────────────────
  if (queryNotFound) {
    return (
      <>
        <PageHeader
          breadcrumb={[
            { label: t('nav.home'), route: '/' },
            { label: t('nav.dataManagement'), route: '/data-management/workspaces' },
            { label: t('nav.datasets'), route: '/data-management/datasets' },
            { label: '?' },
          ]}
          title={t('datasets.detail.notFoundTitle')}
          onNavigate={(r) => navigate(r)}
        />
        <PageCard>
          <div
            data-component="DatasetDetailNotFound"
            style={{
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <DatabaseOutlined style={{ fontSize: 36, opacity: 0.45, marginBottom: 12 }} />
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {t('datasets.detail.notFoundTitle')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('datasets.detail.notFoundHint')}</Typography.Text>
            <div style={{ marginTop: 20 }}>
              <Button
                type="primary"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/data-management/datasets')}
              >
                {t('datasets.detail.backToDatasets')}
              </Button>
            </div>
          </div>
        </PageCard>
      </>
    );
  }

  // ─── Loading (first paint of dataset) ──────────────────────────────
  if (!dataset) {
    return (
      <>
        <PageHeader
          breadcrumb={BREADCRUMB}
          title={t('datasets.detail.loadingTitle')}
          onNavigate={(r) => navigate(r)}
        />
        <PageCard>
          <Skeleton active paragraph={{ rows: 10 }} data-component="DatasetDetailLoading" />
        </PageCard>
      </>
    );
  }

  // ─── Populated ─────────────────────────────────────────────────────
  const total = rowsPage?.total ?? 0;
  const fullRowCount = dataset.rowCount;
  const hasQuery = qParam.length > 0;
  const showMatchedCounter = hasQuery || rowsQuery.isFetched;

  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <SourceIcon format={dataset.sourceFormat} />
      <span>{dataset.name}</span>
      <Tag style={{ marginInlineStart: 4 }}>
        {dataset.sourceFormat === 'excel'
          ? t('datasets.detail.formatExcelSheet', { sheet: dataset.sheetName ?? '' })
          : t('datasets.detail.formatCsv')}
      </Tag>
    </span>
  );

  const subtitle = t('datasets.detail.subtitle', {
    rows: dataset.rowCount.toLocaleString(i18n.language),
    cols: dataset.columnCount,
    size: formatBytes(dataset.sizeBytes),
    uploaded: relativeTime(dataset.createdAt, t),
  });

  const actions = (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          {
            key: 'rename',
            label: t('common.rename'),
            icon: <EditOutlined />,
            onClick: () => setModalState({ kind: 'rename' }),
          },
          {
            key: 'delete',
            label: t('common.delete'),
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => setModalState({ kind: 'delete' }),
          },
        ],
      }}
    >
      <Button data-component="DatasetDetailActionsTrigger">
        {t('datasets.detail.actions')} <DownOutlined />
      </Button>
    </Dropdown>
  );

  return (
    <div
      data-component="DatasetDetailPage"
      style={{
        // Mirrors DatasetNewPage: fill the Layout.Content area
        // (100vh − Layout.Header 56 − Content padding 16 × 2 = 88px)
        // so the pagination bar can stick to the bottom of the card
        // and the table body owns the vertical scroll.
        height: 'calc(100vh - 88px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <PageHeader
        breadcrumb={BREADCRUMB}
        title={title}
        subtitle={subtitle}
        actions={actions}
        onNavigate={(r) => navigate(r)}
      />
      <PageCard variant="fill">
        <div style={{ flex: '0 0 auto' }}>
          <MetadataStrip dataset={dataset} workspaceName={workspaceName} />
        </div>

        <div
          data-component="DatasetDetailSearchBar"
          style={{
            flex: '0 0 auto',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <Input.Search
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('datasets.detail.searchPlaceholder')}
            allowClear
            onClear={() => onSearchChange('')}
            style={{ maxWidth: 360, flex: '1 1 240px' }}
            data-component="DatasetRowSearch"
          />
          {showMatchedCounter ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('datasets.detail.matchedOfTotal', {
                matched: total.toLocaleString(i18n.language),
                total: fullRowCount.toLocaleString(i18n.language),
              })}
            </Typography.Text>
          ) : null}
          {hasQuery ? (
            <Typography.Link onClick={onClearSearch} data-component="DatasetRowSearchClear">
              {t('datasets.detail.clear')}
            </Typography.Link>
          ) : null}
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <AdvancedQueryInput
            columns={dataset.columns}
            value={advancedText}
            onApply={applyAdvanced}
            onClear={clearAdvanced}
          />
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <ActiveFilterChips
            filters={filters}
            columns={dataset.columns}
            onRemove={removeFilter}
            onClearAll={clearAll}
          />
        </div>

        {rowsQuery.isError && !queryNotFound ? (
          <Alert
            type="error"
            showIcon
            message={t('datasets.detail.loadRowsCouldnt')}
            description={(rowsQuery.error as Error | undefined)?.message ?? t('common.unknownError')}
            data-component="DatasetRowsError"
            style={{ flex: '0 0 auto', marginBottom: 12 }}
          />
        ) : null}

        <DataTableBody
          dataset={dataset}
          rowsPage={rowsPage}
          loading={rowsQuery.isFetching}
          hasQuery={hasQuery}
          query={qParam}
          filters={filters}
          onClearSearch={onClearSearch}
          onClearAllFilters={clearAll}
          onApplyFilter={applyFilter}
          onClearFilter={removeFilter}
        />

        {total > 0 ? (
          <div
            style={{
              flex: '0 0 auto',
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
            }}
            className="dataset-rows-pagination-bar"
            data-component="DatasetRowsPagination"
          >
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              pageSizeOptions={['25', '50', '100']}
              showSizeChanger
              showQuickJumper
              onChange={(nextPage, nextPageSize) => {
                const params = new URLSearchParams(searchParams);
                // AntD calls onChange with the prior pageSize when only
                // `page` changed; on page-size change, reset to page 1.
                if (nextPageSize !== pageSize) {
                  params.set('page_size', String(nextPageSize));
                  params.delete('page');
                } else {
                  if (nextPage === 1) {
                    params.delete('page');
                  } else {
                    params.set('page', String(nextPage));
                  }
                }
                setSearchParams(params);
              }}
            />
          </div>
        ) : null}
      </PageCard>

      <RenameModal
        resourceLabel="dataset"
        maxLength={NAME_LENGTHS.DATASET_MAX}
        currentName={dataset.name}
        open={modalState.kind === 'rename'}
        isPending={renameMutation.isPending}
        error={renameMutation.error}
        onSubmit={submitRename}
        onClose={closeModal}
      />
      <DeleteConfirmModal
        resourceLabel="dataset"
        resourceName={dataset.name}
        open={modalState.kind === 'delete'}
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onClose={closeModal}
      />
    </div>
  );
}

function MetadataStrip({
  dataset,
  workspaceName,
}: Readonly<{ dataset: Dataset; workspaceName: string | undefined }>) {
  const { t } = useTranslation();
  const items: ReadonlyArray<{ label: string; value: string }> = [
    {
      label: t('datasets.detail.meta.workspace'),
      value: workspaceName ?? '—',
    },
    {
      label: t('datasets.detail.meta.rows'),
      value: dataset.rowCount.toLocaleString(i18n.language),
    },
    {
      label: t('datasets.detail.meta.cols'),
      value: String(dataset.columnCount),
    },
    {
      label: t('datasets.detail.meta.size'),
      value: formatBytes(dataset.sizeBytes),
    },
    {
      label: t('datasets.detail.meta.uploaded'),
      value: relativeTime(dataset.createdAt, t),
    },
    {
      label: t('datasets.detail.meta.format'),
      value:
        dataset.sourceFormat === 'excel'
          ? t('datasets.detail.formatExcelSheet', { sheet: dataset.sheetName ?? '' })
          : t('datasets.detail.formatCsv'),
    },
  ];
  return (
    <div
      data-component="DatasetMetadataStrip"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 16,
        padding: '12px 16px',
        background: 'var(--ant-color-fill-quaternary, #fafafa)',
        border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        borderRadius: 6,
        marginBottom: 16,
      }}
    >
      {items.map((item) => (
        <div key={item.label}>
          <Typography.Text
            type="secondary"
            style={{
              display: 'block',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 2,
            }}
          >
            {item.label}
          </Typography.Text>
          <Typography.Text strong>{item.value}</Typography.Text>
        </div>
      ))}
    </div>
  );
}

type DataTableBodyProps = Readonly<{
  dataset: Dataset;
  rowsPage: { rows: (string | null)[][]; total: number } | undefined;
  loading: boolean;
  hasQuery: boolean;
  query: string;
  filters: import('./filters/types').FilterSet;
  onClearSearch: () => void;
  onClearAllFilters: () => void;
  onApplyFilter: (predicate: import('./filters/types').FilterPredicate) => void;
  onClearFilter: (colIndex: number) => void;
}>;

function DataTableBody({
  dataset,
  rowsPage,
  loading,
  hasQuery,
  query,
  filters,
  onClearSearch,
  onClearAllFilters,
  onApplyFilter,
  onClearFilter,
}: DataTableBodyProps) {
  const { t } = useTranslation();
  const locale = i18n.language;

  if (loading && !rowsPage) {
    return (
      <div style={{ flex: '1 1 auto', minHeight: 0 }} data-component="DatasetRowsLoading">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  const total = rowsPage?.total ?? 0;
  const hasFilters = filters.length > 0;
  if (total === 0) {
    if (hasQuery && hasFilters) {
      return (
        <div
          data-component="DatasetRowsNoMatchBoth"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {t('datasets.filters.noMatchBothTitle', { query })}
          </Typography.Title>
          <Typography.Text type="secondary">{t('datasets.filters.noMatchBothHint')}</Typography.Text>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <Button onClick={onClearSearch}>{t('datasets.detail.clear')}</Button>
            <Button onClick={onClearAllFilters}>{t('datasets.filters.clearAll')}</Button>
          </div>
        </div>
      );
    }
    if (hasFilters) {
      return (
        <div
          data-component="DatasetRowsNoMatchFilters"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {t('datasets.filters.noMatchFiltersTitle')}
          </Typography.Title>
          <Typography.Text type="secondary">{t('datasets.filters.noMatchFiltersHint')}</Typography.Text>
          <div style={{ marginTop: 16 }}>
            <Button onClick={onClearAllFilters}>{t('datasets.filters.clearAll')}</Button>
          </div>
        </div>
      );
    }
    if (hasQuery) {
      return (
        <div
          data-component="DatasetRowsNoMatch"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <Typography.Title level={5} style={{ marginTop: 0 }}>
            {t('datasets.detail.noMatchTitle', { query })}
          </Typography.Title>
          <Typography.Text type="secondary">{t('datasets.detail.noMatchHint')}</Typography.Text>
          <div style={{ marginTop: 16 }}>
            <Button onClick={onClearSearch}>{t('datasets.detail.clear')}</Button>
          </div>
        </div>
      );
    }
    return (
      <div
        data-component="DatasetRowsZeroRows"
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          {t('datasets.detail.zeroRowsTitle')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('datasets.detail.zeroRowsHint')}</Typography.Text>
      </div>
    );
  }

  return (
    <div
      data-component="DatasetRowsTable"
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'auto',
        border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        borderRadius: 6,
      }}
    >
      <table
        style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}
      >
        <thead>
          <tr>
            {dataset.columns.map((col, ci) => {
              const existing = filters.find((p) => p.col === ci);
              return (
                <th
                  key={col.name}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    // Solid #fafafa, not var(--ant-color-fill-quaternary)
                    // — AntD's fill-* tokens are rgba(0,0,0,0.02) and would
                    // let scrolled rows show through the sticky header.
                    background: '#fafafa',
                    boxShadow: 'inset 0 -1px 0 var(--ant-color-border-secondary, #f0f0f0)',
                    whiteSpace: 'nowrap',
                    color: 'var(--ant-color-text-secondary, #595959)',
                    fontWeight: 600,
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}
                  data-component="DatasetRowsHeaderCell"
                  data-column={col.name}
                >
                  {col.name}
                  <DtypeBadge dtype={col.dtype} />
                  <FilterPopover
                    column={col}
                    colIndex={ci}
                    existing={existing}
                    onApply={onApplyFilter}
                    onClear={() => onClearFilter(ci)}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {(rowsPage?.rows ?? []).map((row, ri) => (
            <tr
              key={ri}
              data-component="DatasetRowsBodyRow"
              className="dataset-rows-body-row"
            >
              {dataset.columns.map((col, ci) => {
                const cell = formatCell(row[ci] ?? null, col.dtype, locale);
                return (
                  <td
                    key={col.name}
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                      maxWidth: 240,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: cell.isNumeric ? 'right' : 'left',
                      color: cell.isNull ? 'var(--ant-color-text-tertiary, #8c8c8c)' : undefined,
                      fontVariantNumeric: cell.isNumeric ? 'tabular-nums' : undefined,
                    }}
                    title={cell.isNull ? undefined : cell.text}
                    data-component="DatasetRowsBodyCell"
                    data-null={cell.isNull || undefined}
                  >
                    {cell.isNull ? '—' : cell.text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

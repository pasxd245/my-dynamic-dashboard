import {
  ArrowLeftOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  EditOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  LockOutlined,
  PartitionOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { ColumnsIcon, XCircleIcon } from '@phosphor-icons/react';
import { PageCard, PageContainer, PageHeader } from '@mdd/ui';
import { Alert, App, Button, Dropdown, Input, Skeleton, Tag, Tooltip, Typography } from 'antd';
import i18n from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { DEFAULT_PAGE_SIZE, NAME_LENGTHS, PAGE_SIZES } from '@/_generated/constants';
import { formatBytes } from '@/lib/formatBytes';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import { useCreateQueryMutation } from '@/features/data-management/queries/hooks';
import { SaveQueryModal } from '@/features/data-management/queries/SaveQueryModal';
import { JoinWithRelatedModal } from '@/features/data-management/queries/JoinWithRelatedModal';
import { useRelationshipsQuery } from '@/features/data-management/relationships/hooks';
import { ApiErrorThrown } from '../_shared/types';
import { DeleteConfirmModal } from '../_shared/DeleteConfirmModal';
import { PagedRowsView } from '../_shared/PagedRowsView';
import { RenameModal } from '../_shared/RenameModal';
import {
  useDatasetQuery,
  useDatasetRowsQuery,
  useDeleteDatasetMutation,
  useRenameDatasetMutation,
  useSetColumnVisibilityMutation,
} from './hooks';
import { ColumnNoteDot } from '@/features/metadata/badges';
import { MetadataBar, MetadataDockRow, useMetadataDock } from '@/features/metadata/dock';
import { useWorkflowQuery } from '@/features/data-management/workflows/hooks';
import { DateCoverageStrip } from './DateCoverage';
import { downloadDatasetExport } from './exportDataset';
import { PropertiesDrawer } from './PropertiesDrawer';
import { useFoldable } from './foldable';
import { FrozenCopyBand, SaveCopyModal } from './SavedCopy';
import { ActiveFilterChips, formatChipText } from './filters/ActiveFilterChips';
import { FilterPopover } from './filters/FilterPopover';
import { useFiltersState } from './filters/useFiltersState';
import { AdvancedQueryInput } from './advanced-query/AdvancedQueryInput';
import { useAdvancedQueryState } from './advanced-query/useAdvancedQueryState';
import type { Column, Dataset, DatasetLineage } from './types';

const DEBOUNCE_MS = 300;

function clampPageSize(raw: string | null): number {
  const n = Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
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

function SourceIcon({ format }: { format: Dataset['sourceFormat'] }) {
  if (format === 'workflow') {
    return <PartitionOutlined style={{ color: '#722ed1' }} />;
  }
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
      // R202 — from the URL as it is when the timer fires (a note opened in the
      // meantime is kept), not as it was when the user typed.
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          const trimmed = next.trim();
          if (trimmed.length === 0) {
            params.delete('q');
          } else {
            params.set('q', trimmed);
          }
          params.delete('page'); // q-change resets to page 1
          return params;
        },
        { replace: true },
      );
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

  // R152 — apply the visible/hidden set (Columns manager Apply). Rethrows so the
  // manager keeps its popover open to retry; the at-least-one-visible guard is
  // enforced client-side too, so `no_visible_columns` shouldn't normally reach.
  const handleApplyColumnVisibility = async (hidden: string[]) => {
    if (!id) return;
    try {
      await setColumnVisibility.mutateAsync({ id, hidden });
      message.success(t('datasets.detail.columns.applied'));
    } catch (err) {
      message.error(
        err instanceof ApiErrorThrown ? t('datasets.detail.columns.applyFailed') : t('common.unknownError'),
      );
      throw err;
    }
  };

  // R152 — session-local "show all" override (never persisted). When off, the
  // row-preview default-hides `hidden` columns; the Properties panel toggles it.
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [saveCopyOpen, setSaveCopyOpen] = useState(false);
  // R153 — the Properties drawer (schema view + visibility editor), opened from
  // the toolbar button AND the Actions ▾ menu.
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const setColumnVisibility = useSetColumnVisibilityMutation();

  const datasetQuery = useDatasetQuery(id);
  const datasetColumns = useMemo<Column[]>(() => datasetQuery.data?.columns ?? [], [datasetQuery.data?.columns]);
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

  // ─── Join with related dataset (R71) ──────────────────────────────
  const [joinOpen, setJoinOpen] = useState(false);
  const relationshipsQuery = useRelationshipsQuery(dataset?.workspaceId);
  // The join affordance is enabled iff this dataset has ≥1 VALID relationship
  // involving it (a stale edge can't be joined). No dead-end empty Select.
  const joinableRelCount = (relationshipsQuery.data ?? []).filter(
    (r) => r.status === 'valid' && (r.leftDatasetId === dataset?.id || r.rightDatasetId === dataset?.id),
  ).length;

  // ─── Save as Query (R69) ───────────────────────────────────────────
  const [saveQueryOpen, setSaveQueryOpen] = useState(false);
  const createQueryMutation = useCreateQueryMutation();
  // R180 / R202 — the dataset's and its columns' notes, read by layer in a dock beside the table.
  const metaDock = useMetadataDock('dataset', dataset?.id);
  // R204 — the context sections fold so the table keeps its height on short screens (foldable.ts).
  // An active advanced query is always shown: a filter that governs the rows is never hidden.
  const [detailsOpen, toggleDetails] = useFoldable('details');
  const [advancedOpenChoice, toggleAdvanced] = useFoldable('advancedQuery');
  const advancedActive = advancedText.trim().length > 0;
  const advancedOpen = advancedOpenChoice || advancedActive;
  const openSaveQuery = () => {
    createQueryMutation.reset();
    setSaveQueryOpen(true);
  };
  const closeSaveQuery = () => {
    if (createQueryMutation.isPending) return;
    setSaveQueryOpen(false);
    createQueryMutation.reset();
  };
  const submitSaveQuery = (name: string) => {
    if (!dataset) return;
    createQueryMutation.mutate(
      {
        workspaceId: dataset.workspaceId,
        body: {
          name,
          sourceId: dataset.id, // R79 — the canonical driving source (this `ds_`)
          definition: {
            q: qParam.length > 0 ? qParam : null,
            filters: [...filters],
            advanced: advancedGroups,
          },
        },
      },
      {
        onSuccess: (created) => {
          message.success(t('queries.save.success', { name }));
          setSaveQueryOpen(false);
          navigate(`/data-management/queries/${created.id}`);
        },
      },
    );
  };

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
              <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate('/data-management/datasets')}>
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
        <PageHeader breadcrumb={BREADCRUMB} title={t('datasets.detail.loadingTitle')} onNavigate={(r) => navigate(r)} />
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
  const hasFilters = filters.length > 0;
  const hasAdvanced = advancedGroups.length > 0;
  const hasPredicates = hasQuery || hasFilters || hasAdvanced;
  const showMatchedCounter = hasQuery || rowsQuery.isFetched;

  // Name suggestion for Save-as-Query: the first active chip, else the
  // search text, else a generic label.
  const saveQuerySuggestion = hasFilters
    ? formatChipText(filters[0], dataset.columns, i18n.language, t)
    : hasQuery
      ? qParam
      : t('queries.save.defaultName');

  // URL-state translation for PagedRowsView's page/size changes. AntD calls
  // onChange with the prior pageSize when only `page` changed; on page-size
  // change, reset to page 1 (the q-change reset rule's sibling).
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

  // Zero-match empty state — the four variants depend on which predicate(s)
  // are active. PagedRowsView centers whatever we pass here.
  // R191 — an advanced query that matches nothing is its own case (it used to
  // fall through to "this dataset has no rows"). Its clear lives on the
  // advanced input, so the block offers exactly that; any other active
  // predicate then shows its own no-match state if it still matches nothing.
  const rowsEmptyState = hasAdvanced ? (
    <div data-component="DatasetRowsNoMatchAdvanced">
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {t('datasets.filters.noMatchAdvancedTitle')}
      </Typography.Title>
      <Typography.Text type="secondary">{t('datasets.filters.noMatchAdvancedHint')}</Typography.Text>
      <div style={{ marginTop: 16 }}>
        <Button onClick={clearAdvanced}>{t('datasets.filters.clearAdvanced')}</Button>
      </div>
    </div>
  ) : hasQuery && hasFilters ? (
    <div data-component="DatasetRowsNoMatchBoth">
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {t('datasets.filters.noMatchBothTitle', { query: qParam })}
      </Typography.Title>
      <Typography.Text type="secondary">{t('datasets.filters.noMatchBothHint')}</Typography.Text>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Button onClick={onClearSearch}>{t('datasets.detail.clear')}</Button>
        <Button onClick={clearAll}>{t('datasets.filters.clearAll')}</Button>
      </div>
    </div>
  ) : hasFilters ? (
    <div data-component="DatasetRowsNoMatchFilters">
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {t('datasets.filters.noMatchFiltersTitle')}
      </Typography.Title>
      <Typography.Text type="secondary">{t('datasets.filters.noMatchFiltersHint')}</Typography.Text>
      <div style={{ marginTop: 16 }}>
        <Button onClick={clearAll}>{t('datasets.filters.clearAll')}</Button>
      </div>
    </div>
  ) : hasQuery ? (
    <div data-component="DatasetRowsNoMatch">
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {t('datasets.detail.noMatchTitle', { query: qParam })}
      </Typography.Title>
      <Typography.Text type="secondary">{t('datasets.detail.noMatchHint')}</Typography.Text>
      <div style={{ marginTop: 16 }}>
        <Button onClick={onClearSearch}>{t('datasets.detail.clear')}</Button>
      </div>
    </div>
  ) : (
    <div data-component="DatasetRowsZeroRows">
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {t('datasets.detail.zeroRowsTitle')}
      </Typography.Title>
      <Typography.Text type="secondary">{t('datasets.detail.zeroRowsHint')}</Typography.Text>
    </div>
  );

  // R193 — a saved (frozen) copy is read-only on every surface.
  const isCopy = Boolean(dataset.savedFrom);

  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <SourceIcon format={dataset.sourceFormat} />
      <span>{dataset.name}</span>
      <Tag style={{ marginInlineStart: 4 }}>
        {dataset.sourceFormat === 'excel'
          ? t('datasets.detail.formatExcelSheet', { sheet: dataset.sheetName ?? '' })
          : dataset.sourceFormat === 'workflow'
            ? t('datasets.detail.formatWorkflow')
            : t('datasets.detail.formatCsv')}
      </Tag>
    </span>
  );

  // R192 — a published dataset was published, not uploaded; R193 — a copy was saved.
  const subtitle = t(
    dataset.savedFrom
      ? 'datasets.detail.subtitleSaved'
      : dataset.sourceFormat === 'workflow'
        ? 'datasets.detail.subtitlePublished'
        : 'datasets.detail.subtitle',
    {
      rows: dataset.rowCount.toLocaleString(i18n.language),
      cols: dataset.columnCount,
      size: formatBytes(dataset.sizeBytes),
      uploaded: relativeTime(dataset.createdAt, t),
    },
  );

  // R196 (item 3.2c) — every row of the dataset (or the saved copy) as a file,
  // stamped with its data version. Filters on screen are not applied.
  const exportItems = (['xlsx', 'csv'] as const).map((fmt) => ({
    key: `export-${fmt}`,
    label: t(`datasets.export.${fmt}`),
    icon: <DownloadOutlined />,
    onClick: () => {
      downloadDatasetExport(dataset.id, fmt)
        .then((name) => message.success(t('datasets.export.done', { name })))
        .catch((err: unknown) => {
          const body =
            err instanceof ApiErrorThrown ? (err.body as { code?: string; rows?: number; max?: number }) : null;
          message.error(
            body?.code === 'export_too_large'
              ? // A copy cannot carry a query (R193): no "save a query" advice there.
                t(isCopy ? 'datasets.export.tooLargeCopy' : 'datasets.export.tooLarge', {
                  rows: body.rows ?? 0,
                  max: body.max ?? 0,
                })
              : t('datasets.export.failed'),
          );
        });
    },
  }));

  const actions = (
    <span style={{ display: 'inline-flex', gap: 8 }}>
      {/* R193 — a saved copy is read-only: no query can be created over it there. */}
      {isCopy ? null : (
        <Tooltip title={hasPredicates ? undefined : t('queries.save.disabledTooltip')}>
          <Button
            icon={<PlusOutlined />}
            disabled={!hasPredicates}
            onClick={openSaveQuery}
            data-component="SaveAsQueryAction"
          >
            {t('queries.save.action')}
          </Button>
        </Tooltip>
      )}
      <Dropdown
        trigger={['click']}
        menu={{
          items: isCopy
            ? [
                // R193 — a saved copy: view its columns, or delete it; nothing else.
                {
                  key: 'properties',
                  label: t('datasets.detail.properties.action'),
                  icon: <ColumnsIcon size={14} />,
                  onClick: () => setPropertiesOpen(true),
                },
                ...exportItems,
                {
                  key: 'delete',
                  label: t('common.delete'),
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => setModalState({ kind: 'delete' }),
                },
              ]
            : [
                {
                  key: 'join',
                  label: t('queries.join.action'),
                  icon: <MergeCellsOutlined />,
                  // Disabled when the dataset has no valid relationship to join on
                  // (the same gate the standalone button had — now folded into the
                  // Actions menu so the header isn't a row of competing buttons).
                  disabled: joinableRelCount === 0,
                  onClick: () => setJoinOpen(true),
                },
                { type: 'divider' },
                {
                  key: 'properties',
                  label: t('datasets.detail.properties.action'),
                  icon: <ColumnsIcon size={14} />,
                  onClick: () => setPropertiesOpen(true),
                },
                // R192 — a published dataset is refreshed by re-publishing its
                // workflow, never by upload: no Refresh here.
                ...(dataset.sourceFormat === 'workflow'
                  ? []
                  : [
                      {
                        key: 'refresh',
                        label: t('datasets.refresh'),
                        icon: <ReloadOutlined />,
                        onClick: () => navigate(`/data-management/datasets/${dataset.id}/refresh`),
                      },
                    ]),
                // R193 — freeze this dataset as a labelled, read-only copy.
                {
                  key: 'saveCopy',
                  label: t('datasets.savedCopy.action'),
                  icon: <LockOutlined />,
                  onClick: () => setSaveCopyOpen(true),
                },
                ...exportItems,
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
    </span>
  );

  return (
    // R96: `fill="bounded"` caps the card at the viewport (vs R95's grow) so the
    // table body's inner scroll absorbs short viewports and the pager stays
    // pinned at the viewport bottom (the view-table "Excel" model). `data`
    // caps + centers on wide screens (R95 D3).
    <PageContainer fill="bounded" width="data" dataComponent="DatasetDetailPage">
      <PageHeader
        breadcrumb={BREADCRUMB}
        title={title}
        subtitle={subtitle}
        actions={actions}
        onNavigate={(r) => navigate(r)}
      />
      <MetadataDockRow
        api={metaDock}
        fill
        cfg={{ kind: 'dataset', nounLabel: dataset.name, childOrder: dataset.columns.map((c) => c.name) }}
      >
        <PageCard variant="fill">
          <div style={{ flex: '0 0 auto' }}>
            <FrozenCopyBand dataset={dataset} />
            {detailsOpen ? (
              <div data-component="DatasetDetailsSection">
                <MetadataStrip dataset={dataset} workspaceName={workspaceName} />
                {dataset.lineage ? <PublishedFrom lineage={dataset.lineage} /> : null}
                <DateCoverageStrip columns={dataset.columns} />
              </div>
            ) : null}
            <MetadataBar api={metaDock} />
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
              // Coerce to a string defensively (a controlled input must never
              // render a literal "null").
              onChange={(e) => onSearchChange(e.target.value ?? '')}
              // Own Escape deterministically and BLOCK AntD's own Escape/clear
              // path (allowClear's Escape handling emitted a stray "null" value
              // on real browsers — repro'd on an empty box). stopPropagation
              // prevents AntD's bubbling handler from running after ours; we
              // dropped `allowClear` so the only clear paths are this Esc and
              // the explicit "Clear" link below.
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  onClearSearch();
                }
              }}
              placeholder={t('datasets.detail.searchPlaceholder')}
              style={{ maxWidth: 360, flex: '1 1 240px' }}
              data-component="DatasetRowSearch"
              // In-field × clear (consistent with the advanced-query field),
              // replacing the old "Clear" text link. Custom suffix — NOT AntD
              // `allowClear` (whose Escape path emitted "null").
              suffix={
                searchInput.length > 0 ? (
                  <XCircleIcon
                    size={16}
                    weight="fill"
                    role="button"
                    aria-label={t('datasets.detail.clear')}
                    data-component="DatasetRowSearchClear"
                    className="aq-icon-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onClearSearch}
                  />
                ) : (
                  <span />
                )
              }
            />
            {showMatchedCounter ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('datasets.detail.matchedOfTotal', {
                  matched: total.toLocaleString(i18n.language),
                  total: fullRowCount.toLocaleString(i18n.language),
                })}
              </Typography.Text>
            ) : null}
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                size="small"
                type="text"
                icon={detailsOpen ? <DownOutlined /> : <RightOutlined />}
                aria-expanded={detailsOpen}
                onClick={toggleDetails}
                data-component="DatasetDetailsToggle"
              >
                {t('datasets.detail.details')}
              </Button>
              {advancedActive ? null : (
                <Button
                  size="small"
                  type="text"
                  icon={advancedOpen ? <DownOutlined /> : <RightOutlined />}
                  aria-expanded={advancedOpen}
                  onClick={toggleAdvanced}
                  data-component="AdvancedQueryToggle"
                >
                  {t('datasets.advancedQuery.label')}
                </Button>
              )}
              <Button
                size="small"
                icon={<ColumnsIcon size={16} />}
                onClick={() => setPropertiesOpen(true)}
                data-component="ColumnsToolbarButton"
              >
                {t('datasets.detail.columns.button', {
                  visible: dataset.columns.filter((c) => !c.hidden).length,
                  total: dataset.columns.length,
                })}
              </Button>
            </div>
          </div>

          {advancedOpen ? (
            <div style={{ flex: '0 0 auto' }}>
              <AdvancedQueryInput
                columns={dataset.columns}
                value={advancedText}
                onApply={applyAdvanced}
                onClear={clearAdvanced}
              />
            </div>
          ) : null}

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

          <PagedRowsView
            columns={dataset.columns}
            showHiddenColumns={showAllColumns}
            rows={rowsPage?.rows}
            loading={rowsQuery.isFetching}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            emptyState={rowsEmptyState}
            renderHeaderExtra={(col, ci) => (
              <>
                <ColumnNoteDot
                  entries={metaDock.read?.children?.[col.name]}
                  column={col.name}
                  onOpen={() => metaDock.open({ scope: 'child', child: col.name })}
                />
                <FilterPopover
                  column={col}
                  colIndex={ci}
                  existing={filters.find((p) => p.col === ci)}
                  onApply={applyFilter}
                  onClear={() => removeFilter(ci)}
                />
              </>
            )}
          />
        </PageCard>
      </MetadataDockRow>

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
      <SaveQueryModal
        open={saveQueryOpen}
        suggestedName={saveQuerySuggestion}
        sourceDatasetName={dataset.name}
        workspaceName={workspaceName}
        filterCount={filters.length}
        advancedCount={advancedGroups.length}
        hasSearch={hasQuery}
        isPending={createQueryMutation.isPending}
        error={createQueryMutation.error}
        onSubmit={submitSaveQuery}
        onClose={closeSaveQuery}
      />
      <JoinWithRelatedModal
        open={joinOpen}
        datasetId={dataset.id}
        datasetName={dataset.name}
        workspaceId={dataset.workspaceId}
        onClose={() => setJoinOpen(false)}
      />

      <PropertiesDrawer
        open={propertiesOpen}
        onClose={() => setPropertiesOpen(false)}
        datasetMeta={datasetMetaItems(dataset, workspaceName, t)}
        columns={dataset.columns}
        showAll={showAllColumns}
        onShowAllChange={setShowAllColumns}
        onApply={handleApplyColumnVisibility}
        applying={setColumnVisibility.isPending}
        readOnly={isCopy}
      />
      {isCopy ? null : <SaveCopyModal dataset={dataset} open={saveCopyOpen} onClose={() => setSaveCopyOpen(false)} />}
    </PageContainer>
  );
}

/** The dataset-level metadata fields — the single source shared by the
 *  always-visible MetadataStrip AND the Properties drawer's Dataset section
 *  (R153), so both format identically. */
function datasetMetaItems(
  dataset: Dataset,
  workspaceName: string | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): ReadonlyArray<{ label: string; value: string }> {
  return [
    { label: t('datasets.detail.meta.workspace'), value: workspaceName ?? '—' },
    { label: t('datasets.detail.meta.rows'), value: dataset.rowCount.toLocaleString(i18n.language) },
    { label: t('datasets.detail.meta.cols'), value: String(dataset.columnCount) },
    { label: t('datasets.detail.meta.size'), value: formatBytes(dataset.sizeBytes) },
    {
      label: t(
        dataset.savedFrom
          ? 'datasets.detail.meta.saved'
          : dataset.sourceFormat === 'workflow'
            ? 'datasets.detail.meta.published'
            : 'datasets.detail.meta.uploaded',
      ),
      value: relativeTime(dataset.createdAt, t),
    },
    // R185 (W-4) — the server's stamp for the rows: which version, and when the
    // rows last changed (= uploaded until the first refresh).
    {
      label: t('datasets.detail.meta.dataVersion'),
      value: t('datasets.detail.meta.dataVersionValue', {
        version: dataset.dataVersion,
        when: relativeTime(dataset.refreshedAt, t),
      }),
    },
    {
      label: t('datasets.detail.meta.format'),
      value:
        dataset.sourceFormat === 'excel'
          ? t('datasets.detail.formatExcelSheet', { sheet: dataset.sheetName ?? '' })
          : dataset.sourceFormat === 'workflow'
            ? t('datasets.detail.formatWorkflow')
            : t('datasets.detail.formatCsv'),
    },
  ];
}

/** R192 — where a published dataset came from: the workflow's CURRENT name and a
 *  link while it exists; its name at publish time + "(deleted)" once it does not. */
function PublishedFrom({ lineage }: Readonly<{ lineage: DatasetLineage }>) {
  const { t } = useTranslation();
  const wf = useWorkflowQuery(lineage.workflowId);
  const gone = wf.error instanceof ApiErrorThrown && wf.error.status === 404;
  const when = new Date(lineage.runAt).toLocaleString(i18n.language);
  return (
    <Typography.Paragraph type="secondary" data-component="DatasetPublishedFrom" style={{ marginTop: -8 }}>
      {t('datasets.detail.publishedFrom')}{' '}
      {gone ? (
        <>
          <strong>{lineage.workflowName}</strong> {t('datasets.detail.publishedFromDeleted')}
        </>
      ) : (
        <Link to={`/data-management/workflows/${lineage.workflowId}`}>{wf.data?.name ?? lineage.workflowName}</Link>
      )}
      {' · '}
      {t('datasets.detail.publishedFromRun', { run: lineage.runNumber, when })}
    </Typography.Paragraph>
  );
}

function MetadataStrip({ dataset, workspaceName }: Readonly<{ dataset: Dataset; workspaceName: string | undefined }>) {
  const { t } = useTranslation();
  const items = datasetMetaItems(dataset, workspaceName, t);
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

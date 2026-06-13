// QueryBuilderPanel (R72) — the interactive construction surface.
//
// The EDIT mode of the query-mode detail: it edits a working-copy of the
// Query's sealed `QueryDefinition` (join + cross-source predicates) and PREVIEWS
// the rows before saving. It adds construction UX only — NO new model, NO new
// engine. Everything predicate-related REUSES the shipped, callback-based
// editors (FilterPopover, ActiveFilterChips, AdvancedQueryInput) bound to the
// EFFECTIVE column space (resolvedColumns when joined; the source dataset's
// columns otherwise). The join edge is edited via <JoinEditor>; the preview is
// the shared <PagedRowsView>; Save persists the definition via PUT /queries/:id.

import { App, Button, Input, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ActiveFilterChips } from '@/features/data-management/datasets/filters/ActiveFilterChips';
import { FilterPopover } from '@/features/data-management/datasets/filters/FilterPopover';
import type { FilterPredicate } from '@/features/data-management/datasets/filters/types';
import { AdvancedQueryInput } from '@/features/data-management/datasets/advanced-query/AdvancedQueryInput';
import { groupsToText } from '@/features/data-management/datasets/advanced-query/serialize';
import type { PredicateGroups } from '@/features/data-management/datasets/advanced-query/types';
import type { Column } from '@/features/data-management/datasets/types';
import { ApiErrorThrown } from '../_shared/types';
import { PagedRowsView } from '../_shared/PagedRowsView';
import { JoinEditor } from './JoinEditor';
import { useQueryPreviewQuery, useUpdateQueryMutation } from './hooks';
import type { Query, QueryDefinition, ResolvedColumn } from './types';

const PREVIEW_PAGE_SIZE = 25;
// Preview re-runs on edit, but debounced — one POST after the user settles,
// not one per keystroke (matches the AdvancedQueryInput's 300ms; design §
// "auto-runs on change, debounced"). The explicit [Preview] button flushes it.
const PREVIEW_DEBOUNCE_MS = 300;

function asColumns(resolved: readonly ResolvedColumn[]): Column[] {
  return resolved.map((c) => ({ name: c.name, dtype: c.dtype }));
}

/** A working-copy atom is invalid if its column index is out of range of the
 *  current effective space, or its dtype no longer matches that column. Mirrors
 *  the server's validate-on-save rule, surfaced in-builder BEFORE save. */
function invalidAtomCount(def: QueryDefinition, columns: readonly Column[]): number {
  const bad = (p: FilterPredicate) => {
    const col = columns[p.col];
    return col === undefined || col.dtype !== p.dtype;
  };
  return def.filters.filter(bad).length + def.advanced.flat().filter(bad).length;
}

export type QueryBuilderPanelProps = Readonly<{
  query: Query;
  /** The source (LEFT) dataset's columns — the effective space when the working
   *  copy is single-source (no join). */
  datasetColumns: readonly Column[];
  /** Leave edit mode (back to the read-only detail). */
  onDone: () => void;
}>;

export function QueryBuilderPanel({ query, datasetColumns, onDone }: QueryBuilderPanelProps) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();

  const [draft, setDraft] = useState<QueryDefinition>(() => ({
    q: query.definition.q ?? null,
    filters: [...query.definition.filters],
    advanced: query.definition.advanced.map((g) => [...g]),
    ...(query.definition.join ? { join: { ...query.definition.join } } : {}),
  }));
  const [page, setPage] = useState(1);

  // The preview keys on a DEBOUNCED copy of the working draft, so editing
  // (esp. typing in the search box) fires at most one preview POST per 300ms
  // of quiet — not one per keystroke. `draft` itself stays live, so the
  // editors, dirty-state, and client-side validation react instantly; only
  // the network preview waits. The [Preview] button flushes the debounce.
  const [debouncedDraft, setDebouncedDraft] = useState<QueryDefinition>(draft);
  const debounceRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    debounceRef.current = window.setTimeout(() => setDebouncedDraft(draft), PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(debounceRef.current);
  }, [draft]);
  const flushPreview = () => {
    window.clearTimeout(debounceRef.current);
    setDebouncedDraft(draft);
  };

  const isJoined = Boolean(draft.join);
  const previewQuery = useQueryPreviewQuery(
    query.workspaceId,
    query.datasetId,
    debouncedDraft,
    page,
    PREVIEW_PAGE_SIZE,
    true,
  );
  const preview = previewQuery.data;
  // A preview is queued when the live draft has outrun the debounced one.
  const previewPending = useMemo(
    () => JSON.stringify(debouncedDraft) !== JSON.stringify(draft),
    [debouncedDraft, draft],
  );

  // Effective columns: the server-computed combined space when joined (from the
  // live preview, falling back to the saved query's), else the source dataset's.
  const columns: Column[] = useMemo(() => {
    if (!isJoined) return [...datasetColumns];
    const resolved = preview?.resolvedColumns ?? query.resolvedColumns;
    return resolved ? asColumns(resolved) : [];
  }, [isJoined, datasetColumns, preview?.resolvedColumns, query.resolvedColumns]);

  const updateMutation = useUpdateQueryMutation();

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(normalize(query.definition)),
    [draft, query.definition],
  );

  // Preview gate states (flag-don't-crash): a drifted edge / predicate blocks
  // save with a guided reason; a structurally-bad atom is caught client-side.
  const err = previewQuery.error;
  const relStale = err instanceof ApiErrorThrown && err.body.code === 'relationship_stale';
  const predStale = err instanceof ApiErrorThrown && err.body.code === 'query_stale';
  const invalidCount = invalidAtomCount(draft, columns);
  const previewOk = Boolean(preview) && !relStale && !predStale && !previewQuery.isError;
  // Save only once the preview reflects the CURRENT draft (not while a
  // debounced preview is still queued/in-flight) — you save what you previewed.
  const canSave = dirty && previewOk && !previewPending && invalidCount === 0 && !updateMutation.isPending;

  const setDraftField = (patch: Partial<QueryDefinition>) => {
    setPage(1);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const applyFilter = (predicate: FilterPredicate) => {
    const without = draft.filters.filter((p) => p.col !== predicate.col);
    setDraftField({ filters: [...without, predicate] });
  };
  const removeFilter = (colIndex: number) =>
    setDraftField({ filters: draft.filters.filter((p) => p.col !== colIndex) });
  const clearAllFilters = () => setDraftField({ filters: [] });
  const setAdvanced = (groups: PredicateGroups) => setDraftField({ advanced: groups });
  const setJoin = (relationshipId: string | undefined) => {
    setPage(1);
    setDraft((d) => {
      const next: QueryDefinition = { q: d.q, filters: d.filters, advanced: d.advanced };
      if (relationshipId) next.join = { relationshipId, type: 'inner' };
      return next;
    });
  };

  const save = () => {
    if (!canSave) return;
    updateMutation.mutate(
      { id: query.id, body: { definition: draft } },
      {
        onSuccess: () => {
          message.success(t('queries.builder.saved', { name: query.name }));
          onDone();
        },
      },
    );
  };

  const cancel = () => {
    if (!dirty) {
      onDone();
      return;
    }
    modal.confirm({
      title: t('queries.builder.discardTitle'),
      content: t('queries.builder.discardBody'),
      okText: t('queries.builder.discardConfirm'),
      cancelText: t('queries.builder.keepEditing'),
      okButtonProps: { danger: true },
      onOk: onDone,
    });
  };

  const total = preview?.total ?? 0;

  return (
    <div
      data-component="QueryBuilderPanel"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}
    >
      {/* Join editor */}
      <JoinEditor
        datasetId={query.datasetId}
        workspaceId={query.workspaceId}
        value={draft.join?.relationshipId}
        onChange={setJoin}
      />

      {/* Predicate builders — over the effective column space */}
      <div data-component="QueryBuilderPredicates" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Typography.Text strong style={{ fontSize: 12 }}>
          {t('queries.builder.filtersLabel')}
          {isJoined ? (
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              {' '}
              {t('queries.builder.combinedColumns')}
            </Typography.Text>
          ) : null}
        </Typography.Text>
        {columns.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="QueryBuilderColumnsPending">
            {t('queries.builder.columnsPending')}
          </Typography.Text>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {columns.map((col, idx) => (
              <span
                key={`${col.name}-${idx}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
                data-component="QueryBuilderColumnFilter"
              >
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {col.name}
                </Typography.Text>
                <FilterPopover
                  column={col}
                  colIndex={idx}
                  existing={draft.filters.find((p) => p.col === idx)}
                  onApply={applyFilter}
                  onClear={() => removeFilter(idx)}
                />
              </span>
            ))}
          </div>
        )}

        <ActiveFilterChips
          filters={draft.filters}
          columns={columns}
          onRemove={removeFilter}
          onClearAll={clearAllFilters}
        />

        {columns.length > 0 ? (
          <AdvancedQueryInput
            columns={columns}
            value={groupsToText(draft.advanced, columns)}
            onApply={setAdvanced}
            onClear={() => setAdvanced([])}
          />
        ) : null}

        <div>
          <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            {t('queries.builder.searchLabel')}
          </Typography.Text>
          <Input
            value={draft.q ?? ''}
            onChange={(e) => setDraftField({ q: e.target.value || null })}
            placeholder={t('queries.builder.searchPlaceholder')}
            allowClear
            data-component="QueryBuilderSearch"
          />
        </div>
      </div>

      {/* Invalid / blocked states — flag-don't-crash; Save is disabled */}
      {relStale ? (
        <div role="alert" data-component="QueryBuilderJoinStale" style={alertStyle('error')}>
          {t('queries.builder.joinStale')}
        </div>
      ) : null}
      {predStale || invalidCount > 0 ? (
        <div role="alert" data-component="QueryBuilderPredInvalid" style={alertStyle('error')}>
          {t('queries.builder.predInvalid', { count: Math.max(invalidCount, 1) })}
        </div>
      ) : null}

      {/* Live preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Typography.Text
          type="secondary"
          style={{ fontSize: 12 }}
          role="status"
          data-component="QueryBuilderPreviewStatus"
        >
          {previewQuery.isFetching || previewPending
            ? t('queries.builder.previewLoading')
            : t('queries.builder.previewCount', { count: total })}
        </Typography.Text>
        {dirty ? <Tag color="warning">{t('queries.builder.unsaved')}</Tag> : null}
        <Button
          size="small"
          onClick={flushPreview}
          loading={previewQuery.isFetching}
          disabled={!previewPending && !previewQuery.isFetching}
          style={{ marginInlineStart: 'auto' }}
          data-component="QueryBuilderPreviewButton"
        >
          {t('queries.builder.preview')}
        </Button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PagedRowsView
          columns={columns}
          rows={preview?.rows as readonly (readonly (string | null)[])[] | undefined}
          loading={previewQuery.isFetching || previewPending}
          total={total}
          page={page}
          pageSize={PREVIEW_PAGE_SIZE}
          onPageChange={(p) => setPage(p)}
          emptyState={
            <>
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                {t('queries.builder.previewEmptyTitle')}
              </Typography.Title>
              <Typography.Text type="secondary">{t('queries.builder.previewEmptyHint')}</Typography.Text>
            </>
          }
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flex: '0 0 auto' }}>
        <Button onClick={cancel} data-component="QueryBuilderCancel">
          {t('common.cancel')}
        </Button>
        <Button
          type="primary"
          onClick={save}
          disabled={!canSave}
          loading={updateMutation.isPending}
          data-component="QueryBuilderSave"
        >
          {t('queries.builder.save')}
        </Button>
      </div>
    </div>
  );
}

/** Normalize a saved definition to the working-copy shape so the dirty check
 *  compares like-for-like (q defaulted to null; join omitted when absent). */
function normalize(def: QueryDefinition): QueryDefinition {
  return {
    q: def.q ?? null,
    filters: [...def.filters],
    advanced: def.advanced.map((g) => [...g]),
    ...(def.join ? { join: { ...def.join } } : {}),
  };
}

function alertStyle(_kind: 'error'): React.CSSProperties {
  return {
    padding: '8px 12px',
    background: 'var(--ant-color-error-bg, #fff2f0)',
    border: '1px solid var(--ant-color-error-border, #ffccc7)',
    borderRadius: 6,
    color: 'var(--ant-color-error, #ff4d4f)',
    fontSize: 13,
    flex: '0 0 auto',
  };
}

// useQueryBuilder (R72) — the construction surface's state, lifted out of the
// panel so the PAGE HEADER can drive Save/Cancel (matching the app's
// header-actions convention) while a presentational <QueryBuilderPanel> renders
// the Build/Preview tabs. It owns: the working-copy definition, the debounced
// live preview (a stateless POST), the effective column space, dirty + validity
// gating, and the Save (PUT) / discard lifecycle. No new model, no new engine —
// it edits the sealed QueryDefinition and runs the shipped preview engine.

import { App } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FilterPredicate } from '@/features/data-management/datasets/filters/types';
import type { PredicateGroups } from '@/features/data-management/datasets/advanced-query/types';
import type { Column } from '@/features/data-management/datasets/types';
import { ApiErrorThrown } from '../_shared/types';
import { useQueryPreviewQuery, useUpdateQueryMutation } from './hooks';
import type { Query, QueryDefinition, ResolvedColumn } from './types';

export const PREVIEW_PAGE_SIZE = 25;
// Debounce the preview so editing fires one POST after the user settles, not
// one per keystroke (matches AdvancedQueryInput's 300ms).
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

const EMPTY_DEF: QueryDefinition = { q: null, filters: [], advanced: [] };

export type UseQueryBuilderArgs = Readonly<{
  /** The saved Query being edited (undefined while the page is still loading). */
  query: Query | undefined;
  /** The source (LEFT) dataset's columns — the effective space when single-source. */
  datasetColumns: readonly Column[];
  /** True only while edit mode is open — gates the preview (no POSTs in read mode). */
  active: boolean;
  /** Leave edit mode (back to the read-only detail). */
  onDone: () => void;
}>;

export function useQueryBuilder({ query, datasetColumns, active, onDone }: UseQueryBuilderArgs) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();

  const [draft, setDraft] = useState<QueryDefinition>(EMPTY_DEF);
  const [debouncedDraft, setDebouncedDraft] = useState<QueryDefinition>(EMPTY_DEF);
  const [page, setPage] = useState(1);
  // Items-per-page is user-controllable via the preview's size changer (the
  // PowerQuery-style "load more"): page through, or raise the page size.
  const [pageSize, setPageSize] = useState<number>(PREVIEW_PAGE_SIZE);
  const onPageChange = (nextPage: number, nextPageSize: number) => {
    setPage(nextPage);
    setPageSize(nextPageSize);
  };

  // Seed (and re-seed) the working copy from the saved definition each time edit
  // mode opens — so re-entering after a discard starts clean. Read-only mode
  // never touches the draft (the panel is only mounted while editing).
  useEffect(() => {
    if (active && query) {
      const seeded = normalize(query.definition);
      setDraft(seeded);
      setDebouncedDraft(seeded);
      setPage(1);
    }
  }, [active, query?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preview keys on a DEBOUNCED copy; the live draft drives the editors/validation.
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
    query?.workspaceId,
    query?.datasetId,
    debouncedDraft,
    page,
    pageSize,
    active && Boolean(query),
  );
  const preview = previewQuery.data;
  const previewPending = useMemo(
    () => JSON.stringify(debouncedDraft) !== JSON.stringify(draft),
    [debouncedDraft, draft],
  );

  // Effective columns: the server-computed combined space when joined (from the
  // live preview, falling back to the saved query's), else the source dataset's.
  const columns: Column[] = useMemo(() => {
    if (!isJoined) return [...datasetColumns];
    const resolved = preview?.resolvedColumns ?? query?.resolvedColumns;
    return resolved ? asColumns(resolved) : [];
  }, [isJoined, datasetColumns, preview?.resolvedColumns, query?.resolvedColumns]);

  const updateMutation = useUpdateQueryMutation();

  const dirty = useMemo(
    () => (query ? JSON.stringify(draft) !== JSON.stringify(normalize(query.definition)) : false),
    [draft, query],
  );

  const err = previewQuery.error;
  const relStale = err instanceof ApiErrorThrown && err.body.code === 'relationship_stale';
  const predStale = err instanceof ApiErrorThrown && err.body.code === 'query_stale';
  const invalidCount = invalidAtomCount(draft, columns);
  const previewOk = Boolean(preview) && !relStale && !predStale && !previewQuery.isError;
  // Save only once the preview reflects the CURRENT draft — you save what you previewed.
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
  const setQ = (q: string | null) => setDraftField({ q });
  const setJoin = (relationshipId: string | undefined) => {
    setPage(1);
    setDraft((d) => {
      const next: QueryDefinition = { q: d.q, filters: d.filters, advanced: d.advanced };
      if (relationshipId) next.join = { relationshipId, type: 'inner' };
      return next;
    });
  };

  const save = () => {
    if (!canSave || !query) return;
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

  return {
    // identity (for the JoinEditor)
    datasetId: query?.datasetId ?? '',
    workspaceId: query?.workspaceId ?? '',
    // working state
    draft,
    columns,
    isJoined,
    page,
    setPage,
    pageSize,
    onPageChange,
    // preview
    previewRows: preview?.rows as readonly (readonly (string | null)[])[] | undefined,
    previewTotal: preview?.total ?? 0,
    previewFetching: previewQuery.isFetching || previewPending,
    flushPreview,
    // gating / states
    relStale,
    predStale,
    invalidCount,
    dirty,
    canSave,
    isSaving: updateMutation.isPending,
    // editor handlers
    setJoin,
    applyFilter,
    removeFilter,
    clearAllFilters,
    setAdvanced,
    setQ,
    // lifecycle
    save,
    cancel,
  };
}

export type QueryBuilderState = ReturnType<typeof useQueryBuilder>;

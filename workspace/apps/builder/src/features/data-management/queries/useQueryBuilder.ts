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
import { useRelationshipsQuery } from '@/features/data-management/relationships/hooks';
import { ApiErrorThrown } from '../_shared/types';
import { copyGovernedRel, readChain, readRels, writeDef } from './chain';
import { useCreateQueryMutation, useQueryPreviewQuery, useUpdateQueryMutation } from './hooks';
import type { JoinStep, Query, QueryDefinition, QueryRelationship, ResolvedColumn } from './types';

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

/** Normalize a saved definition to the canonical working-copy WIRE shape so the
 *  dirty check compares like-for-like: q defaulted to null, the chain folded
 *  through the bridge (legacy `join` and `joins` both canonicalize to the same
 *  serialization — a length-≤1 chain on `join`, a multi-hop chain on `joins`). */
function normalize(def: QueryDefinition): QueryDefinition {
  return writeDef(
    { q: def.q ?? null, filters: [...def.filters], advanced: def.advanced.map((g) => [...g]) },
    readRels(def),
    readChain(def),
  );
}

const EMPTY_DEF: QueryDefinition = { q: null, filters: [], advanced: [] };

/** R77 create mode — build a brand-new Query on a PRESET base (a saved Query).
 *  R79 — the base supplies its workspace + its own `qr_` id as the canonical
 *  driving `sourceId` (the legacy `datasetId` is retired). */
export type CreateBase = Readonly<{
  workspaceId: string;
  sourceId: string;
}>;

export type UseQueryBuilderArgs = Readonly<{
  /** The saved Query being edited (undefined while the page is still loading,
   *  or in create mode). */
  query?: Query;
  /** R77 — create mode: build a NEW Query on this preset base. Mutually
   *  exclusive with `query` (edit mode). */
  createBase?: CreateBase;
  /** The source (LEFT) dataset's columns — the effective space when single-source.
   *  Unused in create mode (the base is a `qr_` → columns come from the preview). */
  datasetColumns: readonly Column[];
  /** True only while the builder is open — gates the preview (no POSTs when idle). */
  active: boolean;
  /** Leave the builder (edit: back to the read-only detail; create: navigate away). */
  onDone: () => void;
  /** R77 create mode — called with the newly-created Query after a successful POST
   *  (the page navigates to its detail). */
  onCreated?: (created: Query) => void;
}>;

export function useQueryBuilder({
  query,
  createBase,
  datasetColumns,
  active,
  onDone,
  onCreated,
}: UseQueryBuilderArgs) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();

  // R77 — create vs edit. Create mode has no saved `query`; it builds a NEW Query
  // on `createBase` and Saves with POST (not PUT).
  const isCreate = !query && Boolean(createBase);
  const workspaceId = query?.workspaceId ?? createBase?.workspaceId ?? '';

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

  // R76 (composition, F1) — the DRIVING source: a dataset (`ds_…`, the unchanged
  // R69→R75 path) or a saved Query (`qr_…`) the query is built ON. Seeded from
  // the saved source; editable in-builder via the "Build on" picker (the preview
  // re-runs composed). Persisting a changed base is the Contract gate's job (the
  // PUT is definition-only this round), so F1 prototypes the construction UX.
  const [baseSourceId, setBaseSourceId] = useState<string>('');
  const isComposed = baseSourceId.startsWith('qr_');
  // R79 — the JoinEditor's graph root is a DATASET. When the driving source is a
  // `ds_` that IS the root; when it is a `qr_` (composed) there is no single root
  // dataset on the wire, so first-hop-from-root isn't offered (joins onto a
  // composed base extend from its already-joined datasets; the backend validates
  // provenance regardless). Dataset-rooted queries are unchanged.
  const joinRootDatasetId = baseSourceId.startsWith('ds_') ? baseSourceId : '';

  // Seed (and re-seed) the working copy from the saved definition each time edit
  // mode opens — so re-entering after a discard starts clean. Read-only mode
  // never touches the draft (the panel is only mounted while editing).
  useEffect(() => {
    if (!active) return;
    if (query) {
      const seeded = normalize(query.definition);
      setDraft(seeded);
      setDebouncedDraft(seeded);
      setBaseSourceId(query.sourceId);
      setPage(1);
    } else if (createBase) {
      // R77 create mode — start from an empty definition on the preset base.
      setDraft(EMPTY_DEF);
      setDebouncedDraft(EMPTY_DEF);
      setBaseSourceId(createBase.sourceId);
      setPage(1);
    }
  }, [active, query?.id, createBase?.sourceId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const joins = useMemo(() => readChain(draft), [draft]);
  // R88 — the query's OWN relationships (copy-on-pick snapshots); the join hops
  // reference these by `queryRelId`. Exposed so the list + canvas resolve hops
  // against the query's copies, not the (mutable) governed store.
  const queryRels = useMemo(() => readRels(draft), [draft]);
  // The governed workspace rels — the copy-on-pick LIBRARY (picking one copies it
  // into the query). React Query dedupes with the list/canvas's own fetch.
  const relationshipsQuery = useRelationshipsQuery(workspaceId || undefined);
  const governedRelById = useMemo(
    () => new Map((relationshipsQuery.data ?? []).map((r) => [r.id, r])),
    [relationshipsQuery.data],
  );
  const isJoined = joins.length > 0;
  const previewQuery = useQueryPreviewQuery(
    workspaceId || undefined,
    debouncedDraft,
    page,
    pageSize,
    active && (Boolean(query) || isCreate),
    baseSourceId || undefined,
  );
  const preview = previewQuery.data;
  const previewPending = useMemo(
    () => JSON.stringify(debouncedDraft) !== JSON.stringify(draft),
    [debouncedDraft, draft],
  );

  // Effective columns: the server-computed combined space when joined OR composed
  // (R76 — a `qr_` base has its own effective space from the preview), else the
  // source dataset's.
  const columns: Column[] = useMemo(() => {
    if (!isJoined && !isComposed) return [...datasetColumns];
    const resolved = preview?.resolvedColumns ?? query?.resolvedColumns;
    return resolved ? asColumns(resolved) : [];
  }, [isJoined, isComposed, datasetColumns, preview?.resolvedColumns, query?.resolvedColumns]);

  const updateMutation = useUpdateQueryMutation();
  const createMutation = useCreateQueryMutation();

  const dirty = useMemo(() => {
    if (query) return JSON.stringify(draft) !== JSON.stringify(normalize(query.definition));
    // R77 create mode — "dirty" = any edit away from the empty starting
    // definition (drives the discard-confirm on cancel; not a save gate).
    return JSON.stringify(draft) !== JSON.stringify(EMPTY_DEF);
  }, [draft, query]);

  const err = previewQuery.error;
  const relStale = err instanceof ApiErrorThrown && err.body.code === 'relationship_stale';
  const predStale = err instanceof ApiErrorThrown && err.body.code === 'query_stale';
  // R77 — the preset base (transitively) loops back: the composed preview is
  // blocked (the create page surfaces a guided base-unavailable state).
  const compositionCycle = err instanceof ApiErrorThrown && err.body.code === 'composition_cycle';
  const invalidCount = invalidAtomCount(draft, columns);
  const previewOk = Boolean(preview) && !relStale && !predStale && !previewQuery.isError;
  // Save only once the preview reflects the CURRENT draft — you save what you previewed.
  // Edit needs a dirty change; create needs only a runnable preview (a base + zero
  // edits is a valid, if trivial, composed Query — there's no saved baseline).
  const canSave = isCreate
    ? previewOk && !previewPending && invalidCount === 0 && !createMutation.isPending
    : dirty && previewOk && !previewPending && invalidCount === 0 && !updateMutation.isPending;

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

  // Chain ops (R73). The draft IS the wire definition; each op folds the current
  // chain through the bridge, mutates it, and re-serializes. A hop is always
  // `inner` this round. `setPage(1)` because changing the source space resets
  // the preview window.
  // R88 — copy-on-pick over TWO parallel arrays (the query-owned `relationships`
  // + the `joins` that reference them by `queryRelId`). `addJoin`/`setJoin` take
  // the picked GOVERNED rel id and SNAPSHOT it; `removeJoin`/`setHopType` key on
  // the query-owned rel id. `setPage(1)` resets the preview window.
  const reDraft = (relationships: readonly QueryRelationship[], next: readonly JoinStep[]) => {
    setPage(1);
    setDraft((d) => writeDef(d, relationships, next));
  };
  /** Set/clear the FIRST hop in place (the R72 single-edge affordance). Picks a
   *  GOVERNED rel by id → copy-on-pick; `undefined` clears to single-source. */
  const setJoin = (relationshipId: string | undefined) => {
    const gov = relationshipId ? governedRelById.get(relationshipId) : undefined;
    if (!gov) return reDraft([], []);
    const qrel = copyGovernedRel(gov);
    reDraft([qrel], [{ queryRelId: qrel.id, type: 'inner' }]);
  };
  /** Append a hop by COPYING the picked governed rel into a query-owned rel (R88
   *  copy-on-pick). The rel's own left determines the branch point (R74 tree). */
  const addJoin = (relationshipId: string) => {
    const gov = governedRelById.get(relationshipId);
    if (!gov) return;
    const qrel = copyGovernedRel(gov);
    reDraft([...readRels(draft), qrel], [...readChain(draft), { queryRelId: qrel.id, type: 'inner' }]);
  };
  /** Remove a LEAF hop by its query-owned rel id (R74 — any leaf); prune the
   *  now-unreferenced query-owned relationship. */
  const removeJoin = (queryRelId: string) => {
    const next = readChain(draft).filter((h) => h.queryRelId !== queryRelId);
    const rels = readRels(draft).filter((r) => next.some((h) => h.queryRelId === r.id));
    reDraft(rels, next);
  };
  /** Set a hop's join type (R75 — inner / left / right / full), keyed by its
   *  query-owned rel id. Re-runs preview. */
  const setHopType = (queryRelId: string, type: JoinStep['type']) =>
    reDraft(
      readRels(draft),
      readChain(draft).map((h) => (h.queryRelId === queryRelId ? { ...h, type } : h)),
    );

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

  /** R77 create mode — persist the working copy as a NEW Query under the captured
   *  name, carrying the preset `sourceId` (the qr_ base; R79 — the single canonical
   *  driving source). On success the page navigates to the new detail. `name_taken`
   *  surfaces via `createError` in the modal. */
  const createWithName = (name: string) => {
    if (!isCreate || !createBase || !canSave) return;
    createMutation.mutate(
      {
        workspaceId: createBase.workspaceId,
        body: { name, sourceId: createBase.sourceId, definition: draft },
      },
      {
        onSuccess: (created) => {
          message.success(t('queries.builder.saved', { name }));
          onCreated?.(created);
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

  /** R76 (composition, F1) — pick the driving source (a dataset or a saved
   *  Query). Changing it re-runs the preview composed; reset the page window. */
  const setBaseSource = (sourceId: string) => {
    setPage(1);
    setBaseSourceId(sourceId);
  };

  return {
    // identity (for the JoinEditor — the graph-root DATASET, empty when composed)
    queryId: query?.id ?? '',
    datasetId: joinRootDatasetId,
    workspaceId,
    // R77 — create vs edit mode + the create-with-name lifecycle
    isCreate,
    createWithName,
    createError: createMutation.error,
    // R76 (composition) — the driving source + its setter for the "Build on" picker
    baseSourceId,
    isComposed,
    setBaseSource,
    // working state
    draft,
    columns,
    isJoined,
    joins,
    // R88 — the query's own relationships (copy-on-pick snapshots); hops resolve
    // through these (the list + canvas read them, not the governed store).
    queryRels,
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
    compositionCycle,
    predStale,
    invalidCount,
    dirty,
    canSave,
    isSaving: isCreate ? createMutation.isPending : updateMutation.isPending,
    // editor handlers
    setJoin,
    addJoin,
    removeJoin,
    setHopType,
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

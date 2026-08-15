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
import { useCreateRelationshipMutation, useRelationshipsQuery } from '@/features/data-management/relationships/hooks';
import { ApiErrorThrown } from '../_shared/types';
import { copyGovernedRel, freeFormRel, readChain, readRels, readSteps, writeDef, type RelFields } from './chain';
import { useQueryPreviewQuery, useUpdateQueryMutation } from './hooks';
import type { JoinStep, Query, QueryDefinition, QueryRelationship, ResolvedColumn, Step } from './types';

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
    // R162 — `steps` MUST be threaded: this normalize seeds the edit-mode draft
    // (not just the dirty comparison), so dropping it erased a saved query's
    // shaping the moment you clicked Edit, and the next Save persisted the loss.
    { q: def.q ?? null, filters: [...def.filters], advanced: def.advanced.map((g) => [...g]), steps: readSteps(def) },
    readRels(def),
    readChain(def),
  );
}

const EMPTY_DEF: QueryDefinition = { q: null, filters: [], advanced: [] };

export type UseQueryBuilderArgs = Readonly<{
  /** The saved Query being edited (undefined while the page is still loading). */
  query?: Query;
  /** The source (LEFT) dataset's columns — the effective space when single-source. */
  datasetColumns: readonly Column[];
  /** True only while the builder is open — gates the preview (no POSTs when idle). */
  active: boolean;
  /** Leave the builder — back to the read-only detail. */
  onDone: () => void;
}>;

/** R166 — the builder is EDIT-ONLY. It used to carry a create mode too, for
 *  "Build on this query": a no-id draft on a preset `qr_` base, saved with POST
 *  instead of PUT. That mode existed only because a composition-created query had
 *  no definition yet, so it needed a page that could preview against a base before
 *  the query existed. **Duplicate** has a complete, runnable definition the moment
 *  it is created, so the whole apparatus is unnecessary — the replacement is
 *  smaller than the thing it replaced (query-construction.md § Create mode). */
export function useQueryBuilder({ query, datasetColumns, active, onDone }: UseQueryBuilderArgs) {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();

  const workspaceId = query?.workspaceId ?? '';

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

  // The DRIVING source. R166 — no longer editable STATE, just the saved value: the
  // builder is edit-only and the PUT is definition-only, so a query's source is fixed
  // at create. R167 narrowed it to a dataset, so the graph root is always this id.
  const baseSourceId = query?.sourceId ?? '';
  const joinRootDatasetId = baseSourceId;

  // Seed (and re-seed) the working copy from the saved definition each time edit
  // mode opens — so re-entering after a discard starts clean. Read-only mode
  // never touches the draft (the panel is only mounted while editing).
  useEffect(() => {
    if (!active || !query) return;
    const seeded = normalize(query.definition);
    setDraft(seeded);
    setDebouncedDraft(seeded);
    setPage(1);
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
    active && Boolean(query),
    baseSourceId || undefined,
  );
  const preview = previewQuery.data;
  const previewPending = useMemo(
    () => JSON.stringify(debouncedDraft) !== JSON.stringify(draft),
    [debouncedDraft, draft],
  );

  // Effective columns: the server-computed combined space when joined, else the
  // source dataset's.
  const columns: Column[] = useMemo(() => {
    // R129 — when the previewed definition has steps, the preview reports the
    // PRE-step (base) columns; the editors author against those (not the post-step
    // result the preview table shows).
    if (preview?.baseColumns) return asColumns(preview.baseColumns);
    if (!isJoined) return [...datasetColumns];
    const resolved = preview?.resolvedColumns ?? query?.resolvedColumns;
    return resolved ? asColumns(resolved) : [];
  }, [isJoined, datasetColumns, preview?.baseColumns, preview?.resolvedColumns, query?.resolvedColumns]);

  // R125 — the RESULT columns matching `previewRows`: a stepped query's preview
  // returns its POST-step columns, so the preview TABLE renders the shaped shape;
  // for a stepless query this equals `columns` (no change). The editors keep using
  // `columns` (the PRE-step space).
  const resultColumns: Column[] = useMemo(
    () => (preview?.resolvedColumns ? asColumns(preview.resolvedColumns) : columns),
    [preview?.resolvedColumns, columns],
  );

  const updateMutation = useUpdateQueryMutation();
  // R89 — promote a query-owned rel up into the governed ER (reuses the existing
  // POST /workspaces/{id}/relationships; the endpoint already dedups via 409 and
  // dtype-validates via 422).
  const promoteMutation = useCreateRelationshipMutation();

  const dirty = useMemo(
    () => (query ? JSON.stringify(draft) !== JSON.stringify(normalize(query.definition)) : false),
    [draft, query],
  );

  const err = previewQuery.error;
  const relStale = err instanceof ApiErrorThrown && err.body.code === 'relationship_stale';
  const predStale = err instanceof ApiErrorThrown && err.body.code === 'query_stale';
  // R165 W-8 — a step the engine refuses is its OWN failure, not a filter's. The two
  // shared `query_stale` and the panel had one sentence for both, so a reordered card
  // was announced as "1 filter references a column…" on a query with zero filters.
  const stepInvalid = err instanceof ApiErrorThrown && err.body.code === 'step_invalid';
  const invalidCount = invalidAtomCount(draft, columns);
  // R171 item 6 — R165 W-2. Every OTHER preview failure: an unreachable backend,
  // a 500, a dropped connection. `previewOk` has always excluded it (Save is
  // correctly off), but nothing ever SAID so, and the three symptoms it shares
  // with a rejected step — no rows, Save off, no message — are the whole
  // surface, so a dead server read as "my step is wrong".
  const previewFailed = previewQuery.isError && !relStale && !predStale && !stepInvalid;
  const previewOk = Boolean(preview) && !relStale && !predStale && !stepInvalid && !previewQuery.isError;
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
  // R125 — set the ordered transform steps (empty = a plain select query).
  const setSteps = (steps: readonly Step[]) => setDraftField({ steps: [...steps] });

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

  /** R89 FREE-FORM DEFINE — create a query-owned rel from a drawn column pair with
   *  NO governed match (`originRelationshipId: null`) and append a hop that consumes
   *  it. The resolver is origin-agnostic, so it joins exactly like a copied rel; the
   *  backend re-validates dtype-compat on the next preview. This is the gesture that
   *  finally *creates* (R87 F1 verdict) — drawing, not picking. */
  const defineJoin = (fields: RelFields) => {
    const qrel = freeFormRel(fields);
    reDraft([...readRels(draft), qrel], [...readChain(draft), { queryRelId: qrel.id, type: 'inner' }]);
  };

  /** R89 PROMOTE — push a query-owned rel up into the governed ER via the existing
   *  POST /relationships (which dedups → 409, dtype-validates → 422). On success the
   *  query-owned rel keeps running on its own copy but gains the new governed rel's
   *  id as `originRelationshipId` (provenance closes the loop; divergence now tracks
   *  it). `409 relationship_exists` / `422` surface via `promoteState` to the caller. */
  const promoteRel = (queryRelId: string) => {
    const qrel = readRels(draft).find((r) => r.id === queryRelId);
    if (!qrel || !workspaceId) return;
    promoteMutation.mutate(
      {
        workspaceId,
        body: {
          // The governed POST body keeps dataset-only field names; the query-owned rel
          // carries the polymorphic `…SourceId` values. Promote is only reachable for a
          // dataset↔dataset edge (a `qr_`-side edge is non-promotable, R91), so these are ds_.
          leftDatasetId: qrel.leftSourceId,
          leftColumn: qrel.leftColumn,
          rightDatasetId: qrel.rightSourceId,
          rightColumn: qrel.rightColumn,
          cardinality: qrel.cardinality,
        },
      },
      {
        onSuccess: (created) => {
          message.success(t('queries.builder.promoted'));
          setDraft((d) =>
            writeDef(
              d,
              readRels(d).map((r) => (r.id === queryRelId ? { ...r, originRelationshipId: created.id } : r)),
              readChain(d),
            ),
          );
        },
      },
    );
  };

  /** R89 RE-SYNC — the user's opt-in choice when a copy-on-pick rel has diverged
   *  from its origin governed rel (warn-only, never automatic — brainstorm §2):
   *  re-copy the current governed fields into the query-owned snapshot. Keyed by the
   *  query-owned rel id; the governed source is found via its `originRelationshipId`. */
  const resyncRel = (queryRelId: string) => {
    const qrel = readRels(draft).find((r) => r.id === queryRelId);
    const gov = qrel?.originRelationshipId ? governedRelById.get(qrel.originRelationshipId) : undefined;
    if (!qrel || !gov) return;
    reDraft(
      readRels(draft).map((r) =>
        r.id === queryRelId
          ? {
              ...r,
              leftSourceId: gov.leftDatasetId,
              leftColumn: gov.leftColumn,
              rightSourceId: gov.rightDatasetId,
              rightColumn: gov.rightColumn,
              cardinality: gov.cardinality,
            }
          : r,
      ),
      readChain(draft),
    );
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
        // R171 walk W-2 — a failed save was SILENT. `onSuccess` toasts and
        // leaves edit mode; `onError` did not exist, so a save that never
        // landed looked exactly like one that did, and the editor stayed open
        // with no signal. The user's next move is to navigate away believing
        // the work is stored — the one failure mode here that loses data.
        //
        // Note this is NOT the preview's dead-backend state (R165 W-2, also
        // this round): that one covers a *fetch*, and only fetches were ever
        // surfaced. The save is a MUTATION, on a different code path, and the
        // human found it by stopping the server and pressing Save rather than
        // editing a step. Stay in edit mode — the draft is still in hand and
        // retrying is one click.
        onError: () => {
          message.error(t('queries.builder.saveFailed'));
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
    // identity (for the JoinEditor — the graph-root DATASET, empty when composed)
    queryId: query?.id ?? '',
    datasetId: joinRootDatasetId,
    workspaceId,
    // The saved driving source (read-only since R166 — the picker that set it is withdrawn)
    baseSourceId,
    // working state
    draft,
    columns,
    // R125/R129 — result columns (post-step, for the preview table) + the steps setter.
    resultColumns,
    setSteps,
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
    predStale,
    stepInvalid,
    previewFailed,
    retryPreview: () => void previewQuery.refetch(),
    invalidCount,
    dirty,
    canSave,
    isSaving: updateMutation.isPending,
    // editor handlers
    setJoin,
    addJoin,
    removeJoin,
    setHopType,
    // R89 — free-form define / promote / re-sync (the canvas binds to these)
    defineJoin,
    promoteRel,
    resyncRel,
    promoteState: { pending: promoteMutation.isPending, error: promoteMutation.error },
    governedRelById,
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

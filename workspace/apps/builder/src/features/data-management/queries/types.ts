// Saved Query types (R69).
//
// Hand-aligned to the OpenAPI 3.1 contracts at
// workspace/packages/contracts/queries/* and _shared/query.yaml, and
// to the design at .agents/design/data-management/datasets/saved-query.md.
//
// A Query is the SAME predicate vocabulary the dataset detail page
// already builds — no new atom shape. `definition` reuses the shipped
// `FilterPredicate` (chip filters) + `PredicateGroups` (advanced-query
// DNF) verbatim; persistence + identity is all that's new.

import type { PredicateGroups } from '../datasets/advanced-query/types';
import type { FilterPredicate } from '../datasets/filters/types';

/** The join type for a hop (R75). `inner` keeps only matches; `left`/`right`/`full`
 *  are outer joins that keep unmatched rows (the unmatched side is NULL). */
export type JoinType = 'inner' | 'left' | 'right' | 'full';

/** R88 — a QUERY-OWNED join relationship: the same join fields as a governed
 *  `Relationship`, stored INSIDE the QueryDefinition and scoped to the query.
 *  Seeded by COPY-ON-PICK (copying a governed `rel_`, with `originRelationshipId`
 *  as provenance) or — R89 — defined free-form. The query runs on its own copy,
 *  so a governed-rel edit never breaks it. Mirrors `_shared/query.yaml#/QueryRelationship`. */
export type QueryRelationship = {
  /** Query-local id, `^qrel_[0-9a-f]{8}$`. Referenced by `JoinStep.queryRelId`. */
  id: string;
  /** R91 — the LEFT source. A hop's left is always in-graph (the tree invariant), so
   *  it is a dataset (`ds_…`) this round; `qr_` on the left is deferred (right-side-first).
   *  Renamed from `leftDatasetId` when the right side became polymorphic. */
  leftSourceId: string;
  leftColumn: string;
  /** R91 — the RIGHT source joined in: a dataset (`ds_…`) OR a saved Query (`qr_…`, a
   *  query×query join — resolved as a subquery exposing its effective columns). Renamed
   *  from `rightDatasetId` and widened to polymorphic. A `qr_` right side is always
   *  free-form (no governed origin — the governed ER stays dataset-only). */
  rightSourceId: string;
  rightColumn: string;
  cardinality: 'one_to_one' | 'one_to_many' | 'many_to_many';
  /** Provenance back-ref to the governed `rel_` copied from (null = free-form, R89; always
   *  null when `rightSourceId` is a `qr_` — no governed counterpart). */
  originRelationshipId?: string | null;
};

/** R71 — a join hop. R88: it consumes a QUERY-OWNED relationship (`queryRelId` →
 *  a `QueryRelationship` in this definition's `relationships[]`), not a governed
 *  `rel_` by id. Mirrors `_shared/query.yaml#/JoinStep`. */
export type JoinStep = {
  /** R88 — the query-owned relationship this hop consumes (id into `relationships[]`). */
  queryRelId: string;
  /** The join type (R75): inner (default) + left / right / full outer. */
  type: JoinType;
};

/** The saved predicate state — exactly what the detail page serializes
 *  from its URL (chip filters + advanced DNF + `?q=` search). Re-run
 *  verbatim on open. Mirrors `_shared/query.yaml#/QueryDefinition`.
 *  R71: an optional `join` makes the Query multi-source; a FilterPredicate's
 *  column index then refers to the EFFECTIVE (left ++ right) column space. */
export type QueryDefinition = {
  /** The `?q=` substring search, if the saved view had one. */
  q?: string | null;
  /** Chip filters — implicit AND, at most one per column. */
  filters: readonly FilterPredicate[];
  /** Advanced query in DNF — an OR of AND-groups. Empty when none. */
  advanced: PredicateGroups;
  /** R88 — the query's OWN join relationships (query-owned rels). Each `JoinStep`
   *  references one by `queryRelId`. Empty/omitted for a single-source Query.
   *  Seeded by copy-on-pick from governed `rel_`s, or free-form (R89). Mirrors
   *  `_shared/query.yaml#/QueryDefinition.relationships`. */
  relationships?: readonly QueryRelationship[];
  /** R71→R74 — an ordered tree of join hops; each references a `relationships[]`
   *  entry via `queryRelId` (R88; was a governed `relationshipId`). Omitted/empty
   *  for a single-source Query. Mirrors `_shared/query.yaml#/QueryDefinition.joins`. */
  joins?: readonly JoinStep[];
};

/** A single effective column of a Query result (name + dtype). For a join,
 *  duplicate names are collision-qualified (`Deals.id`). Mirrors the inline
 *  shape in `_shared/query.yaml#/Query/resolvedColumns`. */
export type ResolvedColumn = {
  name: string;
  dtype: 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime';
};

/** A named, saved definition that produces a (virtual) dataset.
 *  Mirrors `_shared/query.yaml#/Query`. */
export type Query = {
  /** Server-generated, `^qr_[0-9a-f]{8}$`. */
  id: string;
  /** FK → Workspace.id (the IA scope). */
  workspaceId: string;
  /** R79 — the single, canonical polymorphic DRIVING source: `ds_…` (a Dataset;
   *  the LEFT source when joined) or `qr_…` (a saved Query the Query is built ON).
   *  Completed the `datasetId → sourceId` rename; the legacy `datasetId` is gone. */
  sourceId: string;
  /** User-supplied; unique per workspace; 1–120 chars. */
  name: string;
  definition: QueryDefinition;
  /** R71 — the effective (combined, collision-qualified) columns; present
   *  whenever the definition joins (a single join, or an R73 multi-hop chain).
   *  The FE renders joined headers from it. */
  resolvedColumns?: readonly ResolvedColumn[];
  /** ISO-8601 UTC, server-stamped. */
  createdAt: string;
};

/** POST /workspaces/{id}/queries request body.
 *  R79 — the driving source is the single, required, canonical `sourceId`
 *  (`ds_ | qr_`): a `ds_` for "Save filters as Query", a `qr_` base for
 *  "Build on this query". Mirrors `queries/post.contract.yaml`. */
export type CreateQueryRequest = {
  name: string;
  /** The polymorphic driving source: `ds_…` (a dataset) or `qr_…` (a base query). */
  sourceId: string;
  definition: QueryDefinition;
};

/** R72 — PUT /queries/{id} request body. The construction surface edits a
 *  Query's DEFINITION only (join + predicates); the name is unchanged this
 *  round (rename deferred). Mirrors `queries/put.contract.yaml`. */
export type UpdateQueryRequest = {
  definition: QueryDefinition;
};

/** R72 — POST /workspaces/{id}/queries/preview request body. Runs an UNSAVED
 *  working-copy definition (the live preview), never persisted. Mirrors
 *  `queries/preview.contract.yaml`. */
export type PreviewQueryRequest = {
  /** R79 — the polymorphic driving source (required): `ds_…` (a dataset) or
   *  `qr_…` (a base query). Mirrors `queries/preview.contract.yaml`. */
  sourceId: string;
  definition: QueryDefinition;
};

/** R72 — the preview run result: the same `RowsPage` shape as a saved run,
 *  plus the server-computed `resolvedColumns` when the working copy joins
 *  (the builder needs the combined headers to render the preview table). */
export type QueryPreview = {
  rows: readonly (readonly (string | null)[])[];
  page: number;
  pageSize: number;
  total: number;
  resolvedColumns?: readonly ResolvedColumn[];
};

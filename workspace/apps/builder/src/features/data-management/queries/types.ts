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
  /** R120/R121 — ordered TRANSFORM steps applied after source/join/filter resolve
   *  (saved shaping — the "workflow" direction). Empty/omitted = a plain select
   *  query. A `kind`-discriminated union (aggregate · top_n), chained; a stepped
   *  query's `resolvedColumns` are its POST-step output. Mirrors
   *  `_shared/query.yaml#/QueryDefinition.steps`. */
  steps?: readonly Step[];
};

/** R120 — a saved aggregate transform step on a query (`GROUP BY → measures`).
 *  Mirrors `_shared/query.yaml#/AggregateStep`. */
export type AggregateStep = {
  kind: 'aggregate';
  dimensions: readonly string[];
  measures: readonly AggregateMeasure[];
};

/** R121 — order by a column, keep the first `n` (post-aggregate "top N by
 *  measure"). Mirrors `_shared/query.yaml#/TopNStep`. */
export type TopNStep = {
  kind: 'top_n';
  col: string;
  n: number;
  descending?: boolean;
};

/** R122 — a derive operand: an existing column or a literal number. */
export type DeriveOperand = { kind: 'col'; col: string } | { kind: 'const'; value: number };

/** R122 — add a column from a formula-free binary op `name = left <op> right`
 *  (op ∈ + − × ÷; `right` a column or a literal). Mirrors
 *  `_shared/query.yaml#/DeriveStep`. */
export type DeriveStep = {
  kind: 'derive';
  name: string;
  left: string;
  op: '+' | '-' | '*' | '/';
  right: DeriveOperand;
};

/** R123 — one predicate of a filter step, by effective column NAME (op vocabulary
 *  matches a source `FilterPredicate`; dtype is BE-resolved). Mirrors
 *  `_shared/query.yaml#/FilterStepPredicate`. */
export type FilterStepPredicate = {
  col: string;
  op: string;
  val?: string | number;
  min?: string | number;
  max?: string | number;
};

/** R123 — keep rows matching ALL predicates (AND) over the current columns — a
 *  post-aggregate/derive WHERE (HAVING-like). Mirrors `_shared/query.yaml#/FilterStep`. */
export type FilterStep = {
  kind: 'filter';
  predicates: readonly FilterStepPredicate[];
};

/** R141 — one ordering key of a sort step (any dtype; NULLs last both ways). */
export type SortKey = {
  col: string;
  descending?: boolean;
};

/** R141 — order the rows by one or more keys (a `top_n` without the limit —
 *  deliverable ordering); later keys tie-break. Column space unchanged. Mirrors
 *  `_shared/query.yaml#/SortStep`. */
export type SortStep = {
  kind: 'sort';
  keys: readonly SortKey[];
};

/** R141 — one output column of a select step: source `col`, optionally renamed
 *  via `name` (omitted = keep `col`'s name). */
export type SelectCol = {
  col: string;
  name?: string;
};

/** R141 — projection + rename + reorder in ONE body: the output is EXACTLY
 *  `cols` in this order, dtypes kept, named `name ?? col` (unique). A rename
 *  RE-BINDS — later steps see the new names. Mirrors
 *  `_shared/query.yaml#/SelectStep`. */
export type SelectStep = {
  kind: 'select';
  cols: readonly SelectCol[];
};

/** R144 — APPEND a `date` column holding `col` truncated to `granularity`
 *  (a report's time axis). `col` must be date/datetime at this step; the value
 *  is the period's START date (week = ISO-8601 Monday-start). Mirrors
 *  `_shared/query.yaml#/DateBucketStep`. */
export type DateBucketStep = {
  kind: 'date_bucket';
  col: string;
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  name: string;
};

/** R121/R122/R123/R141/R144 — a transform step, discriminated by `kind`. */
export type Step = AggregateStep | TopNStep | DeriveStep | FilterStep | SortStep | SelectStep | DateBucketStep;

/** A single effective column of a Query result (name + dtype). For a join,
 *  duplicate names are collision-qualified (`Deals.id`). Mirrors the inline
 *  shape in `_shared/query.yaml#/Query/resolvedColumns`.
 *  R93 — carries COLUMN PROVENANCE: the leaf dataset (`ownerSourceId`, always a
 *  `ds_`) and pre-qualification name (`sourceColumn`) the effective column traces
 *  to, so a consumer can join OFF a query's column (the canvas resolves the hop's
 *  left key to the owning leaf). Present for a 1:1-owned column; absent for a
 *  derived/aggregate column (no single owner). This RETIRES the F1 frontend mock
 *  (`provenance.ts`) — provenance now arrives on the wire. */
export type ResolvedColumn = {
  name: string;
  dtype: 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime';
  ownerSourceId?: string;
  sourceColumn?: string;
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

/** R119 — one aggregate in a `POST /queries/{id}/aggregate` request. R140
 *  vocabulary: `sum`/`avg` need a numeric `col`; `min`/`max` a numeric or
 *  date/datetime `col`; `count_distinct` any `col`; `count` omits it.
 *  Mirrors `_shared/query.yaml#/AggregateRequest`. */
export type AggregateMeasure = {
  col?: string;
  agg: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct';
};

/** R119 — an R103 dashboard filter pushed server-side: keep rows whose `column`
 *  cell is one of `values`. `null` matches a NULL/empty cell (the `(blank)`
 *  option). By effective-column NAME. */
export type AggregateFilter = {
  column: string;
  values: readonly (string | null)[];
};

/** R119 — POST /queries/{id}/aggregate request body: a stateless server-side
 *  GROUP BY over a saved query. Columns are referenced by effective NAME.
 *  R119 scope: 0-or-1 `dimensions` + exactly 1 `measures`. Mirrors
 *  `_shared/query.yaml#/AggregateRequest`. */
export type AggregateRequest = {
  /** GROUP BY columns by effective name; empty = a scalar (one row). */
  dimensions: readonly string[];
  measures: readonly AggregateMeasure[];
  /** R103 dashboard filters; omitted/empty when none active. */
  filters?: readonly AggregateFilter[];
};

/** R119 — the grouped result: output columns (dimensions then measures) +
 *  stringified rows + group count (no row cap). Mirrors
 *  `queries/aggregate.contract.yaml`. */
export type AggregateResult = {
  columns: readonly { name: string; dtype: ResolvedColumn['dtype'] }[];
  rows: readonly (readonly (string | null)[])[];
  total: number;
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
  /** R129 — the PRE-step effective columns (present only when the previewed
   *  definition has `steps`; then `resolvedColumns` are the POST-step result).
   *  The builder's join/filter editors author against these. */
  baseColumns?: readonly { name: string; dtype: ResolvedColumn['dtype'] }[];
};

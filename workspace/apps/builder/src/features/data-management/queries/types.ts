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

/** R71 — an optional join step: the Query consumes a governed Relationship
 *  to read two related datasets as one. Mirrors `_shared/query.yaml#/JoinStep`. */
export type JoinStep = {
  /** The `rel_…` edge this join consumes (its datasets + key pair). */
  relationshipId: string;
  /** MVP — inner join only (left/right/outer deferred). */
  type: 'inner';
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
  /** R71 — a SINGLE join (legacy wire field). R73 generalizes this to an
   *  ordered chain (`joins`); a length-≤1 chain is still written on this field
   *  so it stays on the R71/R72 contract until the Contract gate migrates
   *  `join` → `joins`. Read via {@link readChain} which folds either field. */
  join?: JoinStep;
  /** R73 — an ordered, linear chain of hops: `joins[0]` extends from the
   *  Query's source dataset, each subsequent hop from the previous hop's right
   *  (tail) dataset. Present (in the wire) only for a multi-hop chain (≥2);
   *  a single join still uses {@link join}. Mirrors the J-3 design seal in
   *  .agents/design/data-management/queries/multi-join.md. */
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
  /** FK → Dataset.id (the single source — D-4; the LEFT source when joined). */
  datasetId: string;
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

/** POST /workspaces/{id}/queries request body. */
export type CreateQueryRequest = {
  name: string;
  datasetId: string;
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
  datasetId: string;
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

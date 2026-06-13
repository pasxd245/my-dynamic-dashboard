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

/** The saved predicate state — exactly what the detail page serializes
 *  from its URL (chip filters + advanced DNF + `?q=` search). Re-run
 *  verbatim on open. Mirrors `_shared/query.yaml#/QueryDefinition`. */
export type QueryDefinition = {
  /** The `?q=` substring search, if the saved view had one. */
  q?: string | null;
  /** Chip filters — implicit AND, at most one per column. */
  filters: readonly FilterPredicate[];
  /** Advanced query in DNF — an OR of AND-groups. Empty when none. */
  advanced: PredicateGroups;
};

/** A named, saved definition that produces a (virtual) dataset.
 *  Mirrors `_shared/query.yaml#/Query`. */
export type Query = {
  /** Server-generated, `^qr_[0-9a-f]{8}$`. */
  id: string;
  /** FK → Workspace.id (the IA scope). */
  workspaceId: string;
  /** FK → Dataset.id (the single source — D-4). */
  datasetId: string;
  /** User-supplied; unique per workspace; 1–120 chars. */
  name: string;
  definition: QueryDefinition;
  /** ISO-8601 UTC, server-stamped. */
  createdAt: string;
};

/** POST /workspaces/{id}/queries request body. */
export type CreateQueryRequest = {
  name: string;
  datasetId: string;
  definition: QueryDefinition;
};

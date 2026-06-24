// joinGraph (R87) — the pure join-graph selectors shared by the two editors of
// the SAME working-copy `joins` tree: the hop list (`JoinEditor`) and the
// node-link canvas (`QueryCanvas`). Extracted from `JoinEditor` (R74) verbatim
// so the canvas reuses the LIST's exact eligibility + leaf rules rather than
// forking them (canvas.md Phase B — "the same eligibility/leaf rules rendered on
// a node/edge"; Round_87 risk "Eligibility/leaf logic duplication").
//
// No model, no React, no I/O — just the connected-acyclic-tree math over the
// resolved relationships. The connected-acyclic invariant is UNCHANGED.

import type { Relationship } from '@/features/data-management/relationships/types';
import type { JoinStep, QueryRelationship } from './types';

/** R89 — how a copy-on-pick query-owned rel has drifted from the governed rel it
 *  was copied from. `null` = in sync or free-form (no origin to diverge from);
 *  `removed` = the origin governed rel no longer exists; `changed` = it exists but
 *  its join fields/cardinality differ from the query's snapshot. Warn-only — the
 *  query keeps running on its own copy (R88 snapshot win); re-sync is the user's
 *  choice ([brainstorm §2](../../../../../.agents/plan/brainstorms/2026-06-19-query-owned-relationships.md)). */
export type Divergence = 'removed' | 'changed' | null;

export function relDivergence(qrel: QueryRelationship, governedById: ReadonlyMap<string, Relationship>): Divergence {
  if (!qrel.originRelationshipId) return null; // free-form — nothing to diverge from
  const gov = governedById.get(qrel.originRelationshipId);
  if (!gov) return 'removed';
  // The governed rel keeps dataset-only names (`…DatasetId`); the query-owned copy uses
  // the polymorphic `…SourceId` names (R91). A `qr_`-right edge is always free-form, so
  // it never reaches here (it has no `originRelationshipId`).
  const same =
    gov.leftDatasetId === qrel.leftSourceId &&
    gov.leftColumn === qrel.leftColumn &&
    gov.rightDatasetId === qrel.rightSourceId &&
    gov.rightColumn === qrel.rightColumn &&
    gov.cardinality === qrel.cardinality;
  return same ? null : 'changed';
}

/** The join endpoints of a query-owned `QueryRelationship` (R88; R91 — polymorphic
 *  `…SourceId`: the right side may be a `qr_`). The graph math treats ids as opaque. */
type Edge = Pick<QueryRelationship, 'leftSourceId' | 'rightSourceId'>;

/** The datasets currently in the graph: the driving root + each hop's right
 *  dataset. A hop's left is always already in the graph (the tree invariant), so
 *  root + rights is the full in-graph set. R88 — hops resolve through the query's
 *  OWN relationships (`queryRelId` → a `QueryRelationship`), not governed `rel_`s. */
export function graphDatasetIds(
  rootId: string,
  joins: readonly JoinStep[],
  qrelById: ReadonlyMap<string, Edge>,
): string[] {
  const ids = rootId ? [rootId] : [];
  for (const hop of joins) {
    const right = qrelById.get(hop.queryRelId)?.rightSourceId;
    if (right && !ids.includes(right)) ids.push(right);
  }
  return ids;
}

/** Every addable edge: a `valid` relationship that drives FROM an in-graph
 *  dataset (connected) to one NOT yet in the graph (acyclic — keeps it a tree).
 *  This is the exact set the hop list's "[+ Add a join]" offers. */
export function addEligibleRels(rels: readonly Relationship[], graphIds: readonly string[]): Relationship[] {
  return rels.filter(
    (r) => r.status === 'valid' && graphIds.includes(r.leftDatasetId) && !graphIds.includes(r.rightDatasetId),
  );
}

/** R89 — the column pair a drawn connection resolves to, oriented so the in-graph
 *  endpoint is always LEFT (the hop's left dataset must already be in the graph). */
export type ConnectFields = {
  leftSourceId: string;
  leftColumn: string;
  rightSourceId: string;
  rightColumn: string;
};

/** R92 (F1) — where an effective column traces to: the LEAF dataset that owns it
 *  (`ownerSourceId`, always a `ds_`) and the pre-qualification name on that leaf
 *  (`sourceColumn`). This is the single enabler that lets a drag OFF a query node's
 *  effective column become a legal hop left key — the resolver matches `leftSourceId`
 *  against leaf `ds_` ids (queries.py membership), never a `qr_`. A 1:1-owned column
 *  has provenance; a derived/aggregate column has none (`null`) and cannot be a left
 *  key (the documented boundary). Mocked FE-side at F1, wired at R93 (Round_92.md). */
export type ColumnProvenance = { ownerSourceId: string; sourceColumn: string };

/** Resolve an effective column to its owning leaf, or `null` when it has no single
 *  owner (derived/aggregate, or not yet known). A `ds_` column always owns itself. */
export type ProvenanceOf = (sourceId: string, column: string) => ColumnProvenance | null;

/** R89 — what a drawn canvas connection means, decided purely (no React, no I/O) so
 *  it is unit-testable without firing a React Flow drag:
 *  - `copy`   → the drawn pair matches a governed `rel_` (in the in-graph→new
 *               orientation) → copy-on-pick (`addJoin`), exactly R87's behavior;
 *  - `define` → no governed match → free-form define (`defineJoin`) after the user
 *               picks a cardinality — the gesture that finally *creates* (R89);
 *  - `invalid`→ violates the connected-acyclic tree (self / cyclic / disconnected)
 *               or is incomplete; the canvas messages the reason, mints nothing. */
export type ConnectResult =
  | { kind: 'copy'; relId: string }
  | { kind: 'define'; fields: ConnectFields }
  | { kind: 'invalid'; reason: 'self' | 'cyclic' | 'disconnected' | 'incomplete' | 'derived' };

export function resolveConnect(
  conn: {
    source?: string | null;
    sourceHandle?: string | null;
    target?: string | null;
    targetHandle?: string | null;
  },
  graphIds: readonly string[],
  governedRels: readonly Relationship[],
  // R92 (F1) — resolve a drawn endpoint's effective column to its owning leaf `ds_`.
  // Defaults to identity (every column owns itself) so the dataset↔dataset path and
  // the existing unit tests are unchanged; supplied by the canvas so a drag OFF a
  // `qr_` node's effective column rewrites the hop's LEFT to the owning leaf.
  provenanceOf: ProvenanceOf = (sourceId, column) => ({ ownerSourceId: sourceId, sourceColumn: column }),
): ConnectResult {
  const { source, sourceHandle, target, targetHandle } = conn;
  if (!source || !target || !sourceHandle || !targetHandle) return { kind: 'invalid', reason: 'incomplete' };
  if (source === target) return { kind: 'invalid', reason: 'self' };
  const srcIn = graphIds.includes(source);
  const tgtIn = graphIds.includes(target);
  if (srcIn && tgtIn) return { kind: 'invalid', reason: 'cyclic' }; // right must be NEW (acyclic)
  if (!srcIn && !tgtIn) return { kind: 'invalid', reason: 'disconnected' }; // left must be in-graph
  // Normalize: the in-graph endpoint is the hop's LEFT regardless of drag direction.
  const [left, right] = srcIn
    ? [
        { ds: source, col: sourceHandle },
        { ds: target, col: targetHandle },
      ]
    : [
        { ds: target, col: targetHandle },
        { ds: source, col: sourceHandle },
      ];
  // R92 — the LEFT (in-graph) endpoint must name a LEAF `ds_` for the resolver's
  // membership match. A `qr_` left's effective column is rewritten to its owning leaf
  // via provenance; a derived/aggregate column (no single owner) can't be a left key.
  const leftProv = provenanceOf(left.ds, left.col);
  if (!leftProv) return { kind: 'invalid', reason: 'derived' };
  const fields: ConnectFields = {
    leftSourceId: leftProv.ownerSourceId,
    leftColumn: leftProv.sourceColumn,
    rightSourceId: right.ds,
    rightColumn: right.col,
  };
  // A governed rel match (→ copy-on-pick) is only possible dataset↔dataset; a `qr_`
  // right side never matches a governed `rel_`, so it always routes to `define`
  // (free-form) — R91 query×query edges have no governed counterpart.
  const match = governedRels.find(
    (r) =>
      r.status === 'valid' &&
      r.leftDatasetId === fields.leftSourceId &&
      r.leftColumn === fields.leftColumn &&
      r.rightDatasetId === fields.rightSourceId &&
      r.rightColumn === fields.rightColumn,
  );
  return match ? { kind: 'copy', relId: match.id } : { kind: 'define', fields };
}

/** R90 — a column name that reads like a unique key (the only pre-run signal we
 *  have for cardinality inference). Exact `id`/`code`/`key`/`uuid`/`guid`/`pk`, or a
 *  `_id` / `_key` / `_code` suffix. Deliberately tight to avoid matching words that
 *  merely END in "id" (valid, void). */
const KEY_NAMES = new Set(['id', 'code', 'key', 'uuid', 'guid', 'pk']);
function isKeyLike(col: string): boolean {
  const c = col.trim().toLowerCase();
  return KEY_NAMES.has(c) || c.endsWith('_id') || c.endsWith('_key') || c.endsWith('_code');
}

/** R90 — infer a sensible default cardinality for a free-form drawn pair from the
 *  column names alone (the only signal available before a run). Cardinality is
 *  **advisory** metadata in this product — it does NOT change the join SQL (the join
 *  TYPE does), so a wrong guess is non-destructive and the user confirms/overrides it
 *  in the define modal. Heuristic:
 *  - both columns key-like (id ↔ id) → `one_to_one` (a PK↔PK extension);
 *  - exactly one key-like → `one_to_many` (the common parent-key ↔ child-FK case);
 *  - neither key-like → `many_to_many` (a non-key join can fan out — surface it so the
 *    analyst notices rather than silently assuming 1:N). */
export function inferCardinality(leftColumn: string, rightColumn: string): QueryRelationship['cardinality'] {
  const left = isKeyLike(leftColumn);
  const right = isKeyLike(rightColumn);
  if (left && right) return 'one_to_one';
  if (left || right) return 'one_to_many';
  return 'many_to_many';
}

/** A hop is a LEAF when its right dataset is no other hop's left — only leaves
 *  are removable (removing a non-leaf would orphan its descendants, R74). R88 —
 *  keyed by the hop's `queryRelId` over the query-owned relationships. */
export function isLeafHop(
  queryRelId: string,
  joins: readonly JoinStep[],
  qrelById: ReadonlyMap<string, Edge>,
): boolean {
  const leftIdsInUse = new Set<string>();
  for (const hop of joins) {
    const r = qrelById.get(hop.queryRelId);
    if (r) leftIdsInUse.add(r.leftSourceId);
  }
  const right = qrelById.get(queryRelId)?.rightSourceId;
  return right ? !leftIdsInUse.has(right) : true;
}

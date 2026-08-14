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
  // the `…SourceId` names. Both sides are datasets since R167, so every query-owned edge
  // now HAS a governed counterpart it could be promoted to.
  const same =
    gov.leftDatasetId === qrel.leftSourceId &&
    gov.leftColumn === qrel.leftColumn &&
    gov.rightDatasetId === qrel.rightSourceId &&
    gov.rightColumn === qrel.rightColumn &&
    gov.cardinality === qrel.cardinality;
  return same ? null : 'changed';
}

/** R171 item 4 — is this edge's ordered pair ALREADY governed? Then `Promote`
 *  can only fail, and the answer is the 409's own condition rather than a
 *  guess at it: `idx_relationships_pair_unique` is
 *  `(workspace_id, left_dataset_id, left_column, right_dataset_id, right_column)`,
 *  so a POST repeating that pair hits the unique index → `409
 *  relationship_exists`. Matching the same five fields here makes the gate
 *  exactly as wide as the failure.
 *
 *  Note what this is NOT: "has an `originRelationshipId`". That predicate is
 *  wrong in both directions — it misses a FREE-FORM edge drawn over a pair the
 *  governed ER happens to hold, and it catches a `removed`-divergence edge,
 *  whose origin is gone and which therefore promotes fine. `cardinality` is
 *  deliberately absent: it is not in the index, so an edge that diverged ONLY
 *  in cardinality still collides.
 *
 *  R167 removed the earlier `promotable` flag on the reasoning that "there is
 *  no longer a shape this could be offered for and then rejected". That was
 *  true of the `qr_`-side shape it was written about, and only that one. */
export function promoteWouldCollide(
  qrel: QueryRelationship,
  governedById: ReadonlyMap<string, Relationship>,
): boolean {
  for (const gov of governedById.values()) {
    if (
      gov.leftDatasetId === qrel.leftSourceId &&
      gov.leftColumn === qrel.leftColumn &&
      gov.rightDatasetId === qrel.rightSourceId &&
      gov.rightColumn === qrel.rightColumn
    ) {
      return true;
    }
  }
  return false;
}

/** The join endpoints of a query-owned `QueryRelationship` (R88). Both are datasets
 *  since R167; the graph math treats ids as opaque either way. */
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

/** An edge of the rendered source graph: the hop + its query-owned rel, plus the
 *  in-graph (node, column-handle) its LEFT anchors to. R167 dropped `promotable`: it
 *  existed to mark an edge anchored on a QUERY node as having no governed counterpart,
 *  and every node is a dataset now, so every edge is promotable. */
export type SourceGraphEdge = {
  hop: JoinStep;
  qrel: QueryRelationship;
  leftNode: string;
  leftHandle: string;
};

export type SourceGraph = {
  nodeIds: string[];
  parentOf: Map<string, string>;
  edges: SourceGraphEdge[];
  unresolved: JoinStep[];
};

/** Build the canvas node/edge graph from a query's join tree.
 *
 *  The node set is the driving **root + each hop's RIGHT source** — a hop's LEFT is
 *  **never its own node**, because the tree invariant guarantees it is already in the
 *  graph. R167 simplified this considerably: while a source could be a saved query, a
 *  hop drawn off a `qr_` node stored that query's OWNING LEAF as the left, so the edge
 *  had to be re-anchored back onto the query node that visually contained it (via wire
 *  provenance) or it would spawn an orphaned card. Every node is a dataset now, so a
 *  stored left IS a rendered node and the re-anchoring is gone. */
export function buildSourceGraph(
  rootId: string,
  joins: readonly JoinStep[],
  qrelById: ReadonlyMap<string, QueryRelationship>,
): SourceGraph {
  const nodeIds: string[] = [];
  const push = (id: string) => {
    if (id && !nodeIds.includes(id)) nodeIds.push(id);
  };
  push(rootId);
  const unresolved: JoinStep[] = [];
  const parentOf = new Map<string, string>();
  const edges: SourceGraphEdge[] = [];
  for (const hop of joins) {
    const qrel = qrelById.get(hop.queryRelId);
    if (!qrel) {
      unresolved.push(hop);
      continue;
    }
    push(qrel.rightSourceId);
    // A degenerate/disconnected left (not already in the graph) still renders as its
    // own node, preserving the prior fallback — the edge stays attached either way.
    push(qrel.leftSourceId);
    if (!parentOf.has(qrel.rightSourceId)) parentOf.set(qrel.rightSourceId, qrel.leftSourceId);
    edges.push({ hop, qrel, leftNode: qrel.leftSourceId, leftHandle: qrel.leftColumn });
  }
  return { nodeIds, parentOf, edges, unresolved };
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

/** R93 — resolve a drawn endpoint's column dtype, or `null` when unknown (data not yet
 *  loaded). Supplied by the canvas so a drawn join key can be dtype-checked at draw time. */
export type DtypeOf = (sourceId: string, column: string) => string | null;

const NUMERIC = new Set(['integer', 'float']);

/** R93 — the FE mirror of the backend join-key compatibility rule
 *  ([relationships.py](../../../../../backend/app/routers/relationships.py) `_compatible`):
 *  equal dtype, or both numeric (`integer`/`float`). **FE-lenient on unknowns** — a `null`
 *  dtype means *not-yet-loaded*, NOT *missing*, so it is NOT a mismatch (the backend stays
 *  the authoritative gate); only two KNOWN, incompatible dtypes are rejected at draw time. */
function dtypeIncompatible(a: string | null, b: string | null): boolean {
  if (!a || !b || a === b) return false;
  return !(NUMERIC.has(a) && NUMERIC.has(b));
}

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
  | { kind: 'invalid'; reason: 'self' | 'cyclic' | 'disconnected' | 'incomplete' | 'dtype_mismatch' };

export function resolveConnect(
  conn: {
    source?: string | null;
    sourceHandle?: string | null;
    target?: string | null;
    targetHandle?: string | null;
  },
  graphIds: readonly string[],
  governedRels: readonly Relationship[],
  // R93 — resolve a drawn column's dtype for the draw-time compatibility guard.
  // Defaults to unknown (no guard) so the existing unit tests are unchanged; the canvas
  // supplies it so an incompatible pair (e.g. text ↔ number) is rejected before minting.
  dtypeOf: DtypeOf = () => null,
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
  // R93 — draw-time dtype guard: reject an incompatible key pair (e.g. text ↔ number)
  // BEFORE minting, mirroring the backend's `_compatible` rule. Lenient on unknown
  // dtypes (the backend re-checks on preview/run regardless). R167 — the provenance
  // rewrite that used to sit here is gone: both endpoints are datasets, so a drawn
  // column already names its own leaf and there is no `derived` (no-single-owner) case.
  if (dtypeIncompatible(dtypeOf(left.ds, left.col), dtypeOf(right.ds, right.col)))
    return { kind: 'invalid', reason: 'dtype_mismatch' };
  const fields: ConnectFields = {
    leftSourceId: left.ds,
    leftColumn: left.col,
    rightSourceId: right.ds,
    rightColumn: right.col,
  };
  // A governed rel match routes to copy-on-pick; no match routes to free-form define.
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
 *  - LEFT key-like only (parent-key ↔ child-FK) → `one_to_many`;
 *  - RIGHT key-like only (child-FK ↔ parent-key, i.e. left-FK → right-PK) → `many_to_one`
 *    (the fact→dimension case — the directional inverse of `one_to_many`, since a
 *    relationship's sides are ordered left→right);
 *  - neither key-like → `many_to_many` (a non-key join can fan out — surface it so the
 *    analyst notices rather than silently assuming 1:N). */
export function inferCardinality(leftColumn: string, rightColumn: string): QueryRelationship['cardinality'] {
  const left = isKeyLike(leftColumn);
  const right = isKeyLike(rightColumn);
  if (left && right) return 'one_to_one';
  if (left && !right) return 'one_to_many';
  if (!left && right) return 'many_to_one';
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

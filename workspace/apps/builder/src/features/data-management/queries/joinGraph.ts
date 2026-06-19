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

export function relDivergence(
  qrel: QueryRelationship,
  governedById: ReadonlyMap<string, Relationship>,
): Divergence {
  if (!qrel.originRelationshipId) return null; // free-form — nothing to diverge from
  const gov = governedById.get(qrel.originRelationshipId);
  if (!gov) return 'removed';
  const same =
    gov.leftDatasetId === qrel.leftDatasetId &&
    gov.leftColumn === qrel.leftColumn &&
    gov.rightDatasetId === qrel.rightDatasetId &&
    gov.rightColumn === qrel.rightColumn &&
    gov.cardinality === qrel.cardinality;
  return same ? null : 'changed';
}

/** Anything with the join endpoints — a governed `Relationship` OR a query-owned
 *  `QueryRelationship` (R88; both carry left/right dataset ids). */
type Edge = Pick<QueryRelationship, 'leftDatasetId' | 'rightDatasetId'>;

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
    const right = qrelById.get(hop.queryRelId)?.rightDatasetId;
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
  leftDatasetId: string;
  leftColumn: string;
  rightDatasetId: string;
  rightColumn: string;
};

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
  | { kind: 'invalid'; reason: 'self' | 'cyclic' | 'disconnected' | 'incomplete' };

export function resolveConnect(
  conn: {
    source?: string | null;
    sourceHandle?: string | null;
    target?: string | null;
    targetHandle?: string | null;
  },
  graphIds: readonly string[],
  governedRels: readonly Relationship[],
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
  const fields: ConnectFields = {
    leftDatasetId: left.ds,
    leftColumn: left.col,
    rightDatasetId: right.ds,
    rightColumn: right.col,
  };
  const match = governedRels.find(
    (r) =>
      r.status === 'valid' &&
      r.leftDatasetId === fields.leftDatasetId &&
      r.leftColumn === fields.leftColumn &&
      r.rightDatasetId === fields.rightDatasetId &&
      r.rightColumn === fields.rightColumn,
  );
  return match ? { kind: 'copy', relId: match.id } : { kind: 'define', fields };
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
    if (r) leftIdsInUse.add(r.leftDatasetId);
  }
  const right = qrelById.get(queryRelId)?.rightDatasetId;
  return right ? !leftIdsInUse.has(right) : true;
}

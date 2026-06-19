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

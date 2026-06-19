// Chain helpers (R73).
//
// The builder works with an ORDERED chain of join hops (`JoinStep[]`); the wire
// carries it as `QueryDefinition.joins` (an ordered list — the Contract gate
// migrated `_shared/query.yaml#/QueryDefinition` from R71's single `join` to
// `joins`). The backend normalizes any legacy persisted single `join` to a
// length-1 `joins` on read, so the FE only ever sees `joins`. These two helpers
// are the one place that converts between the working chain and the wire
// definition (multi-join.md § The model, J-3).

import type { JoinStep, QueryDefinition, QueryRelationship } from './types';

/** Read a definition's chain (empty when single-source). */
export function readChain(def: QueryDefinition): JoinStep[] {
  return def.joins ? def.joins.map((h) => ({ ...h })) : [];
}

/** R88 — read a definition's query-owned relationships (empty when single-source). */
export function readRels(def: QueryDefinition): QueryRelationship[] {
  return def.relationships ? def.relationships.map((r) => ({ ...r })) : [];
}

/** Serialize a working copy back to the wire definition: `relationships` + `joins`
 *  are present only when joined (a single-source Query omits both). R88 — the two
 *  travel together; `joins[].queryRelId` indexes `relationships[]`. */
export function writeDef(
  base: Pick<QueryDefinition, 'q' | 'filters' | 'advanced'>,
  relationships: readonly QueryRelationship[],
  joins: readonly JoinStep[],
): QueryDefinition {
  const core: QueryDefinition = { q: base.q ?? null, filters: base.filters, advanced: base.advanced };
  return joins.length === 0
    ? core
    : { ...core, relationships: relationships.map((r) => ({ ...r })), joins: joins.map((h) => ({ ...h })) };
}

/** R88 — mint a query-local relationship id (`^qrel_[0-9a-f]{8}$`). */
export function newQueryRelId(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return `qrel_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** R88 — COPY-ON-PICK: snapshot a governed relationship's join fields into a new
 *  query-owned relationship, recording the origin as provenance. */
export function copyGovernedRel(rel: {
  id: string;
  leftDatasetId: string;
  leftColumn: string;
  rightDatasetId: string;
  rightColumn: string;
  cardinality: QueryRelationship['cardinality'];
}): QueryRelationship {
  return {
    id: newQueryRelId(),
    leftDatasetId: rel.leftDatasetId,
    leftColumn: rel.leftColumn,
    rightDatasetId: rel.rightDatasetId,
    rightColumn: rel.rightColumn,
    cardinality: rel.cardinality,
    originRelationshipId: rel.id,
  };
}

/** R89 — the join fields a free-form / promoted query-owned rel carries (no id, no
 *  origin). Shared by `freeFormRel` (define) and the promote `POST` body. */
export type RelFields = {
  leftDatasetId: string;
  leftColumn: string;
  rightDatasetId: string;
  rightColumn: string;
  cardinality: QueryRelationship['cardinality'];
};

/** R89 — FREE-FORM DEFINE: mint a query-owned relationship from a drawn column pair
 *  with NO governed match. `originRelationshipId` is null (it has no provenance —
 *  it was created here, not copied). The resolver is origin-agnostic, so it joins
 *  exactly like a copied rel; `promoteRel` can later give it an origin. */
export function freeFormRel(fields: RelFields): QueryRelationship {
  return { id: newQueryRelId(), ...fields, originRelationshipId: null };
}

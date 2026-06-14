// Chain helpers (R73).
//
// The builder works with an ORDERED chain of join hops (`JoinStep[]`); the wire
// carries it as `QueryDefinition.joins` (an ordered list — the Contract gate
// migrated `_shared/query.yaml#/QueryDefinition` from R71's single `join` to
// `joins`). The backend normalizes any legacy persisted single `join` to a
// length-1 `joins` on read, so the FE only ever sees `joins`. These two helpers
// are the one place that converts between the working chain and the wire
// definition (multi-join.md § The model, J-3).

import type { JoinStep, QueryDefinition } from './types';

/** Read a definition's chain (empty when single-source). */
export function readChain(def: QueryDefinition): JoinStep[] {
  return def.joins ? def.joins.map((h) => ({ ...h })) : [];
}

/** Serialize a working chain back to the wire definition: `joins` is present
 *  only when non-empty (a single-source Query omits it). */
export function writeDef(
  base: Pick<QueryDefinition, 'q' | 'filters' | 'advanced'>,
  joins: readonly JoinStep[],
): QueryDefinition {
  const core: QueryDefinition = { q: base.q ?? null, filters: base.filters, advanced: base.advanced };
  return joins.length === 0 ? core : { ...core, joins: joins.map((h) => ({ ...h })) };
}

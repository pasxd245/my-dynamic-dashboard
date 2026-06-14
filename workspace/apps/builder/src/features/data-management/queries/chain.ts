// Chain wire bridge (R73 — F1).
//
// The builder works with an ORDERED chain of join hops (`JoinStep[]`). The
// wire/contract still carries R71/R72's SINGLE `join` field; R73's Contract
// gate migrates `_shared/query.yaml#/QueryDefinition` from `join` → `joins`.
// Until then, this module is the one place that bridges the two shapes:
//
//   • readChain(def)  — fold either wire field into the working `JoinStep[]`
//                       (legacy `join` → `[join]`; `joins` used as-is; else []).
//   • writeDef(base, joins) — serialize back: a length-≤1 chain stays on the
//                       legacy `join` field (so single/single-join queries keep
//                       passing the R71/R72 wrapped contract), a multi-hop chain
//                       (≥2) writes `joins` (the genuinely-new shape, handled by
//                       the F1 ad-hoc MSW path; formalized at the Contract gate).
//
// Collapsing the bridge to `joins`-only is the Contract/Backend gate's job
// (multi-join.md § Data contract, J-3).

import type { JoinStep, QueryDefinition } from './types';

/** Fold a (possibly legacy) definition's join shape into the working chain. */
export function readChain(def: QueryDefinition): JoinStep[] {
  if (def.joins && def.joins.length > 0) return def.joins.map((h) => ({ ...h }));
  if (def.join) return [{ ...def.join }];
  return [];
}

/** Serialize a working chain back to the wire definition. A length-≤1 chain
 *  uses the legacy `join` field; a multi-hop chain uses `joins`. Exactly one of
 *  the two fields is ever present (never both), so the dirty check + contract
 *  stay unambiguous. */
export function writeDef(
  base: Pick<QueryDefinition, 'q' | 'filters' | 'advanced'>,
  joins: readonly JoinStep[],
): QueryDefinition {
  const core: QueryDefinition = { q: base.q ?? null, filters: base.filters, advanced: base.advanced };
  if (joins.length === 0) return core;
  if (joins.length === 1) return { ...core, join: { ...joins[0] } };
  return { ...core, joins: joins.map((h) => ({ ...h })) };
}

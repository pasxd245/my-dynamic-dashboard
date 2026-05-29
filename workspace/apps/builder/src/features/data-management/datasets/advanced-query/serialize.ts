// Advanced-query serialization (R51).
//
// Three conversions:
//   - groupsToParam:  DNF → JSON string for the `?aq=` URL param +
//                     TanStack cache key (the wire/transport form).
//   - groupsFromParam: `?aq=` JSON → DNF, validated against the
//                     dataset columns. Malformed input is dropped to
//                     `[]` (the FE never crashes on a bad URL — same
//                     discipline as filters/serialize.ts).
//   - groupsToText:   DNF → canonical query text (repopulates the
//                     input on deep-link / back-forward; the raw user
//                     text is NOT round-tripped, the parsed JSON is).

import type { Column, Dtype } from '../types';
import { OPS_BY_DTYPE, type FilterPredicate, type Operator } from '../filters/types';
import type { PredicateGroups } from './types';

const KNOWN_OPS: ReadonlySet<Operator> = new Set<Operator>([
  'contains', 'equals', 'ne', 'gt', 'lt', 'gte', 'lte', 'between',
  'starts_with', 'ends_with', 'before', 'after', 'is_empty',
  'is_not_empty', 'is_null', 'is_not_null', 'is_true', 'is_false',
]);

/** DNF → JSON string for the `?aq=` param and the cache key. Empty
 *  groups serialize to `''` (no param written). */
export function groupsToParam(groups: PredicateGroups | undefined): string {
  if (!groups || groups.length === 0) return '';
  return JSON.stringify(groups);
}

/** Structural validation of one decoded atom against the dataset
 *  columns. Mirrors the BE per-atom check (col in range, op valid
 *  for the column's dtype). Returns the typed predicate or null. */
function validateAtom(raw: unknown, columns: readonly Column[]): FilterPredicate | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const col = o.col;
  const dtype = o.dtype;
  const op = o.op;
  if (typeof col !== 'number' || !Number.isInteger(col) || col < 0 || col >= columns.length) return null;
  if (columns[col].dtype !== dtype) return null;
  if (typeof op !== 'string' || !KNOWN_OPS.has(op as Operator)) return null;
  if (!OPS_BY_DTYPE[dtype as Dtype].includes(op as Operator)) return null;
  // Operand shape: trust the producer for val/min/max presence; the
  // BE re-validates. We only re-emit recognized fields.
  const out: Record<string, unknown> = { col, dtype, op };
  if ('val' in o) out.val = o.val;
  if ('min' in o) out.min = o.min;
  if ('max' in o) out.max = o.max;
  return out as unknown as FilterPredicate;
}

/** `?aq=` JSON → validated DNF. Any malformed structure → `[]`. */
export function groupsFromParam(raw: string | null, columns: readonly Column[]): PredicateGroups {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const groups: FilterPredicate[][] = [];
  for (const group of parsed) {
    if (!Array.isArray(group)) return [];
    const atoms: FilterPredicate[] = [];
    for (const atom of group) {
      const v = validateAtom(atom, columns);
      if (!v) return []; // any bad atom invalidates the whole query
      atoms.push(v);
    }
    if (atoms.length > 0) groups.push(atoms);
  }
  return groups;
}

// ─── DNF → canonical text ───────────────────────────────────────────

function prefixForOp(op: Operator): string {
  switch (op) {
    case 'contains':
      return '~';
    case 'ne':
      return '!=';
    case 'gt':
    case 'after':
      return '>';
    case 'lt':
    case 'before':
      return '<';
    case 'gte':
      return '>=';
    case 'lte':
      return '<=';
    default:
      return '';
  }
}

function quoteIfNeeded(s: string): string {
  return /\s/.test(s) ? `"${s}"` : s;
}

function atomToText(p: FilterPredicate, columns: readonly Column[]): string {
  // Quote the key if the column name has whitespace, so the
  // canonical text round-trips back through the parser (which reads
  // quoted keys for spaced/unicode column names).
  const key = quoteIfNeeded(columns[p.col]?.name ?? `col${p.col}`);
  if (p.dtype === 'boolean') {
    return `${key}:${p.op === 'is_true' ? 'true' : 'false'}`;
  }
  const prefix = prefixForOp(p.op);
  const val = 'val' in p ? String(p.val) : '';
  return `${key}:${prefix}${quoteIfNeeded(val)}`;
}

/** DNF → canonical query text. Groups joined by ` OR `, atoms by
 *  ` AND `. Deterministic — used to repopulate the input from the
 *  URL `aq` param (not the raw user text). */
export function groupsToText(groups: PredicateGroups, columns: readonly Column[]): string {
  return groups
    .map((group) => group.map((p) => atomToText(p, columns)).join(' AND '))
    .join(' OR ');
}

// URL ↔ FilterSet serialization (R40).
//
// Reads/writes `f<N>_op` / `f<N>_val` / `f<N>_min` / `f<N>_max`
// query params per the R38 contract:
//   workspace/packages/contracts/datasets/rows-get.contract.yaml.
//
// Invalid keys (unknown op, wrong dtype, unparseable value, N
// out of range) are silently dropped on parse — the FE never
// crashes on a malformed URL. The BE returns 422 on the actual
// request; the FE keeps the URL as the user's source of truth.

import type { Column } from '../types';
import {
  OPERAND_SHAPE,
  OPS_BY_DTYPE,
  type FilterPredicate,
  type FilterSet,
  type Operator,
} from './types';

const KEY_RE = /^f(\d+)_(op|val|min|max)$/;

/** All operators known to the FE — used as a guard during parse. */
const KNOWN_OPS: ReadonlySet<Operator> = new Set<Operator>([
  'contains',
  'equals',
  'ne',
  'gt',
  'lt',
  'gte',
  'lte',
  'between',
  'starts_with',
  'ends_with',
  'before',
  'after',
  'is_empty',
  'is_not_empty',
  'is_null',
  'is_not_null',
  'is_true',
  'is_false',
]);

function parseNumeric(raw: string): number | undefined {
  if (raw.trim().length === 0) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function buildPredicate(
  colIndex: number,
  column: Column,
  op: Operator,
  val: string | undefined,
  min: string | undefined,
  max: string | undefined,
): FilterPredicate | undefined {
  // Validate op vs dtype.
  if (!OPS_BY_DTYPE[column.dtype].includes(op)) return undefined;

  const shape = OPERAND_SHAPE[op];

  if (shape === 'none') {
    // Operand-less ops. Build the right narrow variant.
    if (op === 'is_null' || op === 'is_not_null') {
      return { col: colIndex, dtype: column.dtype, op } as FilterPredicate;
    }
    if (column.dtype === 'boolean' && (op === 'is_true' || op === 'is_false')) {
      return { col: colIndex, dtype: 'boolean', op } as FilterPredicate;
    }
    if (column.dtype === 'string' && (op === 'is_empty' || op === 'is_not_empty')) {
      return { col: colIndex, dtype: 'string', op } as FilterPredicate;
    }
    return undefined;
  }

  if (shape === 'single') {
    if (val === undefined) return undefined;
    if (column.dtype === 'string') {
      if (op === 'contains' || op === 'equals' || op === 'starts_with' || op === 'ends_with') {
        return { col: colIndex, dtype: 'string', op, val };
      }
      return undefined;
    }
    if (column.dtype === 'integer' || column.dtype === 'float') {
      const n = parseNumeric(val);
      if (n === undefined) return undefined;
      if (op === 'equals' || op === 'ne' || op === 'gt' || op === 'lt' || op === 'gte' || op === 'lte') {
        return { col: colIndex, dtype: column.dtype, op, val: n };
      }
      return undefined;
    }
    if (column.dtype === 'date' || column.dtype === 'datetime') {
      if (op === 'equals' || op === 'ne' || op === 'before' || op === 'after') {
        return { col: colIndex, dtype: column.dtype, op, val };
      }
      return undefined;
    }
    return undefined;
  }

  // shape === 'range' (`between`)
  if (min === undefined || max === undefined) return undefined;
  if (column.dtype === 'integer' || column.dtype === 'float') {
    const lo = parseNumeric(min);
    const hi = parseNumeric(max);
    if (lo === undefined || hi === undefined) return undefined;
    return { col: colIndex, dtype: column.dtype, op: 'between', min: lo, max: hi };
  }
  if (column.dtype === 'date' || column.dtype === 'datetime') {
    return { col: colIndex, dtype: column.dtype, op: 'between', min, max };
  }
  return undefined;
}

/** Parse `f<N>_*` query params into a `FilterSet`. Invalid params
 *  are silently dropped — caller never crashes on a malformed URL. */
export function parseFiltersFromSearchParams(
  params: URLSearchParams,
  columns: readonly Column[],
): FilterSet {
  // Group by column index.
  const byIndex = new Map<number, { op?: string; val?: string; min?: string; max?: string }>();
  for (const [key, value] of params.entries()) {
    const m = KEY_RE.exec(key);
    if (!m) continue;
    const n = Number(m[1]);
    const field = m[2] as 'op' | 'val' | 'min' | 'max';
    const entry = byIndex.get(n) ?? {};
    entry[field] = value;
    byIndex.set(n, entry);
  }

  const out: FilterPredicate[] = [];
  for (const [n, fields] of byIndex) {
    if (n >= columns.length) continue;
    const op = fields.op;
    if (!op) continue;
    if (!KNOWN_OPS.has(op as Operator)) continue;
    const p = buildPredicate(n, columns[n], op as Operator, fields.val, fields.min, fields.max);
    if (p) out.push(p);
  }

  // Sort by column index for stable equality + URL key ordering.
  out.sort((a, b) => a.col - b.col);
  return out;
}

/** Strip all existing `f<N>_*` keys from `params` and write the new
 *  set in sorted-by-N order. Mutates `params` in place. */
export function serializeFiltersToSearchParams(
  params: URLSearchParams,
  filters: FilterSet,
): void {
  // Strip first — preserves non-filter params (page, page_size, q).
  const toDelete: string[] = [];
  for (const key of params.keys()) {
    if (KEY_RE.test(key)) toDelete.push(key);
  }
  // URLSearchParams.delete removes all entries for a key; iterating
  // the keys first and deleting after avoids the live-iteration trap.
  for (const k of toDelete) params.delete(k);

  // Write in sorted-by-N order. `filters` is already sorted by
  // `parseFiltersFromSearchParams` and by the hook's apply path;
  // sort defensively here too.
  const sorted = [...filters].sort((a, b) => a.col - b.col);
  for (const p of sorted) {
    const n = p.col;
    params.set(`f${n}_op`, p.op);
    if ('val' in p) params.set(`f${n}_val`, String(p.val));
    if ('min' in p) params.set(`f${n}_min`, String(p.min));
    if ('max' in p) params.set(`f${n}_max`, String(p.max));
  }
}

/** Stable string serialization for the TanStack query key. Sorting
 *  is already enforced by the parser/serializer; this just produces
 *  a deterministic JSON string. */
export function cacheKeyForFilters(filters: FilterSet | undefined): string {
  if (!filters || filters.length === 0) return '';
  return JSON.stringify(filters);
}

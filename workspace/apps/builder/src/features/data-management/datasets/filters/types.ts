// Per-column filter types (R40).
//
// Mirror of:
//   - .agents/design/data-management/dataset-filters.md
//     § Predicate vocabulary table (authoritative cross-stack spec)
//   - workspace/packages/contracts/datasets/rows-get.contract.yaml
//     § f<N>_* params (wire contract)
//   - workspace/apps/backend/app/ingest/filters.py OPS_BY_DTYPE
//     (BE-side mirror)
//
// Operator name discipline: URL-form keys (`gte`, `ne`, `lte`,
// `starts_with`, …) — not the display glyphs. Display labels live
// in i18n keys `datasets.filters.op.<key>`.

import type { Dtype } from '../types';

export type Operator =
  | 'contains'
  | 'equals'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'between'
  | 'starts_with'
  | 'ends_with'
  | 'before'
  | 'after'
  | 'is_empty'
  | 'is_not_empty'
  | 'is_null'
  | 'is_not_null'
  | 'is_true'
  | 'is_false';

/**
 * Discriminated union of filter predicates. Each variant carries the
 * operator + the operand shape it expects. `col` is the 0-based index
 * into `Dataset.columns[]`.
 *
 * The shared `is_null` / `is_not_null` variant accepts any dtype (the
 * BE evaluates `IS NULL` for all dtypes).
 */
export type FilterPredicate =
  | { col: number; dtype: 'string'; op: 'contains' | 'equals' | 'ne' | 'starts_with' | 'ends_with'; val: string }
  | { col: number; dtype: 'string'; op: 'is_empty' | 'is_not_empty' }
  | { col: number; dtype: 'integer' | 'float'; op: 'equals' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte'; val: number }
  | { col: number; dtype: 'integer' | 'float'; op: 'between'; min: number; max: number }
  | { col: number; dtype: 'date' | 'datetime'; op: 'equals' | 'ne' | 'before' | 'after' | 'gte' | 'lte'; val: string }
  | { col: number; dtype: 'date' | 'datetime'; op: 'between'; min: string; max: string }
  | { col: number; dtype: 'boolean'; op: 'is_true' | 'is_false' }
  | { col: number; dtype: Dtype; op: 'is_null' | 'is_not_null' };

export type FilterSet = readonly FilterPredicate[];

/** Per-dtype allowed-operator sets. Mirrors the BE `OPS_BY_DTYPE`
 *  and the R37 predicate-vocabulary table. Vocabulary integrity is
 *  asserted via a unit test paired with the BE-side test. */
export const OPS_BY_DTYPE: Readonly<Record<Dtype, readonly Operator[]>> = {
  string: [
    'contains',
    'equals',
    'ne',
    'starts_with',
    'ends_with',
    'is_empty',
    'is_not_empty',
    'is_null',
    'is_not_null',
  ],
  integer: ['equals', 'ne', 'gt', 'lt', 'gte', 'lte', 'between', 'is_null', 'is_not_null'],
  float: ['equals', 'ne', 'gt', 'lt', 'gte', 'lte', 'between', 'is_null', 'is_not_null'],
  date: ['equals', 'ne', 'before', 'after', 'gte', 'lte', 'between', 'is_null', 'is_not_null'],
  datetime: ['equals', 'ne', 'before', 'after', 'gte', 'lte', 'between', 'is_null', 'is_not_null'],
  boolean: ['is_true', 'is_false', 'is_null', 'is_not_null'],
};

/** Operand shape per operator. Drives the editor's input rendering. */
export const OPERAND_SHAPE: Readonly<Record<Operator, 'single' | 'range' | 'none'>> = {
  contains: 'single',
  equals: 'single',
  ne: 'single',
  gt: 'single',
  lt: 'single',
  gte: 'single',
  lte: 'single',
  starts_with: 'single',
  ends_with: 'single',
  before: 'single',
  after: 'single',
  between: 'range',
  is_empty: 'none',
  is_not_empty: 'none',
  is_null: 'none',
  is_not_null: 'none',
  is_true: 'none',
  is_false: 'none',
};

/** Default operator for a fresh popover-open on a column of `dtype`. */
export function defaultOperator(dtype: Dtype): Operator {
  return OPS_BY_DTYPE[dtype][0];
}

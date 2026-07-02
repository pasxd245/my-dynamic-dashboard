// R125 — FE column-threading for transform steps (a small mirror of the backend
// `_step_plan` / `_aggregate_output_columns`). Pure functions so the step editor
// can offer the right column choices AT each step and show the final result
// shape, without a round-trip. The BACKEND remains the source of truth (it
// re-validates on preview/save); this is just for the authoring UX.

import type { Column } from '@/features/data-management/datasets/types';
import type { AggregateStep, Step } from './types';

const NUMERIC = new Set(['integer', 'float']);
export const isNumericCol = (c: Column): boolean => NUMERIC.has(c.dtype);

// R140 — min/max order any ORDERABLE column: numeric or date/datetime.
const ORDERABLE = new Set(['integer', 'float', 'date', 'datetime']);
export const isOrderableCol = (c: Column): boolean => ORDERABLE.has(c.dtype);

/** The output columns of an aggregate step given its input columns. R140 measure
 *  dtypes mirror the backend: `sum`/`min`/`max` keep the col's dtype; `avg` is
 *  `float`; `count`/`count_distinct` are `integer`; `count` is named `count`. */
function aggregateOutput(step: AggregateStep, cols: readonly Column[]): Column[] {
  const byName = new Map(cols.map((c) => [c.name, c]));
  const out: Column[] = step.dimensions.map((d) => byName.get(d) ?? { name: d, dtype: 'string' });
  for (const m of step.measures) {
    if (m.agg === 'count') out.push({ name: 'count', dtype: 'integer' });
    else if (m.agg === 'count_distinct') out.push({ name: m.col ?? '', dtype: 'integer' });
    else if (m.agg === 'avg') out.push({ name: m.col ?? '', dtype: 'float' });
    else out.push({ name: m.col ?? '', dtype: byName.get(m.col ?? '')?.dtype ?? 'float' });
  }
  return out;
}

/** The output columns of one step given its input columns (mirrors the backend:
 *  aggregate reshapes, derive appends a float, top_n/filter preserve). */
export function stepOutput(step: Step, cols: readonly Column[]): Column[] {
  switch (step.kind) {
    case 'aggregate':
      return aggregateOutput(step, cols);
    case 'derive':
      return [...cols, { name: step.name, dtype: 'float' }];
    case 'top_n':
    case 'filter':
      return [...cols];
  }
}

/** Thread the column space through an ordered step list. Returns the columns
 *  ENTERING each step (index-aligned with `steps`) + the FINAL output columns.
 *  `base` is the pre-step effective space. */
export function threadColumns(
  base: readonly Column[],
  steps: readonly Step[],
): { entering: Column[][]; final: Column[] } {
  const entering: Column[][] = [];
  let cur: Column[] = [...base];
  for (const step of steps) {
    entering.push(cur);
    cur = stepOutput(step, cur);
  }
  return { entering, final: cur };
}

/** A blank step of the given kind, defaulted from the columns available at that
 *  point (first categorical → dimension, first numeric → measure/operand). */
export function blankStep(kind: Step['kind'], cols: readonly Column[]): Step {
  const numeric = cols.filter(isNumericCol);
  const categorical = cols.filter((c) => !isNumericCol(c));
  const firstNum = numeric[0]?.name ?? '';
  switch (kind) {
    case 'aggregate':
      return {
        kind: 'aggregate',
        dimensions: categorical[0] ? [categorical[0].name] : [],
        measures: [numeric[0] ? { col: firstNum, agg: 'sum' } : { agg: 'count' }],
      };
    case 'derive':
      return { kind: 'derive', name: 'new_column', left: firstNum, op: '-', right: { kind: 'const', value: 0 } };
    case 'top_n':
      return { kind: 'top_n', col: (numeric[0] ?? cols[0])?.name ?? '', n: 10, descending: true };
    case 'filter':
      return { kind: 'filter', predicates: [{ col: cols[0]?.name ?? '', op: 'equals', val: '' }] };
  }
}

export const STEP_KINDS: readonly Step['kind'][] = ['aggregate', 'derive', 'filter', 'top_n'];

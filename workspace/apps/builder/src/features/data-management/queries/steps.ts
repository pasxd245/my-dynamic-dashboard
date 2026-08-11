// R125 — FE column-threading for transform steps (a small mirror of the backend
// `_step_plan` / `_aggregate_output_columns`). Pure functions so the step editor
// can offer the right column choices AT each step and show the final result
// shape, without a round-trip. The BACKEND remains the source of truth (it
// re-validates on preview/save); this is just for the authoring UX.

import type { Column } from '@/features/data-management/datasets/types';
import type { AggregateMeasure, AggregateStep, GroupColumnStep, Step } from './types';

const NUMERIC = new Set(['integer', 'float']);
export const isNumericCol = (c: Column): boolean => NUMERIC.has(c.dtype);

// R140 — min/max order any ORDERABLE column: numeric or date/datetime.
const ORDERABLE = new Set(['integer', 'float', 'date', 'datetime']);
export const isOrderableCol = (c: Column): boolean => ORDERABLE.has(c.dtype);

// R144 — a date_bucket step buckets only temporal columns.
const TEMPORAL = new Set(['date', 'datetime']);
export const isTemporalCol = (c: Column): boolean => TEMPORAL.has(c.dtype);

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
 *  aggregate reshapes, derive appends a float, date_bucket appends a date (R144),
 *  top_n/sort/filter preserve, select re-binds — projection + rename + reorder,
 *  R141). */
export function stepOutput(step: Step, cols: readonly Column[]): Column[] {
  switch (step.kind) {
    case 'aggregate':
      return aggregateOutput(step, cols);
    case 'derive':
      return [...cols, { name: step.name, dtype: 'float' }];
    case 'date_bucket':
      return [...cols, { name: step.name, dtype: 'date' }];
    case 'select': {
      const byName = new Map(cols.map((c) => [c.name, c]));
      return step.cols.map((s) => ({
        name: s.name ?? s.col,
        dtype: byName.get(s.col)?.dtype ?? 'string',
      }));
    }
    case 'group_column':
      return [...cols, { name: step.name, dtype: groupColumnDtype(step, cols) }];
    case 'top_n':
    case 'sort':
    case 'filter':
      return [...cols];
  }
}

/** R162 — the appended column's dtype, mirroring the backend measure rules
 *  exactly (`_aggregate_output_columns`): `avg` → float; `count`/`count_distinct`
 *  → integer; `sum`/`min`/`max` keep the source column's dtype. */
function groupColumnDtype(step: GroupColumnStep, cols: readonly Column[]): Column['dtype'] {
  if (step.agg === 'count' || step.agg === 'count_distinct') return 'integer';
  if (step.agg === 'avg') return 'float';
  return cols.find((c) => c.name === step.col)?.dtype ?? 'float';
}

/** R162 — what ONE ROW means at step position `index`, derived from the step list
 *  ALONE (no data, no wire field). This is what makes the pooled-vs-average-of-
 *  groups choice legible: a within-group column placed BEFORE a collapsing
 *  `aggregate` works over source rows, placed AFTER it works over grouped rows,
 *  and the caller renders the difference in words.
 *
 *  Returns `null` when no collapsing aggregate precedes the position (one row =
 *  one source row); otherwise the nearest preceding aggregate's dimensions,
 *  carried through any later `select` renames and projections — so the sentence
 *  names columns the user can actually see. An empty array means the rows ARE
 *  grouped but every dimension was projected away. */
export function grainAt(steps: readonly Step[], index: number): readonly string[] | null {
  let grain: string[] | null = null;
  for (const step of steps.slice(0, index)) {
    if (step.kind === 'aggregate') {
      grain = [...step.dimensions];
    } else if (step.kind === 'select' && grain) {
      const renamed = new Map(step.cols.map((c) => [c.col, c.name ?? c.col]));
      grain = grain.map((g) => renamed.get(g)).filter((g): g is string => g !== undefined);
    }
  }
  return grain;
}

/** R162 — the columns a `group_column`'s `col` picker may offer for a given agg.
 *  The same dtype rules as a collapsing measure: `sum`/`avg` numeric,
 *  `min`/`max` orderable, `count_distinct` anything, `count` no column at all. */
export function groupColumnPool(agg: AggregateMeasure['agg'], cols: readonly Column[]): readonly Column[] {
  if (agg === 'sum' || agg === 'avg') return cols.filter(isNumericCol);
  if (agg === 'min' || agg === 'max') return cols.filter(isOrderableCol);
  return cols;
}

/** R163 — the two card states R162's F1 deferred, computed from the threaded
 *  column space alone. They exist because the REORDER gesture is the affordance:
 *  moving a Group value card up past an `aggregate` can leave its `col` / `within
 *  each` columns non-existent at the new position, and the move is allowed to
 *  happen (never trap the user mid-thought) — so the card has to say so.
 *
 *  `orphaned` lists every referenced column missing at this position;
 *  `collision` is `name` already existing here (the backend's `column_exists`).
 *  This MIRRORS the server's `_plan_group_column` guards rather than replacing
 *  them — the backend still re-validates on preview/save, which is what keeps
 *  `[Save]` disabled; this only names the offender at the card. */
export function groupColumnIssues(
  step: GroupColumnStep,
  cols: readonly Column[],
): { orphaned: readonly string[]; collision: boolean } {
  const names = new Set(cols.map((c) => c.name));
  const referenced = step.agg === 'count' ? [...step.by] : [step.col ?? '', ...step.by];
  return {
    orphaned: [...new Set(referenced.filter((c) => c !== '' && !names.has(c)))],
    collision: names.has(step.name),
  };
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
    case 'sort':
      return { kind: 'sort', keys: [{ col: cols[0]?.name ?? '', descending: false }] };
    case 'select':
      return { kind: 'select', cols: cols.map((c) => ({ col: c.name })) };
    case 'date_bucket':
      return {
        kind: 'date_bucket',
        col: cols.find(isTemporalCol)?.name ?? '',
        granularity: 'week',
        name: 'bucket',
      };
    case 'group_column':
      // R162 — default to "average of the first numeric, within the first
      // categorical": the shape of the question this step exists to answer.
      return {
        kind: 'group_column',
        name: 'group_value',
        agg: numeric[0] ? 'avg' : 'count',
        col: numeric[0]?.name,
        by: categorical[0] ? [categorical[0].name] : [],
      };
  }
}

export const STEP_KINDS: readonly Step['kind'][] = [
  'aggregate',
  // R162 — sits next to `aggregate`: same vocabulary, opposite row-count effect.
  'group_column',
  'derive',
  'date_bucket',
  'filter',
  'top_n',
  'sort',
  'select',
];

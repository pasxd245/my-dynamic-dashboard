// R125 — FE column-threading for transform steps (a small mirror of the backend
// `_step_plan` / `_aggregate_output_columns`). Pure functions so the step editor
// can offer the right column choices AT each step and show the final result
// shape, without a round-trip. The BACKEND remains the source of truth (it
// re-validates on preview/save); this is just for the authoring UX.

import type { Column } from '@/features/data-management/datasets/types';
import type { AggregateMeasure, AggregateStep, GroupColumnStep, Step, WindowColumnStep, WindowOp } from './types';

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
    case 'window_column':
      return [...cols, { name: step.name, dtype: windowColumnDtype(step, cols) }];
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

/** R164 — the appended column's dtype. `pct_of_total` is a RATIO (0..1) so it is
 *  always float; `rank` is an ordinal integer; `running_total` and `prior_period`
 *  carry the source column's dtype (a running sum of integers is still an integer,
 *  and a previous period's value is the same kind of thing as the value). */
function windowColumnDtype(step: WindowColumnStep, cols: readonly Column[]): Column['dtype'] {
  if (step.op === 'pct_of_total') return 'float';
  if (step.op === 'rank') return 'integer';
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

/** R164 — the row-NARROWING steps that precede position `index`, by the columns
 *  they narrow on. This is the second half of "what does one row mean here", and
 *  it is the half that was invisible: R163 demonstrated on real data that moving a
 *  `filter` ABOVE a within-group card collapses its denominator (every rate reads
 *  100.0%) while `grainAt` — which tracks only the nearest collapsing `aggregate`
 *  — changed no words on screen.
 *
 *  `filter` and `top_n` both drop rows, so both count; `sort` and `select` do not.
 *  Only the steps since the nearest preceding `aggregate` are reported, because a
 *  collapsing aggregate re-forms the groups: a filter BEFORE it narrowed the rows
 *  that were summarised, which the grain sentence already covers, while a filter
 *  AFTER it narrows the rows this card groups over — the case that bites. */
export function narrowedBy(steps: readonly Step[], index: number): readonly string[] {
  const narrowing: string[] = [];
  for (const step of steps.slice(0, index)) {
    if (step.kind === 'aggregate') {
      // R165 walk T3 (W-6) — a collapsing aggregate re-forms the groups, so the
      // narrowing above it is normally the grain sentence's business, not this
      // clause's. It is NOT, when the narrowed column is also a DIMENSION of that
      // aggregate: `filter outcome = connected` then `group by agent, outcome`
      // leaves exactly one row per group, so every within-group value equals the
      // row's own and every share reads 100% — measured identical to the
      // filter-after arrangement on real data. The grain sentence names
      // "agent × outcome" but never says `outcome` now holds a single value, so it
      // does not cover the case its own rationale claimed. Those columns survive
      // the reset; a filter on a NON-dimension still clears, per R164's rule.
      const dims = new Set(step.dimensions);
      const kept = narrowing.filter((c) => dims.has(c));
      narrowing.length = 0;
      narrowing.push(...kept);
    } else if (step.kind === 'filter') narrowing.push(...step.predicates.map((p) => p.col));
    else if (step.kind === 'top_n') narrowing.push(step.col);
  }
  return [...new Set(narrowing.filter(Boolean))];
}

/** R164 — the columns a `window_column`'s VALUE picker may offer. `pct_of_total`
 *  and `running_total` sum, so they need numeric; `prior_period` just carries a
 *  value forward, so any dtype works; `rank` has no value column at all. */
export function windowColumnPool(op: WindowOp, cols: readonly Column[]): readonly Column[] {
  if (op === 'rank') return [];
  if (op === 'prior_period') return cols;
  return cols.filter(isNumericCol);
}

/** R164 — the columns a `window_column`'s ORDER key may offer. `prior_period`
 *  orders by a period axis, so only temporal columns qualify (its producer is
 *  `date_bucket`); the others order by anything. `pct_of_total` has no order. */
export function windowOrderPool(op: WindowOp, cols: readonly Column[]): readonly Column[] {
  if (op === 'pct_of_total') return [];
  if (op === 'prior_period') return cols.filter(isTemporalCol);
  return cols;
}

/** R164 — can this op be OFFERED at this position? The standing D4 rule is
 *  offer-nothing at the gesture, never an error at run: an op whose required
 *  columns don't exist here is disabled with a reason, not left to 422. */
export function windowOpAvailable(op: WindowOp, cols: readonly Column[]): boolean {
  if (op === 'rank') return windowOrderPool(op, cols).length > 0;
  if (op === 'pct_of_total') return windowColumnPool(op, cols).length > 0;
  return windowColumnPool(op, cols).length > 0 && windowOrderPool(op, cols).length > 0;
}

/** R164 — the same two reorder-created states `groupColumnIssues` computes, over
 *  this family's own field set (the value column, the order keys, and the group
 *  columns are all references that a move can orphan). */
export function windowColumnIssues(
  step: WindowColumnStep,
  cols: readonly Column[],
): { orphaned: readonly string[]; collision: boolean } {
  const names = new Set(cols.map((c) => c.name));
  const referenced = [
    ...(step.op === 'rank' ? [] : [step.col ?? '']),
    ...(step.orderBy ?? []).map((k) => k.col),
    ...step.by,
  ];
  return {
    orphaned: [...new Set(referenced.filter((c) => c !== '' && !names.has(c)))],
    collision: names.has(step.name),
  };
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
export function blankStep(kind: Step['kind'], cols: readonly Column[], op?: WindowOp): Step {
  if (kind === 'window_column') return blankWindowStep(op ?? 'pct_of_total', cols);
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
    case 'derive': {
      // R165 walk T1 — a fresh card used to read `new_column = count − 0`, which is
      // a complete-looking arithmetic sentence, so the operand-kind toggle beside it
      // went unnoticed (the human's words: "hard to recognize"). When a SECOND
      // numeric column exists, column−column is what this step is reached for on a
      // windowed chain (`count − prev_count`), so default to that pair: R164's "a
      // default that already carries a claim", applied to the older card. The LAST
      // numeric wins because a just-appended column is the one being compared
      // against. One numeric column → the literal, unchanged.
      const other = [...numeric].reverse().find((c) => c.name !== firstNum);
      return {
        kind: 'derive',
        name: 'new_column',
        left: firstNum,
        op: '-',
        right: other ? { kind: 'col', col: other.name } : { kind: 'const', value: 0 },
      };
    }
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

/** R164 — a blank ordered-window step. The DEFAULT NAME describes the operation
 *  (`revenue_share`, `revenue_running`, `rank`, `prev_revenue`) rather than the
 *  generic `new_column` / `bucket` / `group_value` the older steps use. R163's
 *  hand-use produced a column called `rate` holding a call count and a `delta`
 *  holding an average, and the product agreed all the way to a dashboard-ready
 *  table; a default that already carries a claim is the cheapest push away from
 *  the user typing one that lies. It is a DEFAULT, not a rule — any name is still
 *  allowed, and no name validator is built (parked by the human, R163). */
function blankWindowStep(op: WindowOp, cols: readonly Column[]): WindowColumnStep {
  // Prefer the SHAPE the op is usually reaching for — a number to carry forward,
  // a time axis to walk along — before falling back to whatever is eligible. A
  // legal-but-useless default ("the previous period's `agent`") is a card the
  // user has to undo before they can start.
  const valuePool = windowColumnPool(op, cols);
  const orderPool = windowOrderPool(op, cols);
  const col = (valuePool.find(isNumericCol) ?? valuePool[0])?.name;
  const orderCol = (orderPool.find(isTemporalCol) ?? orderPool[0])?.name;
  const categorical = cols.filter((c) => !isNumericCol(c));
  return {
    kind: 'window_column',
    op,
    name: defaultWindowName(op, col),
    col,
    by: categorical[0] ? [categorical[0].name] : [],
    // `pct_of_total` REJECTS an order key — omit it rather than send an empty
    // list, so the wire shape matches the op's contract from the first render.
    ...(op === 'pct_of_total' ? {} : { orderBy: orderCol ? [{ col: orderCol, descending: false }] : [] }),
    ...(op === 'prior_period' ? { unit: 'month' as const } : {}),
  };
}

/** R164 — the op-derived default column name (see `blankWindowStep`). */
export function defaultWindowName(op: WindowOp, col: string | undefined): string {
  if (op === 'rank') return 'rank';
  if (!col) return op;
  if (op === 'pct_of_total') return `${col}_share`;
  if (op === 'running_total') return `${col}_running`;
  return `prev_${col}`;
}

/** R165 — how many rows this step's output column is NULL in, for a
 *  `prior_period` card. The value is read off the SHAPED preview the builder
 *  already holds — no wire field, no extra request.
 *
 *  It exists because BLANK MEANS TWO THINGS: "there was no previous period" and
 *  "the previous period's value was itself empty" render identically, and only the
 *  first must not read as a data problem. Rather than mark the cell — which would
 *  push presentation into a compute step and need a per-cell wire signal the rows
 *  response does not carry — the card counts them and says so.
 *
 *  Returns null when the column is not in the result at all (a later `select` may
 *  have dropped or renamed it), because a count we cannot stand behind is worse
 *  than no count.
 *
 *  R165 walk T2 — it also reports whether the rows it counted are the WHOLE
 *  result or just one page. The rows the builder holds are the current PAGE (25 of
 *  96 on the walk's own chain), so a bare "3 rows have no previous month" is a page
 *  count wearing a result count's words — the truth there is 8. The count is still
 *  worth showing (it explains the blanks you can see), so the SCOPE moves into the
 *  sentence rather than the number being dropped. Returning the flag beside the
 *  count keeps one helper with one contract: a caller cannot forget to ask. */
export function nullCountOf(
  name: string,
  result:
    | { columns: readonly Column[]; rows: readonly (readonly (string | null)[])[]; total?: number }
    | undefined,
): { count: number; partial: boolean } | null {
  if (!result) return null;
  const idx = result.columns.findIndex((c) => c.name === name);
  if (idx < 0) return null;
  const count = result.rows.reduce((n, row) => n + (row[idx] === null ? 1 : 0), 0);
  return { count, partial: result.total !== undefined && result.rows.length < result.total };
}

/** R165 walk T2 — is this card's output column ALREADY consumed by a later
 *  `derive`? The `prior_period` advisory names the next step to add, and it named
 *  it unconditionally: the human deleted the `derive` card and the line did not
 *  change, which is the definition of a scold rather than help — advice that
 *  cannot tell whether you took it.
 *
 *  Only a LATER step counts (a `derive` above this card cannot reference a column
 *  that does not exist yet), and either operand counts: `count − prev_count` and
 *  `prev_count − count` are both comparisons. A later `select` RENAME is not
 *  tracked — it would make this answer "no" and merely restore the advisory, which
 *  is the safe direction to be wrong in. */
export function consumedByDerive(steps: readonly Step[], index: number, name: string): boolean {
  return steps.slice(index + 1).some((s) => {
    if (s.kind !== 'derive') return false;
    return s.left === name || (s.right.kind === 'col' && s.right.col === name);
  });
}

/** One entry in the `[Add step ▾]` menu. R164 — the menu, not the card, is where
 *  an operation is named: four window ops behind one abstract kind label would be
 *  a findability tax on a player who is looking for the words "running total". */
export type StepChoice = Readonly<{ value: string; kind: Step['kind']; op?: WindowOp }>;

/** R164 — `[Add step ▾]` in three groups. It was a FLAT list of 8; four new
 *  entries make 12, of which five append a column — a flat twelve is a scan, not
 *  a choice. Group 2 leads with the five within-group/ordered ops because they
 *  are what a player comes looking for; `derive` and `date_bucket` follow as the
 *  older, more mechanical members of the same append-a-column family. */
export const STEP_MENU: readonly Readonly<{ group: string; items: readonly StepChoice[] }>[] = [
  { group: 'summarise', items: [{ value: 'aggregate', kind: 'aggregate' }] },
  {
    group: 'addColumn',
    items: [
      // R162 — sits next to `aggregate`: same vocabulary, opposite row-count effect.
      { value: 'group_column', kind: 'group_column' },
      { value: 'window_column:pct_of_total', kind: 'window_column', op: 'pct_of_total' },
      { value: 'window_column:running_total', kind: 'window_column', op: 'running_total' },
      { value: 'window_column:rank', kind: 'window_column', op: 'rank' },
      { value: 'window_column:prior_period', kind: 'window_column', op: 'prior_period' },
      { value: 'derive', kind: 'derive' },
      { value: 'date_bucket', kind: 'date_bucket' },
    ],
  },
  {
    group: 'shape',
    items: [
      { value: 'filter', kind: 'filter' },
      { value: 'top_n', kind: 'top_n' },
      { value: 'sort', kind: 'sort' },
      { value: 'select', kind: 'select' },
    ],
  },
];

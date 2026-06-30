// R100 — client-side aggregation over a saved query's raw rows.
//
// No aggregation endpoint exists: `GET /queries/{id}/rows` returns raw,
// stringified cells (`RowsPage`). The dashboard fetches all rows (paged
// fetch-all) and rolls them up here, in the FE. These helpers are PURE so the
// roll-up is unit-testable independently of fetching/charting.

/** Minimal column shape shared by `Column` (dataset) and `ResolvedColumn`
 *  (joined query) — both carry a `name`. */
export type ColumnLike = { readonly name: string };

/** A column with its dtype — what the widget builder needs to default the
 *  dimension (categorical) vs measure (numeric). Both `Column` and
 *  `ResolvedColumn` satisfy it. */
export type DataColumn = { readonly name: string; readonly dtype: string };

const NUMERIC_DTYPES = new Set(['integer', 'float']);

/** Is this column numeric (a candidate measure)? */
export function isNumeric(col: DataColumn): boolean {
  return NUMERIC_DTYPES.has(col.dtype);
}

/** Default a widget's config from a query's columns: first categorical column
 *  is the dimension, first numeric column is the measure (→ `sum`); with no
 *  numeric column, fall back to counting rows (`count`). Chart defaults to bar.
 *  Pure — the builder seeds its controls with this, then the user adjusts. */
export function pickWidgetDefaults(columns: readonly DataColumn[]): {
  dimensionCol: string;
  measureCol?: string;
  agg: 'sum' | 'count';
  chartType: 'bar' | 'pie';
} {
  const numeric = columns.filter(isNumeric);
  const categorical = columns.filter((c) => !isNumeric(c));
  const dimensionCol = (categorical[0] ?? columns[0])?.name ?? '';
  if (numeric.length > 0) {
    return { dimensionCol, measureCol: numeric[0].name, agg: 'sum', chartType: 'bar' };
  }
  return { dimensionCol, agg: 'count', chartType: 'bar' };
}

/** A single chart datum: one bar / one pie slice. */
export type Datum = { readonly label: string; readonly value: number };

const BLANK_LABEL = '(blank)';

/**
 * Resolve a logical column name to its positional index in a (possibly
 * collision-qualified) column list. Matches an exact name first, else a
 * qualified name ending in `.<name>` (a joined query qualifies duplicates,
 * e.g. `Orders.amount`). Returns -1 when absent.
 */
export function findColIndex(columns: readonly ColumnLike[], name: string): number {
  const exact = columns.findIndex((c) => c.name === name);
  if (exact !== -1) return exact;
  return columns.findIndex((c) => c.name.endsWith(`.${name}`));
}

/** Parse a stringified cell to a finite number; null / '' / non-numeric → 0.
 *  (A LEFT-joined edge row — Africa, Legacy Tool — has a null measure, which
 *  must read as 0 so the group still shows, not vanish.) */
export function toNum(cell: string | null | undefined): number {
  if (cell == null || cell === '') return 0;
  const n = Number(cell);
  return Number.isFinite(n) ? n : 0;
}

function labelOf(cell: string | null | undefined): string {
  return cell == null || cell === '' ? BLANK_LABEL : cell;
}

/** Sum a numeric column per distinct value of a group column. Preserves
 *  first-seen group order; caller sorts for presentation. */
export function sumByGroup(
  rows: readonly (readonly (string | null)[])[],
  groupIdx: number,
  valueIdx: number,
): Datum[] {
  const acc = new Map<string, number>();
  for (const row of rows) {
    const key = labelOf(row[groupIdx]);
    acc.set(key, (acc.get(key) ?? 0) + toNum(row[valueIdx]));
  }
  return [...acc.entries()].map(([label, value]) => ({ label, value }));
}

/** Count rows per distinct value of a group column. */
export function countByGroup(
  rows: readonly (readonly (string | null)[])[],
  groupIdx: number,
): Datum[] {
  const acc = new Map<string, number>();
  for (const row of rows) {
    const key = labelOf(row[groupIdx]);
    acc.set(key, (acc.get(key) ?? 0) + 1);
  }
  return [...acc.entries()].map(([label, value]) => ({ label, value }));
}

/** Descending by value — the conventional bar order (largest first). */
export function sortDesc(data: readonly Datum[]): Datum[] {
  return [...data].sort((a, b) => b.value - a.value);
}

/**
 * R109 — order by the DIMENSION (the x-axis), ascending: chronological for a
 * date/datetime dimension, else lexical. A line/time chart reads left→right
 * along the axis, so value-sorting (`sortDesc`) would scramble the trend. Date
 * parsing falls back to string compare for unparseable cells (and `(blank)`).
 *
 * NOTE (data-layer signal): we parse stringified date cells in the FE here.
 * A recurring need to bucket/parse dates for a trend is a candidate to push
 * into a query/workflow (`date_trunc` + GROUP BY) rather than re-derive client-
 * side every render.
 */
export function sortByDimension(data: readonly Datum[], dtype: string): Datum[] {
  const temporal = dtype === 'date' || dtype === 'datetime';
  return [...data].sort((a, b) => {
    if (temporal) {
      const ta = Date.parse(a.label);
      const tb = Date.parse(b.label);
      if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    }
    return a.label.localeCompare(b.label);
  });
}

/**
 * R110 — a single scalar over ALL rows (the KPI value): sum of a measure, or
 * row count. Pure.
 *
 * NOTE (data-layer signal): a scalar over a CAPPED fetch is a *partial total* —
 * "total revenue" computed over the first N rows is simply wrong, not just
 * truncated. This is the sharpest case for pushing aggregation server-side (a
 * query/workflow `SUM(...)`), since the FE cannot recover the true total from a
 * capped row set. The over-cap warning matters most here.
 */
export function aggregateScalar(
  rows: readonly (readonly (string | null)[])[],
  measureIdx: number,
  agg: 'sum' | 'count',
): number {
  if (agg === 'count') return rows.length;
  if (measureIdx === -1) return 0;
  let total = 0;
  for (const row of rows) total += toNum(row[measureIdx]);
  return total;
}

/** R111 — a wide datum for a multi-series chart: a dimension label plus one
 *  numeric field per series value. */
export type WideDatum = { label: string } & Record<string, string | number>;

/**
 * R111 — 2-D roll-up: aggregate by **dimension × series** into WIDE rows for a
 * grouped bar. Returns `{ data, seriesKeys }`; each datum is
 * `{ label: <dimValue>, [seriesValue]: <agg> }`, missing cells → 0.
 *
 * NOTE (data-layer signal): this is a client-side **PIVOT** (long rows → wide
 * series columns). A recurring multi-series need pulls a **2-D server GROUP BY
 * (dimension, series)** or a pivot/crosstab workflow — the FE shouldn't
 * re-pivot the whole row set every render.
 */
export function aggregateByGroupSeries(
  rows: readonly (readonly (string | null)[])[],
  groupIdx: number,
  seriesIdx: number,
  measureIdx: number,
  agg: 'sum' | 'count',
): { data: WideDatum[]; seriesKeys: string[] } {
  const groups = new Map<string, Map<string, number>>();
  const seriesSet = new Set<string>();
  for (const row of rows) {
    const g = labelOf(row[groupIdx]);
    const s = labelOf(row[seriesIdx]);
    seriesSet.add(s);
    const inner = groups.get(g) ?? new Map<string, number>();
    inner.set(s, (inner.get(s) ?? 0) + (agg === 'count' ? 1 : toNum(row[measureIdx])));
    groups.set(g, inner);
  }
  const seriesKeys = [...seriesSet].sort((a, b) => a.localeCompare(b));
  const data: WideDatum[] = [...groups.entries()].map(([label, inner]) => {
    const d: WideDatum = { label };
    for (const k of seriesKeys) d[k] = inner.get(k) ?? 0;
    return d;
  });
  return { data, seriesKeys };
}

/** R112 — a combo datum: a dimension label with two summed measures (bar + line). */
export type ComboDatum = { label: string; v1: number; v2: number };

/**
 * R112 — sum TWO measures per dimension value (for a bar+line combo). Ordered
 * by the primary measure desc, like a bar. Pure.
 *
 * NOTE (data-layer signal): combo needs *two aggregated columns over one
 * grouping* — a query/workflow emitting `GROUP BY dim → SUM(m1), SUM(m2)`. It's
 * the multiple-MEASURES shape (vs R111's multiple-SERIES of one measure).
 */
export function sumTwoMeasures(
  rows: readonly (readonly (string | null)[])[],
  groupIdx: number,
  m1Idx: number,
  m2Idx: number,
): ComboDatum[] {
  const acc = new Map<string, { v1: number; v2: number }>();
  for (const row of rows) {
    const key = labelOf(row[groupIdx]);
    const cur = acc.get(key) ?? { v1: 0, v2: 0 };
    cur.v1 += toNum(row[m1Idx]);
    cur.v2 += toNum(row[m2Idx]);
    acc.set(key, cur);
  }
  return [...acc.entries()]
    .map(([label, { v1, v2 }]) => ({ label, v1, v2 }))
    .sort((a, b) => b.v1 - a.v1);
}

/** R113 — a scatter point: one row, two numeric axes (NOT aggregated). */
export type ScatterPoint = { x: number; y: number };

/**
 * R113 — map raw rows to scatter points (x, y) with NO aggregation — the first
 * widget shape that does not roll up.
 *
 * NOTE (data-layer signal): scatter wants **row-level** data, not a group-by.
 * The fetch cap here means the chart plots a *sample* (the first N rows), not a
 * partial aggregate — a distinct cap semantics. Pulls either a higher row
 * budget for row-level widgets or server-side **sampling** (e.g. `TABLESAMPLE`)
 * so the scatter is representative.
 */
export function toScatterPoints(
  rows: readonly (readonly (string | null)[])[],
  xIdx: number,
  yIdx: number,
): ScatterPoint[] {
  return rows.map((row) => ({ x: toNum(row[xIdx]), y: toNum(row[yIdx]) }));
}

/** R114 — a 2-D matrix for a heatmap: x/y category labels + `[xi, yi, value]`
 *  cells (the shape ECharts' heatmap series consumes). */
export type Matrix = { xs: string[]; ys: string[]; cells: [number, number, number][] };

/**
 * R114 — aggregate rows into an x × y matrix (sum of a measure, or count) for a
 * heatmap. Pure.
 *
 * NOTE (data-layer signal): a heatmap is the densest **2-D crosstab** — every
 * (x, y) cell. It's the same `GROUP BY (x, y)` pull as R111's multi-series, but
 * the full grid makes the **server pivot / crosstab** need unmistakable: the FE
 * builds the entire matrix client-side from the (capped) rows.
 */
export function aggregateMatrix(
  rows: readonly (readonly (string | null)[])[],
  xIdx: number,
  yIdx: number,
  measureIdx: number,
  agg: 'sum' | 'count',
): Matrix {
  // Key each cell on a NUL-joined (x, y) pair (cells can't contain NUL) and keep
  // x/y on the value so we never parse the key back out.
  const acc = new Map<string, { x: string; y: string; v: number }>();
  const xset = new Set<string>();
  const yset = new Set<string>();
  for (const row of rows) {
    const x = labelOf(row[xIdx]);
    const y = labelOf(row[yIdx]);
    xset.add(x);
    yset.add(y);
    const key = `${x}\u0000${y}`;
    const cur = acc.get(key) ?? { x, y, v: 0 };
    cur.v += agg === 'count' ? 1 : toNum(row[measureIdx]);
    acc.set(key, cur);
  }
  const xs = [...xset].sort((a, b) => a.localeCompare(b));
  const ys = [...yset].sort((a, b) => a.localeCompare(b));
  const xi = new Map(xs.map((v, i) => [v, i]));
  const yi = new Map(ys.map((v, i) => [v, i]));
  const cells: [number, number, number][] = [...acc.values()].map(({ x, y, v }) => [xi.get(x) ?? 0, yi.get(y) ?? 0, v]);
  return { xs, ys, cells };
}

// ─── R103 — runtime dashboard filter (client-side, categorical one-of) ───────

/** One active dashboard filter: keep rows whose `column` cell is one of
 *  `values`. Matched by NAME against each widget's columns (so the same filter
 *  applies across widgets that share the column; widgets without it are
 *  unaffected). Labels use the same `(blank)` convention as the aggregates. */
export type DashboardFilter = { readonly column: string; readonly values: readonly string[] };

/** Distinct cell labels of a column (the value-picker options); sorted, blanks
 *  shown as `(blank)`. */
export function distinctValues(rows: readonly (readonly (string | null)[])[], colIdx: number): string[] {
  const set = new Set<string>();
  for (const row of rows) set.add(labelOf(row[colIdx]));
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * Filter rows by the active dashboard filters (implicit AND across filters,
 * one-of within a filter). A filter whose column is ABSENT from `columns` is
 * skipped — the widget doesn't have that dimension, so it's unaffected (not
 * blanked). An empty value list is also skipped (a half-built filter). Pure.
 */
export function applyFilters(
  rows: readonly (readonly (string | null)[])[],
  columns: readonly ColumnLike[],
  filters: readonly DashboardFilter[],
): readonly (readonly (string | null)[])[] {
  const active = filters
    .map((f) => ({ idx: findColIndex(columns, f.column), values: new Set(f.values) }))
    .filter((f) => f.idx !== -1 && f.values.size > 0);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((f) => f.values.has(labelOf(row[f.idx]))));
}

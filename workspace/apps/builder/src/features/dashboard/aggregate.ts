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

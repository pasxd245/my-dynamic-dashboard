// R181 — table footer totals.
//
// The server sums numeric columns over the WHOLE filtered result
// (`POST /queries/{id}/totals`, post-step when the query has steps); this
// module turns a widget's `totals` spec into the column list to request and
// the footer values to show. A `ratio` total is Σnum / Σden — the rate
// re-derived from its parts (the product's conversion-rate convention), not
// the mean of the rows' rates.

import type { TotalSpec } from './types';

/** The distinct result columns a `totals` spec needs summed. */
export function totalsColumns(totals: Readonly<Record<string, TotalSpec>> | undefined): string[] {
  const out = new Set<string>();
  for (const [col, spec] of Object.entries(totals ?? {})) {
    if (spec.agg === 'sum') out.add(col);
    else {
      out.add(spec.num);
      out.add(spec.den);
    }
  }
  return [...out].sort();
}

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Footer value per spec'd column: the sum, or num / den (null when the
 *  denominator is 0 or a side is missing). */
export function computeTotals(
  totals: Readonly<Record<string, TotalSpec>> | undefined,
  sums: Readonly<Record<string, string | null>> | undefined,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (!totals || !sums) return out;
  for (const [col, spec] of Object.entries(totals)) {
    if (spec.agg === 'sum') {
      out[col] = num(sums[col]);
    } else {
      const n = num(sums[spec.num]);
      const d = num(sums[spec.den]);
      out[col] = n === null || d === null || d === 0 ? null : n / d;
    }
  }
  return out;
}

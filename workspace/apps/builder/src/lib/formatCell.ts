/**
 * R36: dtype-aware cell renderer for the dataset detail table.
 *
 * The BE stringifies cells via DuckDB `CAST(... AS VARCHAR)` (R35), so
 * every cell arrives as `string | null`. The FE re-formats per the
 * parent `Dataset.columns[].dtype`:
 *
 * - `integer` / `float` — right-aligned, `Intl.NumberFormat(locale)`.
 * - `date` — `'YYYY-MM-DD'` parsed and re-rendered locale-aware.
 * - `datetime` — `'YYYY-MM-DD HH:MM:SS'` normalized to ISO before parse.
 * - `boolean` — plain `'true'` / `'false'`.
 * - `string` — passed through; long strings truncate via CSS + a
 *   browser-native `title` attribute (no AntD `<Tooltip>` per cell at
 *   100 × 12 mounts).
 * - `null` — muted em-dash via the `nullGlyph` slot.
 */

import type { Dtype } from '@/features/data-management/datasets/types';

export type FormatCellResult = {
  /** Display text. For null, an empty string is paired with `isNull=true`. */
  text: string;
  /** True when the original value was null/undefined — callers render the muted glyph. */
  isNull: boolean;
  /** Convenience for numeric right-alignment styling. */
  isNumeric: boolean;
};

const NUMERIC: ReadonlySet<Dtype> = new Set(['integer', 'float']);

function parseDateLike(raw: string, dtype: 'date' | 'datetime'): Date | null {
  // DuckDB CAST formats:
  //  - DATE → 'YYYY-MM-DD'
  //  - TIMESTAMP → 'YYYY-MM-DD HH:MM:SS' (no timezone)
  // For the JS Date parser, ISO date-only is UTC-midnight; an ISO datetime
  // without `Z` is local time. We normalize to a stable parse:
  //  - date → keep as 'YYYY-MM-DD' (UTC-midnight is fine — we only show the
  //    date part).
  //  - datetime → replace ' ' with 'T'; do NOT append 'Z' since the BE
  //    didn't claim UTC. The resulting Date is local-time-of-day, which is
  //    what users expect when looking at their own uploaded data.
  const iso = dtype === 'datetime' ? raw.replace(' ', 'T') : raw;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatCell(
  raw: string | null,
  dtype: Dtype,
  locale: string,
): FormatCellResult {
  if (raw === null || raw === undefined) {
    return { text: '', isNull: true, isNumeric: NUMERIC.has(dtype) };
  }

  if (NUMERIC.has(dtype)) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      const fmt = new Intl.NumberFormat(locale, {
        maximumFractionDigits: dtype === 'integer' ? 0 : 6,
      });
      return { text: fmt.format(n), isNull: false, isNumeric: true };
    }
    return { text: raw, isNull: false, isNumeric: true };
  }

  if (dtype === 'date' || dtype === 'datetime') {
    const d = parseDateLike(raw, dtype);
    if (d !== null) {
      const fmt = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(dtype === 'datetime'
          ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
          : {}),
      });
      return { text: fmt.format(d), isNull: false, isNumeric: false };
    }
    return { text: raw, isNull: false, isNumeric: false };
  }

  // boolean + string: pass-through. The BE already returns 'true'/'false'
  // for booleans (DuckDB CAST default).
  return { text: raw, isNull: false, isNumeric: false };
}

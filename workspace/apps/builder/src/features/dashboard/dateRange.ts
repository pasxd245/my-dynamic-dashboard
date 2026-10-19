// R198 (item 4.2) — the view-time date range, pure rules.
//
// The SERVER resolves a SAVED preset in `backend.time_zone` on every read; the
// builder mirrors the same calendar here only for a VIEWER's pick in the bar,
// which must become two absolute dates in the URL at once (D4: the URL always
// holds absolute dates). Weeks start on Monday; `last_7_days` is today − 6 …
// today; months are calendar months.

import type { DateRangePreset } from './types';

function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

/** The absolute `{from, to}` a preset means on `today` (the browser's local
 *  day unless given). Mirrors the server's `params.resolve_range`. */
export function resolvePreset(preset: DateRangePreset, today: Date = new Date()): { from: string; to: string } {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monday = addDays(t, -((t.getDay() + 6) % 7));
  switch (preset) {
    case 'this_week':
      return { from: iso(monday), to: iso(addDays(monday, 6)) };
    case 'last_week':
      return { from: iso(addDays(monday, -7)), to: iso(addDays(monday, -1)) };
    case 'last_7_days':
      return { from: iso(addDays(t, -6)), to: iso(t) };
    case 'this_month':
      return {
        from: iso(new Date(t.getFullYear(), t.getMonth(), 1)),
        to: iso(new Date(t.getFullYear(), t.getMonth() + 1, 0)),
      };
    case 'last_month':
      return {
        from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
        to: iso(new Date(t.getFullYear(), t.getMonth(), 0)),
      };
  }
}

/** The preset a shown pair equals on `today`, if any (the bar's select shows
 *  it; otherwise "Custom"). */
export function presetOf(
  from: string | undefined,
  to: string | undefined,
  presets: readonly DateRangePreset[],
  today: Date = new Date(),
): DateRangePreset | undefined {
  if (!from || !to) return undefined;
  return presets.find((p) => {
    const r = resolvePreset(p, today);
    return r.from === from && r.to === to;
  });
}

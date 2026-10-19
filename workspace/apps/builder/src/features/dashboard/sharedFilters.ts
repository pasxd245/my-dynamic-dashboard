// R199 (item 4.3, dashboard-filters.md D4) — shared filters: the URL side.
//
// A viewer's selection for a `values` control lives in the URL as
// `?f.<controlId>=North,South` — split on `,` BEFORE percent-decoding, so a `,`
// inside a value travels as `%2C`; the raw token `~blank` is the `(blank)` option
// (a literal "~blank" travels as `%7Eblank`). `URLSearchParams` would decode
// first and re-encode on write (`,` → `%2C`, `~` → `%7E`), turning
// `North,South,~blank` into ONE literal value (BA-C2). So the dashboard page
// reads `f.*` from the RAW search string and writes EVERY URL change (a `p.*`
// change, Reset to saved, Copy link, an `f.*` change) through `writeSearch`,
// which keeps every other part's bytes as they were.

import type { AggregateFilter } from '@/features/data-management/queries/types';
import type { DashboardControl, ValuesControl } from './types';

export const F_PREFIX = 'f.';
export const P_PREFIX = 'p.';
export const BLANK_TOKEN = '~blank';

/** A viewer selection by control id; `[]` = cleared (no filter, saved NOT applied). */
export type FilterSelections = Record<string, (string | null)[]>;

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // a malformed escape stays as typed
  }
}

/** One raw `key=value` part → its decoded key (a key never carries `,`). */
function keyOf(part: string): string {
  const i = part.indexOf('=');
  return decode(i < 0 ? part : part.slice(0, i));
}

function partsOf(search: string): string[] {
  const s = search.startsWith('?') ? search.slice(1) : search;
  return s === '' ? [] : s.split('&').filter((p) => p !== '');
}

/** `f.<controlId>` keys of a RAW search string — the server's `parse_f_keys`:
 *  split before decoding; percent-decoding only (`+` is a literal plus); raw
 *  `~blank` → `null`; empty tokens ignored; a repeated key → the last wins; an
 *  empty value → `[]` (cleared). */
export function parseFilterSelections(search: string): FilterSelections {
  const out: FilterSelections = {};
  for (const part of partsOf(search)) {
    const key = keyOf(part);
    if (!key.startsWith(F_PREFIX) || key.length <= F_PREFIX.length) continue;
    const i = part.indexOf('=');
    const raw = i < 0 ? '' : part.slice(i + 1);
    out[key.slice(F_PREFIX.length)] = raw
      .split(',')
      .filter((t) => t !== '')
      .map((t) => (t === BLANK_TOKEN ? null : decode(t)));
  }
  return out;
}

/** One value as a URL token: percent-encoded, with `~` as `%7E` (so a literal
 *  "~blank" is never read as the blank token) — `encodeURIComponent` already
 *  encodes `,` and `+`. `null` → the raw `~blank`. */
export function encodeToken(v: string | null): string {
  return v === null ? BLANK_TOKEN : encodeURIComponent(v).replace(/~/g, '%7E');
}

/** A selection as the raw value of an `f.` key (`[]` → empty: cleared). */
export function encodeSelection(values: readonly (string | null)[]): string {
  return values.map(encodeToken).join(',');
}

/** The ONE raw URL writer. `set` maps a raw KEY (`p.as_of`, `f.ctl_…`) to its
 *  new raw VALUE (already encoded) or `null` to delete it; `drop` removes every
 *  key the predicate selects. Every other part keeps its bytes and its place; a
 *  set key replaces its first occurrence in place (a repeat is dropped) or is
 *  appended. Returns `?…` or `''`. */
export function writeSearch(
  search: string,
  set: Readonly<Record<string, string | null>>,
  drop?: (key: string) => boolean,
): string {
  const done = new Set<string>();
  const out: string[] = [];
  for (const part of partsOf(search)) {
    const key = keyOf(part);
    if (drop?.(key)) continue;
    if (Object.prototype.hasOwnProperty.call(set, key)) {
      if (done.has(key)) continue;
      done.add(key);
      const v = set[key];
      if (v !== null) out.push(`${encodeURIComponent(key)}=${v}`);
      continue;
    }
    out.push(part);
  }
  for (const [key, v] of Object.entries(set)) {
    if (!done.has(key) && v !== null) out.push(`${encodeURIComponent(key)}=${v}`);
  }
  return out.length ? `?${out.join('&')}` : '';
}

/** Viewer parameter values (`p.<name>`; empty = remove) through the raw writer. */
export function withParamsRaw(search: string, values: Readonly<Record<string, string | undefined>>): string {
  const set: Record<string, string | null> = {};
  for (const [name, v] of Object.entries(values)) {
    set[P_PREFIX + name] = v === undefined || v === '' ? null : encodeURIComponent(v);
  }
  return writeSearch(search, set);
}

/** One control's viewer selection: `undefined` drops the key (the saved
 *  selection applies), `[]` writes `f.<id>=` (cleared). */
export function withSelectionRaw(search: string, controlId: string, values: readonly (string | null)[] | undefined) {
  return writeSearch(search, { [F_PREFIX + controlId]: values === undefined ? null : encodeSelection(values) });
}

/** "Reset to saved": every `p.*` and `f.*` dropped, the rest kept. */
export function withoutViewerRaw(search: string): string {
  return writeSearch(search, {}, (k) => k.startsWith(P_PREFIX) || k.startsWith(F_PREFIX));
}

/** The `f.` keys naming no `values` control of the dashboard (a link copied
 *  before the control was removed — BA-C1): dropped on load, never re-pinned. */
export function staleFilterKeys(search: string, controls: readonly DashboardControl[]): string[] {
  const ids = new Set(controls.filter((c) => c.kind === 'values').map((c) => c.id));
  return Object.keys(parseFilterSelections(search)).filter((id) => !ids.has(id));
}

export function withoutStaleRaw(search: string, controls: readonly DashboardControl[]): string {
  const stale = new Set(staleFilterKeys(search, controls).map((id) => F_PREFIX + id));
  return stale.size ? writeSearch(search, {}, (k) => stale.has(k)) : search;
}

function targets(c: DashboardControl, widgetId: string): boolean {
  return c.targets === 'all' || c.targets.includes(widgetId);
}

/** The viewer's shared selections one widget's reads carry (only controls that
 *  TARGET it — a viewer value reaches only its control's targets, D4), as
 *  `RuntimeFilter` items. The saved selections are the server's to apply. */
export function sharedItemsFor(
  controls: readonly DashboardControl[],
  selections: FilterSelections,
  widgetId: string,
): AggregateFilter[] {
  return controls
    .filter((c): c is ValuesControl => c.kind === 'values' && targets(c, widgetId) && selections[c.id] !== undefined)
    .map((c) => ({ column: c.column, values: selections[c.id], control: c.id }));
}

/** The raw `&f.<id>=…` suffix of a GET `/rows` read for these items. */
export function rowsFilterSuffix(items: readonly AggregateFilter[] | undefined): string {
  return (items ?? [])
    .filter((f) => f.control)
    .map((f) => `&${F_PREFIX}${f.control}=${encodeSelection(f.values)}`)
    .join('');
}

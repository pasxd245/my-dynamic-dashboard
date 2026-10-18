// R195 (item 3.7b) — typed query parameters, builder side.
//
// The backend owns resolution (viewer → dashboard → default) and reports what it
// used (`resolvedParams`). The builder only needs three facts it can read from a
// definition: which parameters are DECLARED, which are USED (referenced by an
// operand — the backend's rule, mirrored for the dashboard reach badge), and the
// viewer values held in the URL (`p.<name>`).

import type { ParamRef, QueryDefinition, QueryParam, RelativeDate } from './types';

export const PARAM_NAME_RE = /^[a-z][a-z0-9_]{0,31}$/;
export const MAX_PARAMS = 8;
export const URL_PREFIX = 'p.';

export function isRef(v: unknown): v is ParamRef {
  return typeof v === 'object' && v !== null && typeof (v as { param?: unknown }).param === 'string';
}

function refsOf(pred: object): string[] {
  const out: string[] = [];
  for (const key of ['val', 'min', 'max'] as const) {
    const v = (pred as Record<string, unknown>)[key];
    if (isRef(v)) out.push(v.param);
  }
  const vals = (pred as { vals?: unknown }).vals;
  if (Array.isArray(vals)) for (const v of vals) if (isRef(v)) out.push(v.param);
  return out;
}

/** The parameter names a definition USES: referenced by a source filter, an
 *  advanced group, a filter step or a `case` WHEN (dashboard-filters.md D2).
 *  Only these are resolved, required and echoed by the server. */
export function usedParams(def: Pick<QueryDefinition, 'filters' | 'advanced' | 'steps'> | undefined): Set<string> {
  const out = new Set<string>();
  if (!def) return out;
  for (const p of def.filters ?? []) refsOf(p).forEach((n) => out.add(n));
  for (const g of def.advanced ?? []) for (const p of g) refsOf(p).forEach((n) => out.add(n));
  for (const s of def.steps ?? []) {
    if (s.kind === 'filter') for (const p of s.predicates) refsOf(p).forEach((n) => out.add(n));
    if (s.kind === 'case') for (const b of s.branches) for (const p of b.when) refsOf(p).forEach((n) => out.add(n));
  }
  return out;
}

/** Viewer values from a URL's `p.<name>=` entries (empty values dropped — the
 *  server treats an empty value as none, too). */
export function paramsFromSearch(search: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  search.forEach((v, k) => {
    if (k.startsWith(URL_PREFIX) && k.length > URL_PREFIX.length && v !== '') out[k.slice(URL_PREFIX.length)] = v;
  });
  return out;
}

/** A new URLSearchParams with `p.<name>` set (or removed when `value` is empty). */
export function withParam(search: URLSearchParams, name: string, value: string | undefined): URLSearchParams {
  const next = new URLSearchParams(search);
  if (value === undefined || value === '') next.delete(URL_PREFIX + name);
  else next.set(URL_PREFIX + name, value);
  return next;
}

/** The URL without any `p.*` entry ("Reset to saved"). */
export function withoutParams(search: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  search.forEach((v, k) => {
    if (!k.startsWith(URL_PREFIX)) next.append(k, v);
  });
  return next;
}

export function isRelative(v: unknown): v is RelativeDate {
  return typeof v === 'object' && v !== null && (v as { kind?: unknown }).kind === 'today';
}

/** Today in the browser's zone as `YYYY-MM-DD` (display of relative values only —
 *  the server resolves them in `backend.time_zone`). */
export function isoToday(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A parameter's display name: its label, else its name. */
export function paramTitle(p: Pick<QueryParam, 'name' | 'label'>): string {
  return p.label ?? p.name;
}

/** A fresh, unused parameter name (`param_1`, `param_2`…). */
export function nextParamName(existing: readonly QueryParam[]): string {
  const taken = new Set(existing.map((p) => p.name));
  for (let i = 1; ; i += 1) if (!taken.has(`param_${i}`)) return `param_${i}`;
}

/** Client-side check that a raw value fits a parameter type (mirrors the
 *  server's: a date is `YYYY-MM-DD`, a number ASCII decimal). */
export function valueFits(type: QueryParam['type'], raw: string): boolean {
  if (type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw));
  if (type === 'number') return /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(raw);
  return true;
}

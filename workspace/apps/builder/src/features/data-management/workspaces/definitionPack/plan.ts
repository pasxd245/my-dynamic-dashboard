// R201 (item 4.8) — the import modal's pure rules: read a chosen file, name an
// exported file, and decide what the Import button may do with a plan.

import { PACK } from '@/_generated/constants';
import type { DefinitionPack, ImportPlan, PackColumn } from './types';

/** The request cap the server enforces (`pack_invalid`, `too_large`); the
 *  builder refuses a bigger file before reading it. */
export const PACK_MAX_BYTES = PACK.MAX_BYTES;

export type PackFileRead =
  | {
      ok: true;
      /** Sent as read — the server checks the shape. */
      pack: unknown;
      packVersion: number;
      workspace: string | null;
      exportedAt: string | null;
    }
  | { ok: false; reason: 'not_json' | 'not_pack' | 'too_large' };

/** Parse a chosen file's text. A pack is a JSON object with a numeric
 *  `packVersion`; anything else is "not a definitions pack". */
export function readPackText(text: string, sizeBytes: number = text.length): PackFileRead {
  if (sizeBytes > PACK_MAX_BYTES) return { ok: false, reason: 'too_large' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not_json' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, reason: 'not_pack' };
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.packVersion !== 'number') return { ok: false, reason: 'not_pack' };
  return {
    ok: true,
    pack: parsed,
    packVersion: obj.packVersion,
    workspace: typeof obj.workspace === 'string' ? obj.workspace : null,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null,
  };
}

/** `<workspace>-definitions-<YYYY-MM-DD>.json` (the local date) — characters a file system
 *  refuses (and control characters) become `_`; letters of any script stay. */
export function packFileName(workspaceName: string, now: Date = new Date()): string {
  // eslint-disable-next-line no-control-regex
  const safe = workspaceName.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '_').trim() || 'workspace';
  // CR-5 — the user's own calendar day, not UTC's (an evening export east of UTC
  // would otherwise carry tomorrow's date).
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${safe}-definitions-${day}.json`;
}

/** How many nouns the pack carries, per kind (the export toast). */
export function packCounts(pack: DefinitionPack): { queries: number; dashboards: number; workflows: number } {
  return { queries: pack.queries.length, dashboards: pack.dashboards.length, workflows: pack.workflows.length };
}

/** The first place two column lists part (1-based): a different column, one
 *  missing here, or one here that the pack lacks. `null` when they are equal. */
export function columnDifference(
  expected: readonly PackColumn[],
  found: readonly PackColumn[],
): { position: number; expected?: PackColumn; found?: PackColumn } | null {
  const n = Math.max(expected.length, found.length);
  for (let i = 0; i < n; i += 1) {
    const e = expected[i];
    const f = found[i];
    if (!e || !f || e.name !== f.name || e.dtype !== f.dtype) return { position: i + 1, expected: e, found: f };
  }
  return null;
}

/** What an apply of this plan writes: its creates and replaces. */
export function writeCount(plan: ImportPlan): number {
  return plan.counts.create + plan.counts.replace;
}

/** Import is offered only for a plan the server would apply and that writes
 *  something. */
export function canImport(plan: ImportPlan): boolean {
  return plan.ok && writeCount(plan) > 0;
}

/** Every noun already matches the pack (or is kept, or waits for a dataset). */
export function nothingToImport(plan: ImportPlan): boolean {
  return plan.ok && writeCount(plan) === 0 && plan.items.length > 0;
}

/** The pack holds no definitions at all (BA C7 — one message, nothing else). */
export function emptyPack(plan: ImportPlan): boolean {
  return plan.items.length === 0;
}

/** The next step a blocked plan needs, one per cause (BA C5), in this order. */
export type BlockCause = 'datasets' | 'conflicts' | 'slug_taken' | 'source_differs' | 'check_failed';

export type BlockStep = {
  cause: BlockCause;
  names: string[];
  /** On `slug_taken` — the dashboard here that holds the address (BA-F3). */
  holder?: string;
  /** A stable React key. */
  key: string;
};

export function blockCauses(plan: ImportPlan): BlockStep[] {
  const out: BlockStep[] = [];
  const bad = plan.datasets.filter((d) => d.status === 'missing' || d.status === 'columns_differ').map((d) => d.name);
  if (bad.length) out.push({ cause: 'datasets', names: bad, key: 'datasets' });
  const conflicts = plan.items.filter((i) => i.action === 'conflict' && i.reason === 'exists').map((i) => i.name);
  if (conflicts.length) out.push({ cause: 'conflicts', names: conflicts, key: 'conflicts' });
  // BA-F3 — a taken address has its own step, one per dashboard: the choice cannot
  // clear it; renaming either address can.
  for (const i of plan.items) {
    if (i.action === 'conflict' && i.reason === 'slug_taken')
      out.push({ cause: 'slug_taken', names: [i.name], holder: i.via, key: `slug_taken:${i.name}` });
  }
  const sources = plan.items.filter((i) => i.reason === 'source_differs').map((i) => i.name);
  if (sources.length) out.push({ cause: 'source_differs', names: sources, key: 'source_differs' });
  const failed = plan.items.filter((i) => i.reason === 'check_failed').map((i) => i.name);
  if (failed.length) out.push({ cause: 'check_failed', names: failed, key: 'check_failed' });
  return out;
}

/** BA-F3/F9 — what Keep mine kept: a `skip` that left a noun as it is here
 *  (`kept`), apart from a dashboard left out because its address is taken here
 *  (`leftOut` — nothing of it exists here to keep). */
export function keptCounts(plan: ImportPlan): { kept: number; leftOut: number } {
  let kept = 0;
  let leftOut = 0;
  for (const i of plan.items) {
    if (i.action !== 'skip') continue;
    if (i.reason === 'slug_taken') leftOut += 1;
    else kept += 1;
  }
  return { kept, leftOut };
}

/** BA-F8 — the save check's refusal as a family the modal words in plain
 *  language; the raw line stays available under it. */
export type CheckFamily =
  | 'columns'
  | 'params'
  | 'controls'
  | 'references'
  | 'duplicateSource'
  | 'sourcesDiverge'
  | 'rules'
  | 'shape'
  | 'other';

const CHECK_FAMILIES: Record<string, CheckFamily> = {
  unknown_column: 'columns',
  filter_col_out_of_range: 'columns',
  filter_op_dtype_mismatch: 'columns',
  incompatible_join_keys: 'columns',
  column_exists: 'columns',
  wrong_dtype: 'columns',
  duplicate_group_column: 'columns',
  duplicate_output_column: 'columns',
  param_type: 'params',
  duplicate_param: 'params',
  control_without_dashboard: 'params',
  duplicate_control: 'controls',
  duplicate_column: 'controls',
  duplicate_target: 'controls',
  range_same_param: 'controls',
  range_reversed: 'controls',
  range_invalid: 'controls',
  unknown_source: 'references',
  unknown_query: 'references',
  unknown_widget: 'references',
  unknown_dataset: 'references',
  unknown_dashboard: 'references',
  unresolved_source: 'references',
  duplicate_source: 'duplicateSource',
  sources_diverge: 'sourcesDiverge',
};

export function checkFailedFamily(detail: string | undefined): { family: CheckFamily; path?: string } {
  if (!detail) return { family: 'other' };
  const code = /^([a-z][a-z0-9_]*):/.exec(detail)?.[1];
  if (code) {
    if (CHECK_FAMILIES[code]) return { family: CHECK_FAMILIES[code] };
    if (code.startsWith('relationship_') || code.startsWith('stale_')) return { family: 'columns' };
    if (code.startsWith('param_')) return { family: 'params' };
    return { family: 'rules' };
  }
  // A model error reads `definition/widgets/0/kind: …` — a part of the definition
  // this app's shape does not take.
  const path = /^([\w-]+(?:\/[\w-]+)+):/.exec(detail)?.[1];
  if (path) return { family: 'shape', path };
  return { family: 'other' };
}

/** The non-zero counts, in a fixed order (toasts and the summary line — BA C7). */
export function nonZero<K extends string>(counts: Record<K, number>, order: readonly K[]): [K, number][] {
  return order.filter((k) => counts[k] > 0).map((k) => [k, counts[k]]);
}

/** Download a pack as a file (the export action). */
export function downloadPack(pack: DefinitionPack, fileName: string): void {
  const blob = new Blob([`${JSON.stringify(pack, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

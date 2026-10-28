// R202 (item 5.2) — the three reserved frontmatter keys. The builder reads
// `title`, `summary` and `severity` to label, order and badge an entry; every
// other key stays an uninterpreted pair (the R180 rule, kept for them). An
// invalid value is not dropped: it stays in `pairs`, shown as written.

import { splitFrontmatter } from './frontmatter';
import type { MetadataEntries, MetadataEntry } from './types';

export const SEVERITIES = ['error', 'decide', 'warn', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const TITLE_MAX = 80;
export const SUMMARY_MAX = 200;

/** Lower = more serious; an entry without a severity sorts after `info`. */
export function severityRank(s: Severity | undefined): number {
  return s === undefined ? SEVERITIES.length : SEVERITIES.indexOf(s);
}

export type ReadEntry = {
  namespace: string;
  entry: MetadataEntry;
  title?: string;
  summary?: string;
  severity?: Severity;
  /** The frontmatter pairs left after the valid reserved keys are taken out. */
  pairs: [string, string][];
  body: string;
};

/** YAML-ish scalar: strip one pair of matching quotes. */
function scalar(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))))
    return t.slice(1, -1).trim();
  return t;
}

export function readEntry(namespace: string, entry: MetadataEntry): ReadEntry {
  const { pairs, body } = splitFrontmatter(entry.md);
  const out: ReadEntry = { namespace, entry, pairs: [], body };
  for (const [k, raw] of pairs) {
    const v = scalar(raw);
    if (k === 'title' && out.title === undefined && v.length >= 1 && v.length <= TITLE_MAX) out.title = v;
    else if (k === 'summary' && out.summary === undefined && v.length >= 1 && v.length <= SUMMARY_MAX) out.summary = v;
    else if (k === 'severity' && out.severity === undefined && (SEVERITIES as readonly string[]).includes(v))
      out.severity = v as Severity;
    else out.pairs.push([k, raw]);
  }
  return out;
}

/** The body's first line of prose, plain (markdown marks stripped), ≤ 200 chars —
 *  what a card shows when the writer gave no `summary`. */
export function firstLine(body: string): string {
  for (const raw of body.split(/\r?\n/)) {
    const line = raw
      .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
      .replace(/[*_~`]/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .trim();
    if (!line || /^\|?\s*:?-{2,}/.test(line) || /^(-{3,}|`{3,})/.test(raw.trim())) continue;
    // A table row reads as its cells.
    const text = line.startsWith('|')
      ? line
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean)
          .join(' · ')
      : line;
    return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1)}…` : text;
  }
  return '';
}

/** Entries read and ordered: severity (error → decide → warn → info → none), then namespace. */
export function readEntries(entries: MetadataEntries | undefined): ReadEntry[] {
  return Object.keys(entries ?? {})
    .map((ns) => readEntry(ns, (entries as MetadataEntries)[ns] as MetadataEntry))
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.namespace.localeCompare(b.namespace));
}

/** The highest severity among entries (undefined when none carries one). */
export function topSeverity(read: readonly ReadEntry[]): Severity | undefined {
  let best: Severity | undefined;
  for (const r of read) if (r.severity && severityRank(r.severity) < severityRank(best)) best = r.severity;
  return best;
}

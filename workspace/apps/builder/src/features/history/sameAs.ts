import type { HistoryEntry } from './types';

/** Each entry's seq → the seq of the newest OLDER entry with the same version
 *  (a restore, or an edit undone by hand). Entries come newest first. */
export function sameAsOf(entries: readonly HistoryEntry[]): Map<number, number> {
  const out = new Map<number, number>();
  entries.forEach((e, i) => {
    const older = entries.slice(i + 1).find((o) => o.version === e.version);
    if (older) out.set(e.seq, older.seq);
  });
  return out;
}

/** The seq of the row tagged "Current": the newest entry whose version is the
 *  noun's current version (none when no entry has it). */
export function currentSeqOf(entries: readonly HistoryEntry[], current: string): number | null {
  return entries.find((e) => e.version === current)?.seq ?? null;
}

/** BA-C1 — restoring a row that holds the current version would save nothing:
 *  Restore is offered only on rows whose version differs from the current one. */
export function canRestore(entry: HistoryEntry, current: string): boolean {
  return entry.version !== current;
}

// R200 (item 4.4) — the definition history wire shapes; hand-aligned to
// contracts/_shared/history.yaml.

export type HistoryKind = 'query' | 'dashboard' | 'workflow';
export type HistoryChange = 'create' | 'update' | 'baseline';
export type HistorySource = 'ai' | 'human' | 'system';

export type HistoryEntry = {
  seq: number;
  version: string; // 12 hex — the definition's hash (decision 14)
  change: HistoryChange;
  changedAt: string; // ISO-8601 UTC
  changedBy: string | null; // a writer token's author; null for every builder save
  changedSource: HistorySource | null; // stored, not shown yet (owner question 2)
};

export type HistoryList = {
  kind: HistoryKind;
  id: string;
  current: string; // the noun's version now
  entries: HistoryEntry[]; // newest first by seq
};

export type HistoryVersion = HistoryEntry & {
  /** The definition as stored — possibly an older shape than today's model. */
  definition: Record<string, unknown>;
  /** Queries only (BA-C2): a source dataset changed after this row was saved. */
  sourceChangedSince?: boolean;
};

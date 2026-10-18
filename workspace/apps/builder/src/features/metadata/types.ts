// R180 — read-only metadata. Hand-aligned to
// workspace/packages/contracts/_shared/metadata.yaml.

export type MetadataKind = 'dataset' | 'column' | 'relationship' | 'query' | 'workflow' | 'dashboard' | 'widget';

export type MetadataSource = 'ai' | 'human' | 'system';

/** R197 (3.8) — what a noun WAS for a writer (an entry's `anchor`) or IS for
 *  the reader (`current`). Server-built. */
export type MetadataAnchor = {
  definitionVersion: string;
  dataVersions?: Readonly<Record<string, number>>;
  queryVersions?: Readonly<Record<string, string>>;
  runId?: string;
  params?: Readonly<Record<string, string | number>>;
  /** On an entry: the parameters the writer gave no value for (saved / default stamped). */
  assumedParams?: readonly string[];
};

/** R197 — how the reader's view relates to the writer's. */
export type MetadataState = 'current' | 'refreshed' | 'other_period' | 'other_definition';

/** One writer's statement about one noun in one namespace. `author`,
 *  `source`, `writtenAt`, `definitionVersion` and `anchor` are server-stamped;
 *  `stale` and `state` are computed on read. */
export type MetadataEntry = {
  md: string;
  source: MetadataSource;
  author: string;
  writtenAt: string;
  definitionVersion: string;
  stale: boolean;
  /** Optional only for an older server (rc.2); rc.3 always sends them. */
  anchor?: MetadataAnchor;
  state?: MetadataState;
};

/** Entries keyed by namespace. */
export type MetadataEntries = Record<string, MetadataEntry>;

export type MetadataRead = {
  entries: MetadataEntries;
  /** A dataset's columns (by name) / a dashboard's widgets (by id). */
  children?: Record<string, MetadataEntries>;
  /** R197 — the reader's anchor for the noun, and for each child in `children`. */
  current?: MetadataAnchor;
  childrenCurrent?: Record<string, MetadataAnchor>;
};

/** Viewer parameter values, by name (the page's `p.<name>`). */
export type MetadataParams = Readonly<Record<string, string>>;

/** A column's noun id is `<ds_id>:<name>`; a widget's `<dsh_id>:<wdg_id>`. */
export function childNounId(parentId: string, child: string): string {
  return `${parentId}:${child}`;
}

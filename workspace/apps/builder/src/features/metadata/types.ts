// R180 — read-only metadata. Hand-aligned to
// workspace/packages/contracts/_shared/metadata.yaml.

export type MetadataKind = 'dataset' | 'column' | 'relationship' | 'query' | 'workflow' | 'dashboard' | 'widget';

export type MetadataSource = 'ai' | 'human' | 'system';

/** One writer's statement about one noun in one namespace. `author`,
 *  `source`, `writtenAt` and `definitionVersion` are server-stamped; `stale`
 *  is computed on read (the noun's definition moved after the write). */
export type MetadataEntry = {
  md: string;
  source: MetadataSource;
  author: string;
  writtenAt: string;
  definitionVersion: string;
  stale: boolean;
};

/** Entries keyed by namespace. */
export type MetadataEntries = Record<string, MetadataEntry>;

export type MetadataRead = {
  entries: MetadataEntries;
  /** A dataset's columns (by name) / a dashboard's widgets (by id). */
  children?: Record<string, MetadataEntries>;
};

/** A column's noun id is `<ds_id>:<name>`; a widget's `<dsh_id>:<wdg_id>`. */
export function childNounId(parentId: string, child: string): string {
  return `${parentId}:${child}`;
}

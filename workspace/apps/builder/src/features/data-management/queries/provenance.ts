// provenance (R92 — F1 MOCK; replaced at R93) — derive, FE-side, each effective
// column of a saved Query (`qr_`) together with the LEAF `ds_` that owns it.
//
// WHY this exists: the canvas renders a `qr_` source as a handle-bearing node so a
// user can join ANY source to any source (Round_92.md two-choice model). But a drag
// OFF a `qr_` node's effective column must become a legal hop LEFT key, and the
// resolver matches a hop's `leftSourceId` against LEAF `ds_` ids only
// (queries.py membership) — never a `qr_`. So each effective column must carry its
// owning `(ds_, sourceColumn)`; `resolveConnect` rewrites the left to that owner.
//
// WHY it's a MOCK: pre-Contract (DFCFBI F1 precedes C), the real wire add —
// `ownerSourceId` / `sourceColumn` per effective column emitted by `resolve_source`
// — lands at R93. MSW response-validation is `additionalProperties:false`, so F1
// derives the same `{ownerSourceId, sourceColumn}` map FE-side instead of reading it
// off the wire. This re-walks the query's own definition leaves the way the backend's
// `build_effective_columns` concatenates them; it is deliberately throwaway and is
// deleted when R93 puts provenance on the wire (Round_92.md § F1 prep).
//
// BOUNDARY: only a column that traces 1:1 to a single leaf `(ds_, col)` gets
// provenance. A derived/aggregate column (no single owner) gets `null` and cannot be
// a left key — there is no aggregation today, so this is documented, not exercised.

import type { Column } from '@/features/data-management/datasets/types';
import type { ColumnProvenance } from './joinGraph';
import type { Query } from './types';

/** One effective column of a `qr_` source: its display name (collision-qualified by
 *  owner-dataset name, matching the backend rule) + the leaf it traces to (or `null`
 *  when it has no single owner). */
export type EffectiveColumn = Readonly<{ name: string; owner: ColumnProvenance | null }>;

type Ctx = Readonly<{
  /** Leaf dataset columns, by `ds_` id. */
  dsColumnsById: ReadonlyMap<string, readonly Column[]>;
  /** Dataset display names, by `ds_` id — used to collision-qualify (`accounts.tier`). */
  dsNameById: ReadonlyMap<string, string>;
  /** Saved queries by `qr_` id — to recurse into a composed (`qr_`-rooted) base. */
  qrById: ReadonlyMap<string, Query>;
}>;

/** The sources a query reads, in effective-column order: the driving root first, then
 *  each hop's right source (the tree the resolver walks). Mirrors how the effective
 *  space is concatenated server-side. */
function sourceOrder(qr: Query): string[] {
  const rels = new Map((qr.definition.relationships ?? []).map((r) => [r.id, r]));
  const ids = qr.sourceId ? [qr.sourceId] : [];
  for (const hop of qr.definition.joins ?? []) {
    const right = rels.get(hop.queryRelId)?.rightSourceId;
    if (right && !ids.includes(right)) ids.push(right);
  }
  return ids;
}

/** Walk a source to its leaf-owned columns (a `ds_` owns its own; a `qr_` recurses),
 *  BEFORE collision-qualification. `visited` guards a composition cycle. */
function walkSource(sourceId: string, ctx: Ctx, visited: ReadonlySet<string>): EffectiveColumn[] {
  if (sourceId.startsWith('ds_')) {
    return (ctx.dsColumnsById.get(sourceId) ?? []).map((c) => ({
      name: c.name,
      owner: { ownerSourceId: sourceId, sourceColumn: c.name },
    }));
  }
  // A `qr_` base/right — recurse into its own leaves (its columns already carry leaf
  // owners). A cycle (or an unknown/deleted base) yields nothing → an empty node.
  if (visited.has(sourceId)) return [];
  const nested = ctx.qrById.get(sourceId);
  if (!nested) return [];
  return effectiveColumnsRaw(nested, ctx, new Set([...visited, sourceId]));
}

/** Effective columns of a query, with owners, BEFORE collision-qualification. */
function effectiveColumnsRaw(qr: Query, ctx: Ctx, visited: ReadonlySet<string>): EffectiveColumn[] {
  return sourceOrder(qr).flatMap((id) => walkSource(id, ctx, visited));
}

/** R92 F1 MOCK — the effective columns of a saved Query, each with the leaf `ds_` that
 *  owns it, collision-qualified by owner-dataset name (so a duplicate `tier` becomes
 *  `accounts.tier` / `owners.tier`, matching the server's qualified `name`). The order
 *  mirrors the backend's effective space; a single-source query (no joins) is simply
 *  its driving dataset's columns owned 1:1. */
export function effectiveColumnsWithProvenance(
  qr: Query,
  dsColumnsById: ReadonlyMap<string, readonly Column[]>,
  dsNameById: ReadonlyMap<string, string>,
  qrById: ReadonlyMap<string, Query>,
): EffectiveColumn[] {
  const ctx: Ctx = { dsColumnsById, dsNameById, qrById };
  const raw = effectiveColumnsRaw(qr, ctx, new Set([qr.id]));
  const counts = new Map<string, number>();
  for (const c of raw) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  return raw.map((c) => {
    if ((counts.get(c.name) ?? 0) <= 1 || !c.owner) return c;
    const dsName = dsNameById.get(c.owner.ownerSourceId) ?? c.owner.ownerSourceId;
    return { ...c, name: `${dsName}.${c.owner.sourceColumn}` };
  });
}

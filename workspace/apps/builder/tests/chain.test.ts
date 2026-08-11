// R162 — the working-copy ⇄ wire bridge (chain.ts). Untested until now, which is
// how `writeDef` silently dropped `steps` from R120 to R162: a saved query's
// shaping was erased the moment you clicked Edit, and the next Save persisted the
// loss. Found by hand-use, not by a gate.

import { describe, expect, it } from 'vitest';

import { readChain, readRels, readSteps, writeDef } from '@/features/data-management/queries/chain';
import type { JoinStep, QueryDefinition, QueryRelationship, Step } from '@/features/data-management/queries/types';

const AGG: Step = { kind: 'aggregate', dimensions: ['agent'], measures: [{ col: 'sec', agg: 'sum' }] };
const GROUP: Step = { kind: 'group_column', name: 'team_total', agg: 'sum', col: 'sec', by: ['team'] };

const QREL: QueryRelationship = {
  id: 'qrel_0000beef',
  leftSourceId: 'ds_aaaaaaaa',
  leftColumn: 'agent',
  rightSourceId: 'ds_bbbbbbbb',
  rightColumn: 'id',
  cardinality: 'many_to_one',
  originRelationshipId: 'rel_11112222',
};
const HOP: JoinStep = { queryRelId: QREL.id, type: 'inner' };

const base = (over: Partial<QueryDefinition> = {}): QueryDefinition => ({
  q: null,
  filters: [],
  advanced: [],
  ...over,
});

describe('R162 regression — writeDef must not drop `steps`', () => {
  it('carries steps through a single-source definition', () => {
    const out = writeDef(base({ steps: [AGG] }), [], []);
    expect(out.steps).toEqual([AGG]);
  });

  it('carries steps through a JOINED definition (alongside relationships + joins)', () => {
    const out = writeDef(base({ steps: [AGG, GROUP] }), [QREL], [HOP]);
    expect(out.steps).toEqual([AGG, GROUP]);
    expect(out.joins).toEqual([HOP]);
    expect(out.relationships).toEqual([QREL]);
  });

  it('omits `steps` when there are none — an unshaped query stays unshaped on the wire', () => {
    expect(writeDef(base(), [], [])).not.toHaveProperty('steps');
    expect(writeDef(base({ steps: [] }), [], [])).not.toHaveProperty('steps');
  });

  it('copies steps rather than aliasing the input array', () => {
    const steps = [AGG];
    const out = writeDef(base({ steps }), [], []);
    expect(out.steps).not.toBe(steps);
    expect(out.steps?.[0]).not.toBe(AGG);
  });

  // THE bug the human hit: Edit seeds the draft through this same bridge
  // (useQueryBuilder `normalize`), so a lossy round-trip means the step vanishes
  // from the editor — and the next Save writes the loss back.
  it('round-trips a saved stepped definition unchanged (the edit-mode seed path)', () => {
    const saved = base({ steps: [AGG, GROUP], relationships: [QREL], joins: [HOP] });
    const seeded = writeDef(
      { q: saved.q ?? null, filters: [...saved.filters], advanced: saved.advanced.map((g) => [...g]), steps: readSteps(saved) },
      readRels(saved),
      readChain(saved),
    );
    expect(seeded).toEqual(saved);
  });

  // The guard that would have caught this at R120. `writeDef` is a WHITELIST
  // serializer: a field added to QueryDefinition and not added here is dropped
  // silently. This fails when that happens again.
  it('handles EVERY QueryDefinition field — a new field must be added to writeDef', () => {
    const full = base({ steps: [AGG], relationships: [QREL], joins: [HOP], q: 'acme' });
    const out = writeDef(
      { q: full.q, filters: full.filters, advanced: full.advanced, steps: full.steps },
      readRels(full),
      readChain(full),
    );
    // Every key the working copy carries must survive the bridge. If a future
    // round adds a field to QueryDefinition, this assertion goes red until
    // writeDef learns about it.
    expect(Object.keys(out).sort()).toEqual(Object.keys(full).sort());
  });
});

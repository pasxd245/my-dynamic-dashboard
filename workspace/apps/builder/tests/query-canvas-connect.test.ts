// R89 — pure unit tests for the free-form canvas's decision logic, decoupled from
// React Flow's drag gesture (which is human-verified in the F1 review). These cover
// the load-bearing routing the canvas's `onConnect` delegates to:
//   resolveConnect — copy-on-pick vs. free-form define vs. invalid;
//   relDivergence  — a copied rel drifting from its origin governed rel;
//   freeFormRel    — minting a query-owned rel with no provenance.

import { describe, expect, it } from 'vitest';

import { freeFormRel } from '@/features/data-management/queries/chain';
import {
  buildSourceGraph,
  inferCardinality,
  promoteWouldCollide,
  relDivergence,
  resolveConnect,
} from '@/features/data-management/queries/joinGraph';
import type { Relationship } from '@/features/data-management/relationships/types';
import type { JoinStep, QueryRelationship } from '@/features/data-management/queries/types';

const DEALS = 'ds_11111111';
const ACCOUNTS = 'ds_22222222';
const OWNERS = 'ds_33333333';

const governed: Relationship[] = [
  {
    id: 'rel_a1b2c3d4',
    workspaceId: 'ws_aaaaaaa1',
    leftDatasetId: DEALS,
    leftColumn: 'deal_id',
    rightDatasetId: ACCOUNTS,
    rightColumn: 'account_id',
    cardinality: 'one_to_many',
    status: 'valid',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('resolveConnect (R89 — draw-to-connect routing)', () => {
  it('copies-on-pick when the drawn pair matches a governed rel (in-graph → new)', () => {
    const res = resolveConnect(
      { source: DEALS, sourceHandle: 'deal_id', target: ACCOUNTS, targetHandle: 'account_id' },
      [DEALS],
      governed,
    );
    expect(res).toEqual({ kind: 'copy', relId: 'rel_a1b2c3d4' });
  });

  it('normalizes drag direction — drawing from the NEW node back to the in-graph node still copies', () => {
    const res = resolveConnect(
      { source: ACCOUNTS, sourceHandle: 'account_id', target: DEALS, targetHandle: 'deal_id' },
      [DEALS],
      governed,
    );
    expect(res).toEqual({ kind: 'copy', relId: 'rel_a1b2c3d4' });
  });

  it('defines free-form when no governed rel links the drawn pair (the gesture that CREATES)', () => {
    const res = resolveConnect(
      { source: DEALS, sourceHandle: 'amount', target: ACCOUNTS, targetHandle: 'account_name' },
      [DEALS],
      governed,
    );
    expect(res).toEqual({
      kind: 'define',
      fields: { leftSourceId: DEALS, leftColumn: 'amount', rightSourceId: ACCOUNTS, rightColumn: 'account_name' },
    });
  });

  it('rejects a self-join (same node both ends)', () => {
    const res = resolveConnect(
      { source: DEALS, sourceHandle: 'deal_id', target: DEALS, targetHandle: 'amount' },
      [DEALS],
      governed,
    );
    expect(res).toEqual({ kind: 'invalid', reason: 'self' });
  });

  it('rejects a cyclic connection (both ends already in the graph)', () => {
    const res = resolveConnect(
      { source: DEALS, sourceHandle: 'deal_id', target: ACCOUNTS, targetHandle: 'account_id' },
      [DEALS, ACCOUNTS],
      governed,
    );
    expect(res).toEqual({ kind: 'invalid', reason: 'cyclic' });
  });

  it('rejects a disconnected connection (neither end in the graph)', () => {
    const res = resolveConnect(
      { source: ACCOUNTS, sourceHandle: 'account_id', target: OWNERS, targetHandle: 'tier' },
      [DEALS],
      governed,
    );
    expect(res).toEqual({ kind: 'invalid', reason: 'disconnected' });
  });

  it('treats a missing handle as incomplete (a stray drag, no error)', () => {
    const res = resolveConnect(
      { source: DEALS, sourceHandle: null, target: ACCOUNTS, targetHandle: 'account_id' },
      [DEALS],
      governed,
    );
    expect(res).toEqual({ kind: 'invalid', reason: 'incomplete' });
  });
});

describe('relDivergence (R89 — copied rel vs. its origin governed rel)', () => {
  const byId = new Map(governed.map((r) => [r.id, r]));

  const copied: QueryRelationship = {
    id: 'qrel_a1b2c3d4',
    leftSourceId: DEALS,
    leftColumn: 'deal_id',
    rightSourceId: ACCOUNTS,
    rightColumn: 'account_id',
    cardinality: 'one_to_many',
    originRelationshipId: 'rel_a1b2c3d4',
  };

  it('is null when the copy matches its origin', () => {
    expect(relDivergence(copied, byId)).toBeNull();
  });

  it('is null for a free-form rel (no origin to diverge from)', () => {
    expect(relDivergence({ ...copied, originRelationshipId: null }, byId)).toBeNull();
  });

  it("is 'removed' when the origin governed rel no longer exists", () => {
    expect(relDivergence(copied, new Map())).toBe('removed');
  });

  it("is 'changed' when the origin's join fields drifted from the snapshot", () => {
    expect(relDivergence({ ...copied, cardinality: 'one_to_one' }, byId)).toBe('changed');
  });
});

// R171 item 4 — the promote gate. Its whole value is being exactly as wide as
// `409 relationship_exists`, so each case below is one way the obvious-looking
// predicate ("does it have an origin?") gets the answer wrong.
describe('promoteWouldCollide (R171 — Promote is offerable only when it can succeed)', () => {
  const byId = new Map(governed.map((r) => [r.id, r]));

  const copied: QueryRelationship = {
    id: 'qrel_a1b2c3d4',
    leftSourceId: DEALS,
    leftColumn: 'deal_id',
    rightSourceId: ACCOUNTS,
    rightColumn: 'account_id',
    cardinality: 'one_to_many',
    originRelationshipId: 'rel_a1b2c3d4',
  };

  it('collides for a copy-on-picked edge still in sync — the 409 R167 believed unreachable', () => {
    expect(promoteWouldCollide(copied, byId)).toBe(true);
  });

  it('collides when ONLY the cardinality diverged — it is not part of the unique index', () => {
    // divergence === 'changed', yet the ordered column pair is unchanged, so
    // the POST still hits `idx_relationships_pair_unique`.
    const drifted: QueryRelationship = { ...copied, cardinality: 'one_to_one' };
    expect(relDivergence(drifted, byId)).toBe('changed');
    expect(promoteWouldCollide(drifted, byId)).toBe(true);
  });

  it('collides for a FREE-FORM edge drawn over a pair the governed ER already holds', () => {
    // No origin at all — "has an originRelationshipId" would call this
    // promotable, and the backend would reject it.
    expect(promoteWouldCollide({ ...copied, originRelationshipId: null }, byId)).toBe(true);
  });

  it('does NOT collide when the origin was removed — the pair is free again', () => {
    // The mirror error: "has an origin" would block a promote that succeeds.
    expect(relDivergence(copied, new Map())).toBe('removed');
    expect(promoteWouldCollide(copied, new Map())).toBe(false);
  });

  it('does NOT collide on a different column pair between the same two datasets', () => {
    const otherPair: QueryRelationship = { ...copied, leftColumn: 'stage', rightColumn: 'tier' };
    expect(promoteWouldCollide(otherPair, byId)).toBe(false);
  });

  it('is ORDER-sensitive, exactly as the index is', () => {
    const reversed: QueryRelationship = {
      ...copied,
      leftSourceId: ACCOUNTS,
      leftColumn: 'account_id',
      rightSourceId: DEALS,
      rightColumn: 'deal_id',
    };
    expect(promoteWouldCollide(reversed, byId)).toBe(false);
  });
});

describe('inferCardinality (R90 — smart default for a free-form drawn pair)', () => {
  it('infers one_to_one when BOTH columns read as keys (PK ↔ PK)', () => {
    expect(inferCardinality('account_id', 'id')).toBe('one_to_one');
    expect(inferCardinality('uuid', 'customer_id')).toBe('one_to_one');
  });

  it('infers one_to_many when only the LEFT side is key-like (parent-key ↔ child-FK)', () => {
    expect(inferCardinality('id', 'region')).toBe('one_to_many');
    expect(inferCardinality('account_id', 'region_name')).toBe('one_to_many');
  });

  it('infers many_to_one when only the RIGHT side is key-like (F12 — fact→dim, left-FK → right-PK)', () => {
    expect(inferCardinality('region', 'id')).toBe('many_to_one');
    expect(inferCardinality('deal_name', 'owner_id')).toBe('many_to_one');
  });

  it('infers many_to_many when NEITHER side is key-like (a fan-out join — surface it)', () => {
    expect(inferCardinality('region', 'region_name')).toBe('many_to_many');
    expect(inferCardinality('tier', 'segment')).toBe('many_to_many');
  });

  it('does not mistake a word merely ENDING in "id" for a key (valid, void)', () => {
    expect(inferCardinality('valid', 'segment')).toBe('many_to_many');
  });

  it('is case-insensitive on the key suffixes', () => {
    expect(inferCardinality('Account_ID', 'Region')).toBe('one_to_many');
  });
});

describe('freeFormRel (R89 — mint a query-owned rel with no provenance)', () => {
  it('records originRelationshipId: null and a qrel_ id', () => {
    const r = freeFormRel({
      leftSourceId: DEALS,
      leftColumn: 'amount',
      rightSourceId: ACCOUNTS,
      rightColumn: 'account_name',
      cardinality: 'one_to_many',
    });
    expect(r.originRelationshipId).toBeNull();
    expect(r.id).toMatch(/^qrel_[0-9a-f]{8}$/);
    expect(r.leftColumn).toBe('amount');
  });
});

// R93 (I-phase fix) — the node set is root + each hop's RIGHT; a hop's LEFT is never its
// own node. The resolver stores a LEAF as the left (inside a `qr_` when drawn off a query
// node), so the edge must anchor on that in-graph query node — NOT spawn an orphaned leaf
// card (the reported build-on-query bug: query + its underlying dataset + the added source).
describe('buildSourceGraph (R167 — datasets only, no re-anchoring)', () => {
  const hop = (queryRelId: string): JoinStep => ({ queryRelId, type: 'inner' });

  it('renders the two endpoints as nodes, the edge anchored on the stored left', () => {
    const qrel: QueryRelationship = {
      id: 'qrel_11111111',
      leftSourceId: DEALS,
      leftColumn: 'deal_id',
      rightSourceId: ACCOUNTS,
      rightColumn: 'account_id',
      cardinality: 'one_to_many',
      originRelationshipId: 'rel_a1b2c3d4',
    };
    const g = buildSourceGraph(DEALS, [hop(qrel.id)], new Map([[qrel.id, qrel]]));
    expect(g.nodeIds).toEqual([DEALS, ACCOUNTS]);
    expect(g.edges[0]).toMatchObject({ leftNode: DEALS, leftHandle: 'deal_id' });
    expect(g.parentOf.get(ACCOUNTS)).toBe(DEALS);
  });

  it('builds a 2-hop star without re-anchoring — a stored left IS a rendered node', () => {
    // Before R167 a hop drawn off a `qr_` node stored that query's OWNING LEAF as the
    // left, so the edge had to be mapped back onto the query node containing it or it
    // would spawn an orphaned card. Every node is a dataset now, so the stored left is
    // the node, and the whole `displayLeft` / wire-provenance apparatus is gone.
    const h1: QueryRelationship = {
      id: 'qrel_33333333',
      leftSourceId: DEALS,
      leftColumn: 'deal_id',
      rightSourceId: ACCOUNTS,
      rightColumn: 'account_id',
      cardinality: 'one_to_many',
      originRelationshipId: null,
    };
    const h2: QueryRelationship = {
      id: 'qrel_44444444',
      leftSourceId: ACCOUNTS,
      leftColumn: 'account_id',
      rightSourceId: OWNERS,
      rightColumn: 'account_id',
      cardinality: 'one_to_many',
      originRelationshipId: null,
    };
    const g = buildSourceGraph(
      DEALS,
      [hop(h1.id), hop(h2.id)],
      new Map([
        [h1.id, h1],
        [h2.id, h2],
      ]),
    );
    expect(g.nodeIds).toEqual([DEALS, ACCOUNTS, OWNERS]);
    expect(g.edges[1]).toMatchObject({ leftNode: ACCOUNTS, leftHandle: 'account_id' });
    expect(g.parentOf.get(OWNERS)).toBe(ACCOUNTS);
  });

  it('a hop with no matching query-owned rel is reported unresolved, not rendered', () => {
    const g = buildSourceGraph(DEALS, [hop('qrel_99999999')], new Map());
    expect(g.nodeIds).toEqual([DEALS]);
    expect(g.edges).toHaveLength(0);
    expect(g.unresolved).toHaveLength(1);
  });
});

// R93's draw-time dtype guard, rehomed here by R167. It used to live in
// `query-provenance.test.ts` beside the `qr_`-left provenance rewrite that made a drag
// off a query node legal; that rewrite is retired with composition (both endpoints are
// datasets now, so a drawn column already names its own leaf). The dtype guard is NOT
// retired — it mirrors the backend's `_compatible` rule at draw time — so it moved
// rather than going down with the file it happened to share.
describe('resolveConnect — draw-time dtype guard (R93)', () => {
  const DEALS_D = 'ds_11111111';
  const ACCOUNTS_D = 'ds_22222222';
  const none: Relationship[] = [];
  // DEALS.amount = integer, DEALS.deal_id = string; ACCOUNTS.tier = string,
  // ACCOUNTS.score = float. Mirrors the backend rule: equal, or both numeric.
  const dtype = (sourceId: string, column: string): string | null => {
    const m: Record<string, string> = {
      [`${DEALS_D}.amount`]: 'integer',
      [`${DEALS_D}.deal_id`]: 'string',
      [`${ACCOUNTS_D}.tier`]: 'string',
      [`${ACCOUNTS_D}.score`]: 'float',
    };
    return m[`${sourceId}.${column}`] ?? null;
  };

  it('rejects an incompatible pair (text ↔ number) before minting', () => {
    const res = resolveConnect(
      { source: DEALS_D, sourceHandle: 'deal_id', target: ACCOUNTS_D, targetHandle: 'score' },
      [DEALS_D],
      none,
      dtype,
    );
    expect(res).toEqual({ kind: 'invalid', reason: 'dtype_mismatch' });
  });

  it('allows a numeric cross-type pair (integer ↔ float), mirroring the backend', () => {
    const res = resolveConnect(
      { source: DEALS_D, sourceHandle: 'amount', target: ACCOUNTS_D, targetHandle: 'score' },
      [DEALS_D],
      none,
      dtype,
    );
    expect(res.kind).toBe('define');
  });

  it('allows equal dtypes (string ↔ string)', () => {
    const res = resolveConnect(
      { source: DEALS_D, sourceHandle: 'deal_id', target: ACCOUNTS_D, targetHandle: 'tier' },
      [DEALS_D],
      none,
      dtype,
    );
    expect(res.kind).toBe('define');
  });

  it('is lenient on unknown dtypes — does NOT block (the backend stays the gate)', () => {
    const res = resolveConnect(
      { source: DEALS_D, sourceHandle: 'deal_id', target: ACCOUNTS_D, targetHandle: 'unknown_col' },
      [DEALS_D],
      none,
      dtype,
    );
    expect(res.kind).toBe('define');
  });
});

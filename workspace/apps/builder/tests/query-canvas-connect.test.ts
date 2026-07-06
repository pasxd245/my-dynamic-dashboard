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
  type EffectiveLookup,
  inferCardinality,
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
describe('buildSourceGraph (R93 — render-only left re-anchor)', () => {
  const QR_BASE = 'qr_aaaaaaaa'; // a build-on base (single-source query on DEALS)
  const QR_RIGHT = 'qr_bbbbbbbb'; // a joined-in query (effective space owned by ACCOUNTS)
  const hop = (queryRelId: string): JoinStep => ({ queryRelId, type: 'inner' });
  // Each query's effective space + the leaf each column traces to (a single-source query
  // owns its driving dataset's columns 1:1).
  const EFFECTIVE: Record<
    string,
    ReadonlyArray<{ name: string; owner: { ownerSourceId: string; sourceColumn: string } }>
  > = {
    [QR_BASE]: [{ name: 'deal_id', owner: { ownerSourceId: DEALS, sourceColumn: 'deal_id' } }],
    [QR_RIGHT]: [{ name: 'account_id', owner: { ownerSourceId: ACCOUNTS, sourceColumn: 'account_id' } }],
  };
  const effectiveOf: EffectiveLookup = (id) => EFFECTIVE[id] ?? [];

  it('dataset×dataset is unchanged — left is the in-graph root, no extra node', () => {
    const qrel: QueryRelationship = {
      id: 'qrel_11111111',
      leftSourceId: DEALS,
      leftColumn: 'deal_id',
      rightSourceId: ACCOUNTS,
      rightColumn: 'account_id',
      cardinality: 'one_to_many',
      originRelationshipId: 'rel_a1b2c3d4',
    };
    const g = buildSourceGraph(DEALS, [hop(qrel.id)], new Map([[qrel.id, qrel]]), effectiveOf);
    expect(g.nodeIds).toEqual([DEALS, ACCOUNTS]); // exactly the two endpoints
    expect(g.edges[0]).toMatchObject({ leftNode: DEALS, leftHandle: 'deal_id' });
    expect(g.parentOf.get(ACCOUNTS)).toBe(DEALS);
    // D5 — both visual endpoints are datasets → promotable.
    expect(g.edges[0].promotable).toBe(true);
  });

  it('build-on-query — drawing off the qr_ ROOT anchors the edge on the query node, no orphaned leaf', () => {
    // The model stores the qr_'s OWNING LEAF (DEALS) as the left (provenance rewrite).
    const qrel: QueryRelationship = {
      id: 'qrel_22222222',
      leftSourceId: DEALS, // the leaf inside QR_BASE — NOT the qr_ id
      leftColumn: 'deal_id',
      rightSourceId: ACCOUNTS,
      rightColumn: 'account_id',
      cardinality: 'one_to_many',
      originRelationshipId: null,
    };
    const g = buildSourceGraph(QR_BASE, [hop(qrel.id)], new Map([[qrel.id, qrel]]), effectiveOf);
    // Two nodes only — the query root + the added source. The leaf DEALS is NOT a node.
    expect(g.nodeIds).toEqual([QR_BASE, ACCOUNTS]);
    expect(g.nodeIds).not.toContain(DEALS);
    // The edge anchors on the qr_ root node + its effective column handle.
    expect(g.edges[0]).toMatchObject({ leftNode: QR_BASE, leftHandle: 'deal_id' });
    expect(g.parentOf.get(ACCOUNTS)).toBe(QR_BASE);
    // D5 — the edge VISUALLY touches a query node → NOT promotable (even though the stored
    // leftSourceId is a leaf ds_; promotability tests the display node, not the stored leaf).
    expect(g.edges[0].promotable).toBe(false);
  });

  it('query×query — drawing off a joined-in qr_ anchors on that query node, not its leaf', () => {
    // Drive on a dataset, join in QR_RIGHT, then draw OFF QR_RIGHT to OWNERS — the second
    // hop's left is stored as ACCOUNTS (QR_RIGHT's leaf), and must render on QR_RIGHT.
    const h1: QueryRelationship = {
      id: 'qrel_33333333',
      leftSourceId: DEALS,
      leftColumn: 'deal_id',
      rightSourceId: QR_RIGHT,
      rightColumn: 'account_id',
      cardinality: 'one_to_many',
      originRelationshipId: null,
    };
    const h2: QueryRelationship = {
      id: 'qrel_44444444',
      leftSourceId: ACCOUNTS, // QR_RIGHT's owning leaf — must re-anchor onto QR_RIGHT
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
      effectiveOf,
    );
    expect(g.nodeIds).toEqual([DEALS, QR_RIGHT, OWNERS]); // ACCOUNTS leaf is not its own node
    expect(g.edges[1]).toMatchObject({ leftNode: QR_RIGHT, leftHandle: 'account_id' });
    expect(g.parentOf.get(OWNERS)).toBe(QR_RIGHT);
    // D5 — edge 0 (DEALS → QR_RIGHT) has a qr_ RIGHT → not promotable; edge 1 is anchored
    // on the QR_RIGHT query node → not promotable. Neither links two datasets visually.
    expect(g.edges[0].promotable).toBe(false);
    expect(g.edges[1].promotable).toBe(false);
  });

  it('a hop with no matching query-owned rel is reported unresolved, not rendered', () => {
    const g = buildSourceGraph(DEALS, [hop('qrel_99999999')], new Map(), effectiveOf);
    expect(g.nodeIds).toEqual([DEALS]);
    expect(g.edges).toHaveLength(0);
    expect(g.unresolved).toHaveLength(1);
  });
});

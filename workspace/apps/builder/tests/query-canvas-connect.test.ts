// R89 — pure unit tests for the free-form canvas's decision logic, decoupled from
// React Flow's drag gesture (which is human-verified in the F1 review). These cover
// the load-bearing routing the canvas's `onConnect` delegates to:
//   resolveConnect — copy-on-pick vs. free-form define vs. invalid;
//   relDivergence  — a copied rel drifting from its origin governed rel;
//   freeFormRel    — minting a query-owned rel with no provenance.

import { describe, expect, it } from 'vitest';

import { freeFormRel } from '@/features/data-management/queries/chain';
import { inferCardinality, relDivergence, resolveConnect } from '@/features/data-management/queries/joinGraph';
import type { Relationship } from '@/features/data-management/relationships/types';
import type { QueryRelationship } from '@/features/data-management/queries/types';

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
      fields: { leftDatasetId: DEALS, leftColumn: 'amount', rightDatasetId: ACCOUNTS, rightColumn: 'account_name' },
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
    const res = resolveConnect({ source: DEALS, sourceHandle: null, target: ACCOUNTS, targetHandle: 'account_id' }, [DEALS], governed);
    expect(res).toEqual({ kind: 'invalid', reason: 'incomplete' });
  });
});

describe('relDivergence (R89 — copied rel vs. its origin governed rel)', () => {
  const byId = new Map(governed.map((r) => [r.id, r]));

  const copied: QueryRelationship = {
    id: 'qrel_a1b2c3d4',
    leftDatasetId: DEALS,
    leftColumn: 'deal_id',
    rightDatasetId: ACCOUNTS,
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

  it('infers one_to_many when exactly ONE side is key-like (parent-key ↔ child-FK)', () => {
    expect(inferCardinality('id', 'region')).toBe('one_to_many');
    expect(inferCardinality('deal_name', 'owner_id')).toBe('one_to_many');
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
      leftDatasetId: DEALS,
      leftColumn: 'amount',
      rightDatasetId: ACCOUNTS,
      rightColumn: 'account_name',
      cardinality: 'one_to_many',
    });
    expect(r.originRelationshipId).toBeNull();
    expect(r.id).toMatch(/^qrel_[0-9a-f]{8}$/);
    expect(r.leftColumn).toBe('amount');
  });
});

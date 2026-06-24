// R92 (F1) — pure unit tests for the query×query enabler: column provenance.
// Two load-bearing pieces, decoupled from React Flow's drag (human-verified at F1):
//   resolveConnect + provenanceOf — a drag OFF a `qr_` node's effective column
//     rewrites the hop's LEFT to the owning leaf `ds_`, so the join is legal on
//     R91's wire (the resolver matches `leftSourceId` against leaf `ds_` ids);
//   effectiveColumnsWithProvenance — the FE mock that derives each effective
//     column's owning `(ds_, sourceColumn)` from the query's own definition.

import { describe, expect, it } from 'vitest';

import { resolveConnect } from '@/features/data-management/queries/joinGraph';
import { effectiveColumnsWithProvenance } from '@/features/data-management/queries/provenance';
import type { Column } from '@/features/data-management/datasets/types';
import type { Relationship } from '@/features/data-management/relationships/types';
import type { Query } from '@/features/data-management/queries/types';

const DEALS = 'ds_11111111';
const ACCOUNTS = 'ds_22222222';
const OWNERS = 'ds_33333333';
const WON_DEALS_QR = 'qr_9c2f10ab'; // a saved query rooted on DEALS (single-source)

const governed: Relationship[] = [];

const dsColumnsById = new Map<string, Column[]>([
  [
    DEALS,
    [
      { name: 'deal_id', dtype: 'string' },
      { name: 'amount', dtype: 'integer' },
    ],
  ],
  [
    ACCOUNTS,
    [
      { name: 'account_id', dtype: 'string' },
      { name: 'tier', dtype: 'string' },
    ],
  ],
  [
    OWNERS,
    [
      { name: 'tier', dtype: 'string' },
      { name: 'owner_name', dtype: 'string' },
    ],
  ],
]);
const dsNameById = new Map<string, string>([
  [DEALS, 'Deals'],
  [ACCOUNTS, 'accounts'],
  [OWNERS, 'owners'],
]);

// A drag OFF the Won-deals query's `deal_id` resolves to its owning leaf (DEALS.deal_id).
const provenanceOf = (sourceId: string, column: string) => {
  if (sourceId === WON_DEALS_QR && column === 'deal_id') return { ownerSourceId: DEALS, sourceColumn: 'deal_id' };
  if (sourceId === WON_DEALS_QR && column === 'computed_total') return null; // derived — no single owner
  return { ownerSourceId: sourceId, sourceColumn: column }; // a ds_ owns itself
};

describe('resolveConnect — provenance rewrites a qr_ left to its owning leaf (R92)', () => {
  it('rewrites leftSourceId from the qr_ node to the owning leaf ds_ when drawing OFF a query', () => {
    const res = resolveConnect(
      // root is the Won-deals QUERY (in graph); draw from its `deal_id` to a NEW Accounts
      { source: WON_DEALS_QR, sourceHandle: 'deal_id', target: ACCOUNTS, targetHandle: 'account_id' },
      [WON_DEALS_QR],
      governed,
      provenanceOf,
    );
    expect(res).toEqual({
      kind: 'define',
      // left is the LEAF ds_, not the qr_ id — so the resolver's membership match passes
      fields: { leftSourceId: DEALS, leftColumn: 'deal_id', rightSourceId: ACCOUNTS, rightColumn: 'account_id' },
    });
  });

  it('rejects a draw off a DERIVED column (no single owner — the documented boundary)', () => {
    const res = resolveConnect(
      { source: WON_DEALS_QR, sourceHandle: 'computed_total', target: ACCOUNTS, targetHandle: 'account_id' },
      [WON_DEALS_QR],
      governed,
      provenanceOf,
    );
    expect(res).toEqual({ kind: 'invalid', reason: 'derived' });
  });

  it('leaves a dataset↔dataset draw unchanged (provenance defaults to identity)', () => {
    const res = resolveConnect(
      { source: DEALS, sourceHandle: 'amount', target: ACCOUNTS, targetHandle: 'tier' },
      [DEALS],
      governed,
    );
    expect(res).toEqual({
      kind: 'define',
      fields: { leftSourceId: DEALS, leftColumn: 'amount', rightSourceId: ACCOUNTS, rightColumn: 'tier' },
    });
  });
});

describe('effectiveColumnsWithProvenance — the FE mock (R92 F1)', () => {
  const qrById = new Map<string, Query>();

  it('owns a single-source query 1:1 to its driving dataset, bare names', () => {
    const wonDeals: Query = {
      id: WON_DEALS_QR,
      workspaceId: 'ws_aaaaaaa1',
      sourceId: DEALS,
      name: 'Won deals over $1k',
      definition: { q: null, filters: [], advanced: [] },
      createdAt: '2026-06-12T14:02:00Z',
    };
    const cols = effectiveColumnsWithProvenance(wonDeals, dsColumnsById, dsNameById, qrById);
    expect(cols).toEqual([
      { name: 'deal_id', owner: { ownerSourceId: DEALS, sourceColumn: 'deal_id' } },
      { name: 'amount', owner: { ownerSourceId: DEALS, sourceColumn: 'amount' } },
    ]);
  });

  it('collision-qualifies a duplicate column by owner-dataset name, keeping leaf provenance', () => {
    const joined: Query = {
      id: 'qr_101a0001',
      workspaceId: 'ws_aaaaaaa1',
      sourceId: ACCOUNTS,
      name: 'Accounts × Owners',
      definition: {
        q: null,
        filters: [],
        advanced: [],
        relationships: [
          {
            id: 'qrel_a1b2c3d4',
            leftSourceId: ACCOUNTS,
            leftColumn: 'tier',
            rightSourceId: OWNERS,
            rightColumn: 'tier',
            cardinality: 'one_to_many',
            originRelationshipId: null,
          },
        ],
        joins: [{ queryRelId: 'qrel_a1b2c3d4', type: 'inner' }],
      },
      createdAt: '2026-06-13T10:00:00Z',
    };
    const cols = effectiveColumnsWithProvenance(joined, dsColumnsById, dsNameById, qrById);
    // `tier` exists on BOTH accounts and owners → qualified on both sides by owner name;
    // order follows the source/column order (accounts' columns, then owners').
    expect(cols).toEqual([
      { name: 'account_id', owner: { ownerSourceId: ACCOUNTS, sourceColumn: 'account_id' } },
      { name: 'accounts.tier', owner: { ownerSourceId: ACCOUNTS, sourceColumn: 'tier' } },
      { name: 'owners.tier', owner: { ownerSourceId: OWNERS, sourceColumn: 'tier' } },
      { name: 'owner_name', owner: { ownerSourceId: OWNERS, sourceColumn: 'owner_name' } },
    ]);
  });
});

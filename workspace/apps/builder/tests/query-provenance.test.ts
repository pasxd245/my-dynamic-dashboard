// R92→R93 — pure unit tests for the query×query enabler: column provenance.
// `resolveConnect` + a `provenanceOf` resolver — a drag OFF a `qr_` node's effective
// column rewrites the hop's LEFT to the owning leaf `ds_`, so the join is legal on the
// resolver's leaf-membership match. (R93 moved provenance onto the wire — the canvas now
// reads it from `resolvedColumns` rather than re-deriving it — but `resolveConnect`'s
// provenance-aware routing is unchanged and still unit-tested here, decoupled from the
// React Flow drag, which is human-verified at the F1/F2 feel-checks.)

import { describe, expect, it } from 'vitest';

import { resolveConnect } from '@/features/data-management/queries/joinGraph';
import type { Relationship } from '@/features/data-management/relationships/types';

const DEALS = 'ds_11111111';
const ACCOUNTS = 'ds_22222222';
const WON_DEALS_QR = 'qr_9c2f10ab'; // a saved query rooted on DEALS

const governed: Relationship[] = [];

// A drag OFF the Won-deals query's `deal_id` resolves to its owning leaf (DEALS.deal_id);
// a derived column (no single owner) resolves to null.
const provenanceOf = (sourceId: string, column: string) => {
  if (sourceId === WON_DEALS_QR && column === 'deal_id') return { ownerSourceId: DEALS, sourceColumn: 'deal_id' };
  if (sourceId === WON_DEALS_QR && column === 'computed_total') return null; // derived — no single owner
  return { ownerSourceId: sourceId, sourceColumn: column }; // a ds_ owns itself
};

describe('resolveConnect — provenance rewrites a qr_ left to its owning leaf (R92/R93)', () => {
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

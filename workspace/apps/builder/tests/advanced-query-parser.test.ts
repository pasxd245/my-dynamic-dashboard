// Parser unit tests (R51 F1) — the load-bearing pure module.
// Maps to advanced-query.md § Acceptance criteria 1–7.

import { describe, expect, it } from 'vitest';

import { parseAdvancedQuery } from '@/features/data-management/datasets/advanced-query/parser';
import {
  groupsFromParam,
  groupsToParam,
  groupsToText,
} from '@/features/data-management/datasets/advanced-query/serialize';
import type { Column } from '@/features/data-management/datasets/types';

// Mirror of MOCK_DATASET.columns (fixtures.ts).
const COLUMNS: readonly Column[] = [
  { name: 'deal_id', dtype: 'string' }, // 0
  { name: 'amount', dtype: 'integer' }, // 1
  { name: 'won_at', dtype: 'date' }, // 2
  { name: 'stage', dtype: 'string' }, // 3
  { name: 'probability', dtype: 'float' }, // 4
  { name: 'is_priority', dtype: 'boolean' }, // 5
  { name: 'created_at', dtype: 'datetime' }, // 6
];

function ok(text: string) {
  const r = parseAdvancedQuery(text, COLUMNS);
  if (!r.ok) throw new Error(`expected ok, got error: ${r.code} @ ${r.position} — ${r.message}`);
  return r.groups;
}

function fail(text: string) {
  const r = parseAdvancedQuery(text, COLUMNS);
  if (r.ok) throw new Error(`expected error, got ok: ${JSON.stringify(r.groups)}`);
  return r;
}

describe('parseAdvancedQuery — happy paths (criteria 1–5)', () => {
  it('C1: single equals atom', () => {
    expect(ok('stage:won')).toEqual([[{ col: 3, dtype: 'string', op: 'equals', val: 'won' }]]);
  });

  it('C2: AND binds tighter than OR — a AND b OR c → [[a,b],[c]]', () => {
    expect(ok('stage:won AND amount:>10000 OR stage:lost')).toEqual([
      [
        { col: 3, dtype: 'string', op: 'equals', val: 'won' },
        { col: 1, dtype: 'integer', op: 'gt', val: 10000 },
      ],
      [{ col: 3, dtype: 'string', op: 'equals', val: 'lost' }],
    ]);
  });

  it('C2: AND joins within a group', () => {
    expect(ok('stage:won AND amount:>10000')).toEqual([
      [
        { col: 3, dtype: 'string', op: 'equals', val: 'won' },
        { col: 1, dtype: 'integer', op: 'gt', val: 10000 },
      ],
    ]);
  });

  it('C2: OR on the same column (the capability chips cannot express)', () => {
    expect(ok('stage:won OR stage:lost')).toEqual([
      [{ col: 3, dtype: 'string', op: 'equals', val: 'won' }],
      [{ col: 3, dtype: 'string', op: 'equals', val: 'lost' }],
    ]);
  });

  it('C3: AND/OR keywords + column name are case-insensitive', () => {
    expect(ok('STAGE:won and AMOUNT:>1 oR Stage:lost')).toEqual([
      [
        { col: 3, dtype: 'string', op: 'equals', val: 'won' },
        { col: 1, dtype: 'integer', op: 'gt', val: 1 },
      ],
      [{ col: 3, dtype: 'string', op: 'equals', val: 'lost' }],
    ]);
  });

  it('C4: operator prefixes map onto the existing vocabulary', () => {
    expect(ok('amount:>10000')).toEqual([[{ col: 1, dtype: 'integer', op: 'gt', val: 10000 }]]);
    expect(ok('amount:<10000')).toEqual([[{ col: 1, dtype: 'integer', op: 'lt', val: 10000 }]]);
    expect(ok('amount:>=10000')).toEqual([[{ col: 1, dtype: 'integer', op: 'gte', val: 10000 }]]);
    expect(ok('amount:<=10000')).toEqual([[{ col: 1, dtype: 'integer', op: 'lte', val: 10000 }]]);
    expect(ok('amount:!=0')).toEqual([[{ col: 1, dtype: 'integer', op: 'ne', val: 0 }]]);
    expect(ok('won_at:>2026-01-01')).toEqual([[{ col: 2, dtype: 'date', op: 'after', val: '2026-01-01' }]]);
    expect(ok('won_at:<2026-01-01')).toEqual([[{ col: 2, dtype: 'date', op: 'before', val: '2026-01-01' }]]);
    expect(ok('stage:~ren')).toEqual([[{ col: 3, dtype: 'string', op: 'contains', val: 'ren' }]]);
    expect(ok('is_priority:true')).toEqual([[{ col: 5, dtype: 'boolean', op: 'is_true' }]]);
    expect(ok('is_priority:FALSE')).toEqual([[{ col: 5, dtype: 'boolean', op: 'is_false' }]]);
    expect(ok('probability:>=0.5')).toEqual([[{ col: 4, dtype: 'float', op: 'gte', val: 0.5 }]]);
    expect(ok('created_at:>2026-01-01T08:00:00')).toEqual([
      [{ col: 6, dtype: 'datetime', op: 'after', val: '2026-01-01T08:00:00' }],
    ]);
  });

  it('C5: quoted operand with spaces', () => {
    expect(ok('stage:"closed won"')).toEqual([
      [{ col: 3, dtype: 'string', op: 'equals', val: 'closed won' }],
    ]);
  });

  it('C7: empty / whitespace input → no advanced query (not an error)', () => {
    expect(ok('')).toEqual([]);
    expect(ok('   ')).toEqual([]);
  });
});

describe('parseAdvancedQuery — error paths (criterion 6)', () => {
  it('unknown column', () => {
    const r = fail('nope:1');
    expect(r.code).toBe('unknown_column');
    expect(r.position).toBe(1);
  });

  it('empty operand after prefix', () => {
    expect(fail('amount:>').code).toBe('empty_value');
  });

  it('empty operand after colon', () => {
    expect(fail('stage:').code).toBe('empty_value');
  });

  it('unsupported (prefix, dtype): string > ', () => {
    expect(fail('stage:>1').code).toBe('unsupported_operator');
  });

  it('unsupported (prefix, dtype): date >= (documented gap)', () => {
    expect(fail('won_at:>=2026-01-01').code).toBe('unsupported_operator');
  });

  it('unsupported (prefix, dtype): string != (documented gap)', () => {
    expect(fail('stage:!=won').code).toBe('unsupported_operator');
  });

  it('non-numeric value on numeric column', () => {
    expect(fail('amount:abc').code).toBe('unparseable_value');
  });

  it('non-integer value on integer column', () => {
    expect(fail('amount:10.5').code).toBe('unparseable_value');
  });

  it('bad date format', () => {
    expect(fail('won_at:2026').code).toBe('unparseable_value');
  });

  it('boolean operand not true/false', () => {
    expect(fail('is_priority:maybe').code).toBe('invalid_boolean');
  });

  it('dangling AND', () => {
    expect(fail('stage:won AND').code).toBe('dangling_operator');
  });

  it('dangling OR', () => {
    expect(fail('stage:won OR').code).toBe('dangling_operator');
  });

  it('leading operator', () => {
    expect(fail('AND stage:won').code).toBe('expected_predicate');
  });

  it('two atoms without an operator', () => {
    expect(fail('stage:won stage:lost').code).toBe('expected_operator');
  });

  it('bare word without colon', () => {
    expect(fail('hello').code).toBe('missing_colon');
  });

  it('missing column name before colon', () => {
    expect(fail(':won').code).toBe('missing_column_name');
  });

  it('unterminated quote', () => {
    expect(fail('stage:"closed won').code).toBe('unterminated_quote');
  });

  it('1-based position points into the text', () => {
    // "stage:won AND nope:1" — `nope` starts at index 14 → position 15.
    const r = fail('stage:won AND nope:1');
    expect(r.code).toBe('unknown_column');
    expect(r.position).toBe(15);
  });
});

describe('serialize — round-trip (param + text)', () => {
  it('groupsToParam is JSON of the DNF; empty → ""', () => {
    expect(groupsToParam([])).toBe('');
    expect(groupsToParam(ok('stage:won'))).toBe(
      JSON.stringify([[{ col: 3, dtype: 'string', op: 'equals', val: 'won' }]]),
    );
  });

  it('groupsFromParam validates against columns; bad atom → []', () => {
    const param = groupsToParam(ok('stage:won OR stage:lost'));
    expect(groupsFromParam(param, COLUMNS)).toEqual(ok('stage:won OR stage:lost'));
    expect(groupsFromParam('not json', COLUMNS)).toEqual([]);
    expect(groupsFromParam('[[{"col":99,"dtype":"string","op":"equals","val":"x"}]]', COLUMNS)).toEqual([]);
    expect(groupsFromParam('[[{"col":1,"dtype":"string","op":"equals","val":"x"}]]', COLUMNS)).toEqual([]); // dtype mismatch
  });

  it('groupsToText canonicalizes DNF back to query text', () => {
    expect(groupsToText(ok('stage:won AND amount:>10000 OR stage:lost'), COLUMNS)).toBe(
      'stage:won AND amount:>10000 OR stage:lost',
    );
    expect(groupsToText(ok('stage:"closed won"'), COLUMNS)).toBe('stage:"closed won"');
    expect(groupsToText(ok('is_priority:true'), COLUMNS)).toBe('is_priority:true');
    expect(groupsToText(ok('won_at:>2026-01-01'), COLUMNS)).toBe('won_at:>2026-01-01');
  });

  it('text → parse → param → fromParam → text is stable', () => {
    const original = 'stage:won AND amount:>=10000 OR probability:<0.5';
    const groups = ok(original);
    const param = groupsToParam(groups);
    const back = groupsFromParam(param, COLUMNS);
    expect(groupsToText(back, COLUMNS)).toBe(original);
  });
});

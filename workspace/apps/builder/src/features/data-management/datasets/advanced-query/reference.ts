// Advanced-query syntax reference (R54) — drives the `?` help
// popover. Derived from the parser's live prefix maps + the chip
// vocabulary, so a later round that extends the operator set
// surfaces in the help automatically (no hardcoded operator list).

import type { Dtype } from '../types';
import type { Operator } from '../filters/types';
import {
  DATE_OP_BY_PREFIX,
  NUMERIC_OP_BY_PREFIX,
  PREFIXES,
  STRING_OP_BY_PREFIX,
  type Prefix,
} from './parser';

export type SyntaxFamily = 'string' | 'numeric' | 'date' | 'boolean';

/** One row of the help reference: the glyph the user types after
 *  `:` and the predicate operator it maps to (whose display label
 *  is the existing i18n key `datasets.filters.op.<op>`). */
export type SyntaxEntry = { token: string; op: Operator };

const ALL_PREFIXES: readonly Prefix[] = ['', ...PREFIXES];

function entriesFrom(map: Readonly<Record<Prefix, Operator | undefined>>): SyntaxEntry[] {
  return ALL_PREFIXES.flatMap((p) => {
    const op = map[p];
    return op ? [{ token: p, op }] : [];
  });
}

/** Supported `key:value` syntax per dtype family, derived from the
 *  parser's prefix maps. Boolean takes no prefix — the literal
 *  `true` / `false` value selects is_true / is_false. */
export const SYNTAX_REFERENCE: Readonly<Record<SyntaxFamily, readonly SyntaxEntry[]>> = {
  string: entriesFrom(STRING_OP_BY_PREFIX as Readonly<Record<Prefix, Operator | undefined>>),
  numeric: entriesFrom(NUMERIC_OP_BY_PREFIX as Readonly<Record<Prefix, Operator | undefined>>),
  date: entriesFrom(DATE_OP_BY_PREFIX as Readonly<Record<Prefix, Operator | undefined>>),
  boolean: [
    { token: 'true', op: 'is_true' },
    { token: 'false', op: 'is_false' },
  ],
};

/** Map a column dtype to its syntax family. */
export function familyForDtype(dtype: Dtype): SyntaxFamily {
  if (dtype === 'integer' || dtype === 'float') return 'numeric';
  if (dtype === 'date' || dtype === 'datetime') return 'date';
  if (dtype === 'boolean') return 'boolean';
  return 'string';
}

/** The distinct syntax families used by a dataset's columns, in a
 *  stable display order — so the help shows only relevant families. */
export function familiesForColumns(dtypes: readonly Dtype[]): SyntaxFamily[] {
  const present = new Set(dtypes.map(familyForDtype));
  return (['string', 'numeric', 'date', 'boolean'] as const).filter((f) => present.has(f));
}

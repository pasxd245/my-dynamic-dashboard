// Advanced-query types (R51).
//
// The advanced query parses to disjunctive normal form (DNF): an
// OR of AND-groups. Each atom is the EXISTING per-column
// `FilterPredicate` (R40) — no new predicate variant is
// introduced. The single new capability (OR across predicates)
// lives in the two-level array shape, not in the atom.
//
// Authoritative grammar + mapping spec:
//   .agents/design/data-management/advanced-query.md

import type { FilterPredicate } from '../filters/types';

/**
 * Disjunctive normal form: outer array = OR groups; inner array =
 * AND atoms. `[[a, b], [c]]` means `(a AND b) OR c`. An empty
 * outer array means "no advanced query active".
 */
export type PredicateGroups = readonly (readonly FilterPredicate[])[];

/** Stable error codes — keyed to `datasets.advancedQuery.error.<code>`
 *  for i18n and asserted directly in parser unit tests. */
export type ParseErrorCode =
  | 'missing_colon'
  | 'missing_column_name'
  | 'unknown_column'
  | 'empty_value'
  | 'unsupported_operator'
  | 'unparseable_value'
  | 'invalid_boolean'
  | 'expected_predicate'
  | 'expected_operator'
  | 'dangling_operator'
  | 'unterminated_quote';

/** Context fields interpolated into the (i18n) error message. */
export type ParseErrorContext = {
  column?: string;
  value?: string;
  dtype?: string;
  prefix?: string;
};

export type ParseResult =
  | { ok: true; groups: PredicateGroups }
  | {
      ok: false;
      code: ParseErrorCode;
      /** 1-based character position into the original query text. */
      position: number;
      context: ParseErrorContext;
      /** English fallback for non-i18n contexts (dev logs, tests). */
      message: string;
    };

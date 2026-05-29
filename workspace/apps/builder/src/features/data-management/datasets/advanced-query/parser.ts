// Advanced-query parser (R51) — the load-bearing pure module.
//
// Grammar (MVP), per
// .agents/design/data-management/advanced-query.md § Grammar:
//
//   query := group ( OR group )*
//   group := atom ( AND atom )*
//   atom  := key ':' op-prefix? operand
//
// Precedence: AND binds tighter than OR. With no parentheses and a
// single boolean level, every well-formed query is in disjunctive
// normal form (DNF) — an OR of AND-groups — which the parser emits
// directly as `FilterPredicate[][]`.
//
// PURE: no react, no router, no fetch. Imports only the existing
// `FilterPredicate` vocabulary + `Column`/`Dtype` types. This is the
// unit-testable heart of the feature and is portable to any future
// surface that needs the same grammar.

import type { Column, Dtype } from '../types';
import type { FilterPredicate } from '../filters/types';
import type { ParseErrorCode, ParseErrorContext, ParseResult } from './types';

/** The error variant of ParseResult (so `parseAtom` has a clean
 *  two-arm discriminated union with the success `{ ok, pred }`). */
type ParseError = Extract<ParseResult, { ok: false }>;

// ─── Tokenizer ──────────────────────────────────────────────────────

type Token =
  | { type: 'atom'; raw: string; start: number }
  | { type: 'and'; start: number }
  | { type: 'or'; start: number };

type TokenizeResult =
  | { ok: true; tokens: Token[] }
  | { ok: false; code: ParseErrorCode; position: number; context: ParseErrorContext };

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

/** Scan into words, consuming `"…"` quoted regions atomically so a
 *  quoted value may contain spaces. A bare word equal to `and`/`or`
 *  (case-insensitive, no colon, no quote) is a boolean keyword;
 *  every other word is an atom. */
function tokenize(text: string): TokenizeResult {
  const tokens: Token[] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    while (i < n && isWhitespace(text[i])) i++;
    if (i >= n) break;

    const start = i;
    let raw = '';
    let hadQuote = false;
    let hadColon = false;

    while (i < n && !isWhitespace(text[i])) {
      const ch = text[i];
      if (ch === '"') {
        hadQuote = true;
        raw += '"';
        i++;
        while (i < n && text[i] !== '"') {
          raw += text[i];
          i++;
        }
        if (i >= n) {
          return { ok: false, code: 'unterminated_quote', position: start + 1, context: {} };
        }
        raw += '"'; // closing quote
        i++;
      } else {
        if (ch === ':') hadColon = true;
        raw += ch;
        i++;
      }
    }

    const lower = raw.toLowerCase();
    if (!hadQuote && !hadColon && (lower === 'and' || lower === 'or')) {
      tokens.push({ type: lower, start });
    } else {
      tokens.push({ type: 'atom', raw, start });
    }
  }

  return { ok: true, tokens };
}

// ─── Operator-prefix → predicate-vocabulary mapping ─────────────────
//
// Maps onto the EXISTING R37 vocabulary only. A `(prefix, dtype)`
// pair absent from this map is a semantic error (never a silently
// different behavior). See advanced-query.md § Operator-prefix
// mapping for the documented gaps (date `>=`/`<=`, string `!=`).

export const PREFIXES = ['>=', '<=', '!=', '>', '<', '~'] as const;
export type Prefix = (typeof PREFIXES)[number] | '';

type NumericOp = 'equals' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
type StringOp = 'equals' | 'contains';
type DateOp = 'equals' | 'ne' | 'before' | 'after';

// Exported so the `?` help popover (AdvancedQueryHelp) renders the
// operator reference from the SAME live maps the parser uses — a
// later round that extends these maps surfaces in the help for free.
export const NUMERIC_OP_BY_PREFIX: Readonly<Record<Prefix, NumericOp | undefined>> = {
  '': 'equals',
  '!=': 'ne',
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
  '~': undefined,
};

export const STRING_OP_BY_PREFIX: Readonly<Record<Prefix, StringOp | undefined>> = {
  '': 'equals',
  '~': 'contains',
  '!=': undefined,
  '>': undefined,
  '<': undefined,
  '>=': undefined,
  '<=': undefined,
};

export const DATE_OP_BY_PREFIX: Readonly<Record<Prefix, DateOp | undefined>> = {
  '': 'equals',
  '!=': 'ne',
  '>': 'after',
  '<': 'before',
  '~': undefined,
  '>=': undefined, // documented gap — no inclusive date bound in the vocabulary
  '<=': undefined,
};

// ─── Value validation per dtype ─────────────────────────────────────

const INT_RE = /^-?\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// datetime accepts date-only (midnight) or full ISO with `T`/space.
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

// ─── Error helpers ──────────────────────────────────────────────────

function messageFor(code: ParseErrorCode, ctx: ParseErrorContext): string {
  switch (code) {
    case 'missing_colon':
      return `Expected a "key:value" predicate, found "${ctx.value}"`;
    case 'missing_column_name':
      return 'Missing a column name before ":"';
    case 'unknown_column':
      return `Unknown column "${ctx.column}"`;
    case 'empty_value':
      return ctx.prefix
        ? `Expected a value after "${ctx.prefix}" for column "${ctx.column}"`
        : `Expected a value after ":" for column "${ctx.column}"`;
    case 'unsupported_operator':
      return `Operator "${ctx.prefix}" is not supported for ${ctx.dtype} column "${ctx.column}"`;
    case 'unparseable_value':
      return `"${ctx.value}" is not a valid ${ctx.dtype} value for column "${ctx.column}"`;
    case 'invalid_boolean':
      return `Boolean column "${ctx.column}" expects true or false, found "${ctx.value}"`;
    case 'expected_predicate':
      return 'Expected a predicate (key:value), found AND/OR';
    case 'expected_operator':
      return 'Expected AND or OR between predicates';
    case 'dangling_operator':
      return 'Query ends with AND/OR — expected another predicate';
    case 'unterminated_quote':
      return 'Unterminated quoted value';
  }
}

function err(code: ParseErrorCode, position: number, context: ParseErrorContext): ParseError {
  return { ok: false, code, position, context, message: messageFor(code, context) };
}

// ─── Atom parsing ───────────────────────────────────────────────────

function stripQuotes(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

// Unicode operator aliases. The `?` help popover shows the math
// glyphs (≠ ≥ ≤ — the shared `datasets.filters.op.*` labels), so
// accept them as typeable aliases for their ASCII prefixes; a user
// who copies the displayed symbol gets a working query.
const PREFIX_ALIASES: Readonly<Record<string, Prefix>> = {
  '≠': '!=',
  '≥': '>=',
  '≤': '<=',
};

function splitPrefix(operandRaw: string): { prefix: Prefix; rest: string } {
  const alias = PREFIX_ALIASES[operandRaw[0] ?? ''];
  if (alias) {
    return { prefix: alias, rest: operandRaw.slice(1) };
  }
  for (const p of PREFIXES) {
    if (operandRaw.startsWith(p)) {
      return { prefix: p, rest: operandRaw.slice(p.length) };
    }
  }
  return { prefix: '', rest: operandRaw };
}

/** Split an atom token into key + value. A **quoted key**
 *  (`"customer number":won`, `"SỐ ĐIỆN THOẠI":x`) makes columns
 *  whose names contain spaces / delimiters / unicode queryable —
 *  the colon must follow the closing quote. Unquoted keys split on
 *  the first colon. `valueOffset` is the value's 0-based index in
 *  `raw` (for 1-based error positions). Returns null if there is no
 *  `key:` form. */
function splitKeyValue(
  raw: string,
): { key: string; valueRaw: string; valueOffset: number } | null {
  if (raw.startsWith('"')) {
    const close = raw.indexOf('"', 1);
    if (close === -1 || raw[close + 1] !== ':') return null;
    return { key: raw.slice(1, close), valueRaw: raw.slice(close + 2), valueOffset: close + 2 };
  }
  const colon = raw.indexOf(':');
  if (colon === -1) return null;
  return { key: raw.slice(0, colon), valueRaw: raw.slice(colon + 1), valueOffset: colon + 1 };
}

type AtomResult = { ok: true; pred: FilterPredicate } | ParseError;

function buildBooleanAtom(col: number, name: string, prefix: Prefix, operand: string, pos: number): AtomResult {
  if (prefix !== '') {
    return err('unsupported_operator', pos, { column: name, dtype: 'boolean', prefix });
  }
  const b = operand.toLowerCase();
  if (b === 'true') return { ok: true, pred: { col, dtype: 'boolean', op: 'is_true' } };
  if (b === 'false') return { ok: true, pred: { col, dtype: 'boolean', op: 'is_false' } };
  return err('invalid_boolean', pos, { column: name, value: operand });
}

function buildStringAtom(col: number, name: string, prefix: Prefix, operand: string, pos: number): AtomResult {
  const op = STRING_OP_BY_PREFIX[prefix];
  if (!op) return err('unsupported_operator', pos, { column: name, dtype: 'string', prefix });
  return { ok: true, pred: { col, dtype: 'string', op, val: operand } };
}

function buildNumericAtom(
  col: number,
  name: string,
  dtype: 'integer' | 'float',
  prefix: Prefix,
  operand: string,
  pos: number,
): AtomResult {
  const op = NUMERIC_OP_BY_PREFIX[prefix];
  if (!op) return err('unsupported_operator', pos, { column: name, dtype, prefix });
  const valid = dtype === 'integer' ? INT_RE.test(operand) : operand.trim() !== '' && Number.isFinite(Number(operand));
  if (!valid) return err('unparseable_value', pos, { column: name, dtype, value: operand });
  return { ok: true, pred: { col, dtype, op, val: Number(operand) } };
}

function buildDateAtom(
  col: number,
  name: string,
  dtype: 'date' | 'datetime',
  prefix: Prefix,
  operand: string,
  pos: number,
): AtomResult {
  const op = DATE_OP_BY_PREFIX[prefix];
  if (!op) return err('unsupported_operator', pos, { column: name, dtype, prefix });
  const re = dtype === 'date' ? DATE_RE : DATETIME_RE;
  if (!re.test(operand)) return err('unparseable_value', pos, { column: name, dtype, value: operand });
  return { ok: true, pred: { col, dtype, op, val: operand } };
}

/** Parse one atom token into a FilterPredicate, or return a
 *  positioned error. `tokenStart` is the 0-based offset of the
 *  token in the original text (for 1-based error positions). */
function parseAtom(
  raw: string,
  tokenStart: number,
  columns: readonly Column[],
): AtomResult {
  const split = splitKeyValue(raw);
  if (!split) {
    return err('missing_colon', tokenStart + 1, { value: raw });
  }
  const { key, valueRaw, valueOffset } = split;

  if (key.length === 0) {
    return err('missing_column_name', tokenStart + 1, {});
  }

  // Resolve column by case-insensitive name match (unicode-aware).
  const keyLower = key.toLowerCase();
  const colIndex = columns.findIndex((c) => c.name.toLowerCase() === keyLower);
  if (colIndex === -1) {
    return err('unknown_column', tokenStart + 1, { column: key });
  }
  const name = columns[colIndex].name;
  const dtype: Dtype = columns[colIndex].dtype;

  // Position of the value part (after `key:`), 1-based.
  const valuePos = tokenStart + valueOffset + 1;

  const { prefix, rest } = splitPrefix(valueRaw);
  const operand = stripQuotes(rest);

  if (rest.length === 0) {
    return err('empty_value', valuePos, { column: name, prefix });
  }

  // Dispatch to the per-dtype builder (each maps onto the existing
  // R37 predicate vocabulary; unsupported (prefix, dtype) → error).
  if (dtype === 'boolean') return buildBooleanAtom(colIndex, name, prefix, operand, valuePos);
  if (dtype === 'string') return buildStringAtom(colIndex, name, prefix, operand, valuePos);
  if (dtype === 'integer' || dtype === 'float') {
    return buildNumericAtom(colIndex, name, dtype, prefix, operand, valuePos);
  }
  return buildDateAtom(colIndex, name, dtype, prefix, operand, valuePos);
}

// ─── Top-level parse ────────────────────────────────────────────────

/**
 * Parse advanced-query text into DNF predicate groups.
 *
 * - Empty / whitespace-only input → `{ ok: true, groups: [] }`
 *   ("no advanced query active", not an error).
 * - Any grammar / semantic failure → `{ ok: false, code, position,
 *   context, message }` with a 1-based `position`.
 */
export function parseAdvancedQuery(text: string, columns: readonly Column[]): ParseResult {
  const tk = tokenize(text);
  if (!tk.ok) {
    return err(tk.code, tk.position, tk.context);
  }
  const tokens = tk.tokens;
  if (tokens.length === 0) {
    return { ok: true, groups: [] };
  }

  const groups: FilterPredicate[][] = [[]];
  let expectAtom = true;

  for (const tok of tokens) {
    if (expectAtom) {
      if (tok.type !== 'atom') {
        return err('expected_predicate', tok.start + 1, {});
      }
      const res = parseAtom(tok.raw, tok.start, columns);
      if (!res.ok) {
        return res;
      }
      groups[groups.length - 1].push(res.pred);
      expectAtom = false;
    } else {
      if (tok.type === 'atom') {
        return err('expected_operator', tok.start + 1, {});
      }
      if (tok.type === 'or') {
        groups.push([]);
      }
      // `and` keeps appending to the current group.
      expectAtom = true;
    }
  }

  if (expectAtom) {
    // Trailing AND/OR with no following predicate.
    const last = tokens.at(-1)!;
    return err('dangling_operator', last.start + 1, {});
  }

  return { ok: true, groups };
}

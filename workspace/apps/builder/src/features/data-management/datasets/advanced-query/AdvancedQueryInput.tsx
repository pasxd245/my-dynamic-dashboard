// AdvancedQueryInput (R51) — the single-line typed-query surface.
//
// UX (locked in F1, per advanced-query.md § Layout / § Behavior):
//   - Empty   → placeholder + one-line grammar hint, no error.
//   - Typing  → live display state (hint / summary / error) derived
//               purely from the buffer; commit is debounced (300ms)
//               or immediate on Enter.
//   - Parsed  → writes the query (onApply), shows "N groups · M
//               predicates" readback.
//   - Errored → error border + positional message; the query is
//               NOT applied (the last-applied query keeps governing
//               the table — never blank results out mid-edit).
//
// Display state is a *pure function of the buffer* (useMemo), so a
// successful apply (which round-trips `value` back to canonical
// text) never wipes the readback. Commit (onApply/onClear) is the
// only side-effect, fired on debounce/Enter.
//
// URL-agnostic: the parent supplies `value` (canonical text derived
// from the URL `aq` param), `onApply`, and `onClear`. The URL glue
// lives in `useAdvancedQueryState`.

import { Input, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Column } from '../types';
import { parseAdvancedQuery } from './parser';
import type { ParseErrorContext, PredicateGroups } from './types';

const DEBOUNCE_MS = 300;

type Display =
  | { kind: 'hint' }
  | { kind: 'summary'; groups: number; predicates: number }
  | { kind: 'error'; position: number; messageKey: string; context: ParseErrorContext; fallback: string };

type Props = Readonly<{
  columns: readonly Column[];
  /** Canonical query text derived from the URL `aq` param. */
  value: string;
  onApply: (groups: PredicateGroups) => void;
  onClear: () => void;
}>;

export function AdvancedQueryInput({ columns, value, onApply, onClear }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  const debounceRef = useRef<number | undefined>(undefined);

  // Sync from external URL changes (deep-link, back/forward, Clear
  // from elsewhere) and from our own apply round-tripping `value`
  // back to canonical text. Display is derived, so this never wipes
  // the readback.
  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
    };
  }, []);

  // Display state — pure function of the buffer.
  const display: Display = useMemo(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return { kind: 'hint' };
    const result = parseAdvancedQuery(trimmed, columns);
    if (result.ok) {
      if (result.groups.length === 0) return { kind: 'hint' };
      const predicates = result.groups.reduce((acc, g) => acc + g.length, 0);
      return { kind: 'summary', groups: result.groups.length, predicates };
    }
    return {
      kind: 'error',
      position: result.position,
      messageKey: `datasets.advancedQuery.error.${result.code}`,
      context: result.context,
      fallback: result.message,
    };
  }, [text, columns]);

  // Commit (side-effect) — apply on valid, clear on empty, no-op on
  // error so the last-applied query stays in effect.
  const commit = (next: string) => {
    const trimmed = next.trim();
    if (trimmed.length === 0) {
      onClear();
      return;
    }
    const result = parseAdvancedQuery(trimmed, columns);
    if (result.ok) {
      if (result.groups.length === 0) onClear();
      else onApply(result.groups);
    }
    // error → do nothing (never blank results mid-edit)
  };

  const onChange = (next: string) => {
    setText(next);
    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => commit(next), DEBOUNCE_MS);
  };

  const onEnter = () => {
    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
    commit(text);
  };

  const onClearClick = () => {
    if (debounceRef.current !== undefined) window.clearTimeout(debounceRef.current);
    setText('');
    onClear();
  };

  const hasText = text.trim().length > 0;

  return (
    <div data-component="AdvancedQueryInput" style={{ marginBottom: 12 }}>
      {/* R53 ui-design fix: a visible label makes the field
          distinguishable from the ?q= search box (Findability), and
          an explicit Clear is discoverable (Usability) — replacing
          the hover-only allowClear ×. */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <Typography.Text
          type="secondary"
          style={{ fontSize: 12, fontWeight: 600 }}
          data-component="AdvancedQueryLabel"
        >
          {t('datasets.advancedQuery.label')}
        </Typography.Text>
        {hasText ? (
          <Typography.Link
            onClick={onClearClick}
            style={{ fontSize: 12 }}
            data-component="AdvancedQueryClear"
          >
            {t('datasets.advancedQuery.clear')}
          </Typography.Link>
        ) : null}
      </div>
      <Input
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onPressEnter={onEnter}
        placeholder={t('datasets.advancedQuery.placeholder')}
        status={display.kind === 'error' ? 'error' : undefined}
        aria-label={t('datasets.advancedQuery.ariaLabel')}
        aria-invalid={display.kind === 'error' ? true : undefined}
        data-component="AdvancedQueryField"
        style={{ fontFamily: 'var(--font-family-mono, monospace)' }}
      />
      <div style={{ marginTop: 4, minHeight: 18 }}>
        {display.kind === 'error' ? (
          <Typography.Text type="danger" style={{ fontSize: 12 }} data-component="AdvancedQueryError">
            {t('datasets.advancedQuery.errorAt', { position: display.position })}{' '}
            {t(display.messageKey, { ...display.context, defaultValue: display.fallback })}
          </Typography.Text>
        ) : display.kind === 'summary' ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="AdvancedQuerySummary">
            {t('datasets.advancedQuery.summary', {
              groups: t('datasets.advancedQuery.summaryGroup', { count: display.groups }),
              predicates: t('datasets.advancedQuery.summaryPredicate', { count: display.predicates }),
            })}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }} data-component="AdvancedQueryHint">
            {t('datasets.advancedQuery.hint')}
          </Typography.Text>
        )}
      </div>
    </div>
  );
}

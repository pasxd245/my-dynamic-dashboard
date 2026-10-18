// Filter popover + trigger + per-dtype editors (R40).
//
// `<FilterPopover>` wraps a `<FilterTrigger>` button and opens an
// AntD `<Popover>` portaled to body. Internal draft state for
// operator + value(s); URL writes only on Apply. Cancel /
// click-outside / Escape discards. Matches R37 § Popover lifecycle.
//
// Per-dtype value editor lives inline (string → <Input>, numeric →
// <InputNumber>, date/datetime → native <input>, boolean → none).
// `between` renders two editors side-by-side. `is_null` and friends
// render no value editor.

import { FunnelIcon } from '@phosphor-icons/react';
import { Button, type ButtonProps, Input, InputNumber, Popover, Select, Switch, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { QueryParam } from '@/features/data-management/queries/types';
import type { Column } from '../types';
import { defaultOperator, OPERAND_SHAPE, OPS_BY_DTYPE, isParamRef, type FilterPredicate, type Operator } from './types';

export type FilterPopoverProps = Readonly<{
  column: Column;
  colIndex: number;
  /** Existing predicate for this column (if any). Pre-fills the draft. */
  existing: FilterPredicate | undefined;
  onApply: (predicate: FilterPredicate) => void;
  onClear: () => void;
  /** R195 — a saved query's declared parameters: each value field may use one
   *  instead of a literal ("Use parameter"). Absent on the dataset page. */
  params?: readonly QueryParam[];
}>;

type Field = 'val' | 'min' | 'max';

type Draft = {
  op: Operator;
  val: string;
  min: string;
  max: string;
  /** R195 — the parameter a field uses instead of its literal, by field. */
  ref: Partial<Record<Field, string>>;
};

function emptyDraft(column: Column): Draft {
  return { op: defaultOperator(column.dtype), val: '', min: '', max: '', ref: {} };
}

function existingToDraft(p: FilterPredicate): Draft {
  const draft: Draft = { op: p.op, val: '', min: '', max: '', ref: {} };
  for (const f of ['val', 'min', 'max'] as const) {
    if (!(f in p)) continue;
    const v = (p as unknown as Record<Field, unknown>)[f];
    if (isParamRef(v)) draft.ref[f] = v.param;
    else draft[f] = String(v);
  }
  return draft;
}

/** R195 — the declared parameters that fit a column under an operator
 *  (dashboard-filters.md D1: date ⇄ date/datetime, number ⇄ integer/float,
 *  string ⇄ string; a date on a datetime column is a calendar day, so not for
 *  equals / ne). Mirrors the backend's save check. */
export function fittingParams(
  params: readonly QueryParam[] | undefined,
  dtype: Column['dtype'],
  op: Operator,
): QueryParam[] {
  const want =
    dtype === 'date' || dtype === 'datetime'
      ? 'date'
      : dtype === 'integer' || dtype === 'float'
        ? 'number'
        : dtype === 'string'
          ? 'string'
          : null;
  if (!want || !params) return [];
  if (dtype === 'datetime' && (op === 'equals' || op === 'ne')) return [];
  return params.filter((p) => p.type === want);
}

function buildPredicate(colIndex: number, column: Column, draft: Draft): FilterPredicate | undefined {
  // R195 — a field using a parameter is filled with a type-valid stand-in so
  // the literal checks below pass, then replaced by the reference.
  const stand =
    column.dtype === 'integer' || column.dtype === 'float' ? '0' : column.dtype === 'string' ? 'x' : '2000-01-01';
  const filled: Draft = { ...draft };
  for (const f of ['val', 'min', 'max'] as const) if (draft.ref[f]) filled[f] = stand;
  const built = buildLiteral(colIndex, column, filled);
  if (!built) return undefined;
  const out = { ...built } as Record<string, unknown>;
  for (const f of ['val', 'min', 'max'] as const) {
    const name = draft.ref[f];
    if (name && f in out) out[f] = { param: name };
  }
  return out as FilterPredicate;
}

function buildLiteral(colIndex: number, column: Column, draft: Draft): FilterPredicate | undefined {
  const { op } = draft;
  const shape = OPERAND_SHAPE[op];

  if (shape === 'none') {
    if (op === 'is_null' || op === 'is_not_null') {
      return { col: colIndex, dtype: column.dtype, op } as FilterPredicate;
    }
    if (column.dtype === 'boolean' && (op === 'is_true' || op === 'is_false')) {
      return { col: colIndex, dtype: 'boolean', op };
    }
    if (column.dtype === 'string' && (op === 'is_empty' || op === 'is_not_empty')) {
      return { col: colIndex, dtype: 'string', op };
    }
    return undefined;
  }

  if (shape === 'single') {
    const raw = draft.val;
    if (raw.length === 0) return undefined;
    if (column.dtype === 'string') {
      if (op === 'contains' || op === 'equals' || op === 'ne' || op === 'starts_with' || op === 'ends_with') {
        return { col: colIndex, dtype: 'string', op, val: raw };
      }
      return undefined;
    }
    if (column.dtype === 'integer' || column.dtype === 'float') {
      const n = Number(raw);
      if (!Number.isFinite(n)) return undefined;
      if (op === 'equals' || op === 'ne' || op === 'gt' || op === 'lt' || op === 'gte' || op === 'lte') {
        return { col: colIndex, dtype: column.dtype, op, val: n };
      }
      return undefined;
    }
    if (column.dtype === 'date' || column.dtype === 'datetime') {
      if (op === 'equals' || op === 'ne' || op === 'before' || op === 'after' || op === 'gte' || op === 'lte') {
        return { col: colIndex, dtype: column.dtype, op, val: raw };
      }
      return undefined;
    }
    return undefined;
  }

  // range
  if (draft.min.length === 0 || draft.max.length === 0) return undefined;
  if (column.dtype === 'integer' || column.dtype === 'float') {
    const lo = Number(draft.min);
    const hi = Number(draft.max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return undefined;
    return { col: colIndex, dtype: column.dtype, op: 'between', min: lo, max: hi };
  }
  if (column.dtype === 'date' || column.dtype === 'datetime') {
    return { col: colIndex, dtype: column.dtype, op: 'between', min: draft.min, max: draft.max };
  }
  return undefined;
}

export function FilterPopover({ column, colIndex, existing, onApply, onClear, params }: FilterPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => (existing ? existingToDraft(existing) : emptyDraft(column)));

  // Reset draft whenever the popover opens (or the existing predicate
  // changes from outside, e.g. chip removal).
  useEffect(() => {
    if (open) {
      setDraft(existing ? existingToDraft(existing) : emptyDraft(column));
    }
  }, [open, existing, column]);

  const opOptions = useMemo(
    () =>
      OPS_BY_DTYPE[column.dtype].map((op) => ({
        value: op,
        label: t(`datasets.filters.op.${op}`),
      })),
    [column.dtype, t],
  );

  const predicate = buildPredicate(colIndex, column, draft);
  const applyDisabled = predicate === undefined;

  const handleApply = () => {
    if (!predicate) return;
    onApply(predicate);
    setOpen(false);
  };
  const handleCancel = () => setOpen(false);
  const handleClear = () => {
    onClear();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="bottomLeft"
      destroyOnHidden
      content={
        <div data-component="FilterPopoverContent" data-column-index={colIndex} style={{ width: 280 }}>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
            {t('datasets.filters.popoverTitle', { column: column.name })}
          </Typography.Title>

          <div style={{ marginBottom: 12 }}>
            <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              {t('datasets.filters.operatorLabel')}
            </Typography.Text>
            <Select
              value={draft.op}
              onChange={(op) => setDraft({ ...draft, op })}
              options={opOptions}
              style={{ width: '100%' }}
              data-component="FilterOperatorSelect"
            />
          </div>

          <ValueEditor
            column={column}
            draft={draft}
            onDraftChange={setDraft}
            params={fittingParams(params, column.dtype, draft.op)}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
            }}
          >
            {existing ? (
              <Typography.Link
                type="danger"
                onClick={handleClear}
                style={{ fontSize: 12, marginRight: 'auto' }}
                data-component="FilterClearButton"
              >
                {t('datasets.filters.clearFilter')}
              </Typography.Link>
            ) : (
              <span style={{ marginRight: 'auto' }} />
            )}
            <Button size="small" onClick={handleCancel}>
              {t('datasets.filters.cancel')}
            </Button>
            <Button
              type="primary"
              size="small"
              onClick={handleApply}
              disabled={applyDisabled}
              data-component="FilterApplyButton"
            >
              {t('datasets.filters.apply')}
            </Button>
          </div>
        </div>
      }
    >
      <FilterTrigger column={column} active={existing !== undefined} />
    </Popover>
  );
}

function ValueEditor({
  column,
  draft,
  onDraftChange,
  params,
}: Readonly<{
  column: Column;
  draft: Draft;
  onDraftChange: (next: Draft) => void;
  params: readonly QueryParam[];
}>) {
  const { t } = useTranslation();
  const shape = OPERAND_SHAPE[draft.op];

  if (shape === 'none') {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
        {t('datasets.filters.boolValueHint')}
      </Typography.Text>
    );
  }

  if (shape === 'range') {
    // Stacked layout — side-by-side at ~130px per input left dates
    // cramped, and per-input labels are clearer for screen readers.
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            {t('datasets.filters.rangeFromLabel')}
          </Typography.Text>
          <OperandInput
            column={column}
            draft={draft}
            onDraftChange={onDraftChange}
            params={params}
            placeholder={t('datasets.filters.rangeFromLabel')}
            field="min"
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
            {t('datasets.filters.rangeToLabel')}
          </Typography.Text>
          <OperandInput
            column={column}
            draft={draft}
            onDraftChange={onDraftChange}
            params={params}
            placeholder={t('datasets.filters.rangeToLabel')}
            field="max"
          />
        </div>
      </div>
    );
  }

  // single
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
        {t('datasets.filters.valueLabel')}
      </Typography.Text>
      <OperandInput column={column} draft={draft} onDraftChange={onDraftChange} params={params} field="val" />
    </div>
  );
}

/** R195 — a value field that may instead use a parameter ("Use parameter"). */
function OperandInput({
  column,
  draft,
  onDraftChange,
  params,
  placeholder,
  field,
}: Readonly<{
  column: Column;
  draft: Draft;
  onDraftChange: (next: Draft) => void;
  params: readonly QueryParam[];
  placeholder?: string;
  field: Field;
}>) {
  const { t } = useTranslation();
  const using = draft.ref[field] !== undefined;
  const setRef = (name: string | undefined) => {
    const ref = { ...draft.ref };
    if (name === undefined) delete ref[field];
    else ref[field] = name;
    onDraftChange({ ...draft, ref });
  };
  return (
    <div data-component="FilterOperand" data-field={field}>
      {params.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 4 }}>
          <Switch
            size="small"
            checked={using}
            onChange={(on) => setRef(on ? params[0].name : undefined)}
            data-component="UseParameterSwitch"
            data-field={field}
          />
          {t('queries.params.use')}
        </label>
      )}
      {using ? (
        <Select
          value={draft.ref[field]}
          onChange={(name: string) => setRef(name)}
          options={params.map((p) => ({ value: p.name, label: p.label ? `${p.label} (${p.name})` : p.name }))}
          style={{ width: '100%' }}
          aria-label={t('queries.params.use')}
          data-component="UseParameterSelect"
        />
      ) : (
        <SingleInput
          column={column}
          value={draft[field]}
          onChange={(v) => onDraftChange({ ...draft, [field]: v })}
          placeholder={placeholder}
          dataField={field}
        />
      )}
    </div>
  );
}

function SingleInput({
  column,
  value,
  onChange,
  placeholder,
  dataField,
}: Readonly<{
  column: Column;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dataField: 'val' | 'min' | 'max';
}>) {
  if (column.dtype === 'integer' || column.dtype === 'float') {
    return (
      <InputNumber
        value={value === '' ? null : Number(value)}
        onChange={(n) => onChange(n === null || n === undefined ? '' : String(n))}
        placeholder={placeholder}
        style={{ width: '100%' }}
        controls={false}
        data-component="FilterValueInput"
        data-field={dataField}
      />
    );
  }
  // Native date/datetime inputs need `box-sizing: border-box` (so
  // width: 100% includes padding+border) and `flex: 1` + `min-width: 0`
  // (so the range-case pair can shrink below their intrinsic width in
  // a flex parent). AntD's <Input>/<InputNumber> set these internally.
  if (column.dtype === 'date' || column.dtype === 'datetime') {
    const inputType = column.dtype === 'date' ? 'date' : 'datetime-local';
    return (
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          flex: 1,
          minWidth: 0,
          boxSizing: 'border-box',
          padding: '4px 11px',
          border: '1px solid var(--ant-color-border, #d9d9d9)',
          borderRadius: 6,
          fontSize: 14,
          lineHeight: 1.5715,
        }}
        data-component="FilterValueInput"
        data-field={dataField}
      />
    );
  }
  // string
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-component="FilterValueInput"
      data-field={dataField}
    />
  );
}

// `...rest` is load-bearing — AntD `<Popover trigger="click">` injects
// onClick via cloneElement onto the direct child; not forwarding it
// kills the popover.
type FilterTriggerProps = Readonly<{
  column: Column;
  active: boolean;
}> &
  Omit<ButtonProps, 'icon' | 'type' | 'size' | 'style' | 'children'>;

function FilterTrigger({ column, active, ...rest }: FilterTriggerProps) {
  const { t } = useTranslation();
  return (
    <Button
      {...rest}
      type="text"
      size="small"
      style={{
        marginInlineStart: 4,
        padding: '0 4px',
        height: 22,
        color: active ? 'var(--ant-color-primary, #1677ff)' : 'var(--ant-color-text-tertiary, #8c8c8c)',
      }}
      icon={<FunnelIcon size={18} weight={active ? 'fill' : 'regular'} />}
      aria-label={t('datasets.filters.triggerAria', { column: column.name })}
      data-component="FilterTrigger"
      data-active={active || undefined}
    />
  );
}

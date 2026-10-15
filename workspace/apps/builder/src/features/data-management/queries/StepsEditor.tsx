// R125 — the transform-steps authoring UI (the "workflow" surface). Renders the
// query's ordered `steps` as cards over the PRE-step column space, threading the
// evolving columns through each step (steps.ts) so every step offers the columns
// available AT that point. Edits call `onChange` with the next step list; the
// live preview (which sends the steps) shows the shaped result. R129 — works for
// ALL query shapes (single-source / joined / composed): the preview reports the
// PRE-step `baseColumns` the builder feeds here. R175 — an aggregate carries a
// LIST of measures and a filter a LIST of predicates (AND), so a definition saved
// through the API round-trips through this editor without losing any of them.
// Backend re-validates on preview/save.

import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Input, InputNumber, Radio, Select, Space, Switch, Typography } from 'antd';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { OPS_BY_DTYPE } from '@/features/data-management/datasets/filters/types';
import type { Column } from '@/features/data-management/datasets/types';
import {
  STEP_MENU,
  blankStep,
  caseDtype,
  consumedByDerive,
  defaultWindowName,
  grainAt,
  groupColumnIssues,
  groupColumnPool,
  isNumericCol,
  isOrderableCol,
  isTemporalCol,
  narrowedBy,
  nullCountOf,
  threadColumns,
  windowColumnIssues,
  windowColumnPool,
  windowOpAvailable,
  windowOrderPool,
} from './steps';
import type {
  AggregateMeasure,
  AggregateStep,
  CaseStep,
  CaseValue,
  ComputeStep,
  DateBucketStep,
  DateDiffStep,
  DatePartStep,
  DeriveStep,
  GroupColumnStep,
  FilterStep,
  FilterStepPredicate,
  SelectStep,
  SortStep,
  Step,
  TopNStep,
  WindowColumnStep,
  WindowOp,
} from './types';

type StepsEditorProps = Readonly<{
  steps: readonly Step[];
  /** The PRE-step (base) column space — single-source dataset columns in v1. */
  columns: readonly Column[];
  /** R165 — the SHAPED preview, so a card can report on what it produced (the
   *  `prior_period` gap count). Read-only feedback; authoring never binds to it.
   *  `total` is the row count of the WHOLE result, so a card can tell whether the
   *  rows it just counted are all of them or one page (walk T2). */
  result?: { columns: readonly Column[]; rows: readonly (readonly (string | null)[])[]; total?: number };
  onChange: (steps: Step[]) => void;
}>;

const nameOptions = (cols: readonly Column[]) => cols.map((c) => ({ label: c.name, value: c.name }));

export function StepsEditor({ steps, columns, result, onChange }: StepsEditorProps) {
  const { t } = useTranslation();
  const { entering, final } = threadColumns(columns, steps);

  const replace = (i: number, next: Step) => onChange(steps.map((s, j) => (j === i ? next : s)));
  const remove = (i: number) => onChange(steps.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (value: string) => {
    const choice = STEP_MENU.flatMap((g) => g.items).find((i) => i.value === value);
    if (choice) onChange([...steps, blankStep(choice.kind, final, choice.op)]);
  };

  // R164 — a card is titled by its OPERATION, and for the window family the kind
  // is NOT the operation: one kind carries four of them. The user never meets the
  // kind name (`window_column`), only the business phrase they picked in the menu.
  const kindLabel = (kind: Step['kind']) =>
    ({
      aggregate: t('queries.builder.steps.kindAggregate'),
      derive: t('queries.builder.steps.kindDerive'),
      filter: t('queries.builder.steps.kindFilter'),
      top_n: t('queries.builder.steps.kindTopN'),
      sort: t('queries.builder.steps.kindSort'),
      select: t('queries.builder.steps.kindSelect'),
      date_bucket: t('queries.builder.steps.kindDateBucket'),
      group_column: t('queries.builder.steps.kindGroupColumn'),
      window_column: '',
      date_part: t('queries.builder.steps.kindDatePart'),
      date_diff: t('queries.builder.steps.kindDateDiff'),
      case: t('queries.builder.steps.kindCase'),
      compute: t('queries.builder.steps.kindCompute'),
    })[kind];
  const stepLabel = (step: Step) => (step.kind === 'window_column' ? opLabel(t, step.op) : kindLabel(step.kind));

  return (
    <div data-component="StepsEditor" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('queries.builder.steps.hint')}
      </Typography.Text>

      {steps.map((step, i) => (
        <div
          key={i}
          data-component="StepCard"
          data-step-kind={step.kind}
          style={{
            border: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
            borderRadius: 6,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography.Text strong style={{ fontSize: 12 }}>
              {i + 1}. {stepLabel(step)}
            </Typography.Text>
            <Space size={0} style={{ marginInlineStart: 'auto' }}>
              <Button
                type="text"
                size="small"
                icon={<ArrowUpOutlined />}
                disabled={i === 0}
                aria-label={t('queries.builder.steps.up')}
                onClick={() => move(i, -1)}
              />
              <Button
                type="text"
                size="small"
                icon={<ArrowDownOutlined />}
                disabled={i === steps.length - 1}
                aria-label={t('queries.builder.steps.down')}
                onClick={() => move(i, 1)}
              />
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t('queries.builder.steps.remove')}
                onClick={() => remove(i)}
              />
            </Space>
          </div>
          <StepBody
            step={step}
            cols={entering[i] ?? columns}
            grain={grainAt(steps, i)}
            narrowed={narrowedBy(steps, i)}
            gaps={step.kind === 'window_column' ? nullCountOf(step.name, result) : null}
            consumed={step.kind === 'window_column' && consumedByDerive(steps, i, step.name)}
            onChange={(next) => replace(i, next)}
          />
        </div>
      ))}

      {/* R164 — three <OptGroup>s, not a flat twelve. Group headings are TEXT
          (the same mechanism the base/join <Select>s use for "Datasets" /
          "Saved queries"), so membership is announced, never implied by order. */}
      <Select
        data-component="AddStepSelect"
        size="small"
        value={null}
        placeholder={t('queries.builder.steps.add')}
        style={{ width: 220 }}
        options={STEP_MENU.map((g) => ({
          label: t(`queries.builder.steps.group${g.group.charAt(0).toUpperCase()}${g.group.slice(1)}`),
          options: g.items.map((item) => ({
            label: item.op ? opLabel(t, item.op) : kindLabel(item.kind),
            value: item.value,
            // D4 — unofferable at the gesture, never an error at run.
            disabled: item.op ? !windowOpAvailable(item.op, final) : false,
            title: item.op && !windowOpAvailable(item.op, final) ? t('queries.builder.steps.noEligibleOp') : undefined,
          })),
        }))}
        onChange={add}
      />
    </div>
  );
}

/** Dispatch to the per-kind body. */
function StepBody({
  step,
  cols,
  grain,
  narrowed,
  gaps,
  consumed,
  onChange,
}: Readonly<{
  step: Step;
  cols: readonly Column[];
  /** R162 — what one row means HERE (see `grainAt`); only the within-group cards use it. */
  grain: readonly string[] | null;
  /** R164 — the columns that row-narrowing steps above this card filtered on. */
  narrowed: readonly string[];
  /** R165 — how many rows this card's output column is blank in, and whether that
   *  was counted over the whole result or just the current page (walk T2). */
  gaps: { count: number; partial: boolean } | null;
  /** R165 walk T2 — a later `derive` already consumes this card's column, so the
   *  advisory has been TAKEN and stops asking (see `consumedByDerive`). */
  consumed: boolean;
  onChange: (s: Step) => void;
}>) {
  switch (step.kind) {
    case 'aggregate':
      return <AggregateBody step={step} cols={cols} onChange={onChange} />;
    case 'derive':
      return <DeriveBody step={step} cols={cols} onChange={onChange} />;
    case 'filter':
      return <FilterBody step={step} cols={cols} onChange={onChange} />;
    case 'top_n':
      return <TopNBody step={step} cols={cols} onChange={onChange} />;
    case 'sort':
      return <SortBody step={step} cols={cols} onChange={onChange} />;
    case 'select':
      return <SelectBody step={step} cols={cols} onChange={onChange} />;
    case 'date_bucket':
      return <DateBucketBody step={step} cols={cols} onChange={onChange} />;
    case 'date_part':
      return <DatePartBody step={step} cols={cols} onChange={onChange} />;
    case 'date_diff':
      return <DateDiffBody step={step} cols={cols} onChange={onChange} />;
    case 'case':
      return <CaseBody step={step} cols={cols} onChange={onChange} />;
    case 'compute':
      return <ComputeBody step={step} cols={cols} onChange={onChange} />;
    case 'group_column':
      return <GroupColumnBody step={step} cols={cols} grain={grain} narrowed={narrowed} onChange={onChange} />;
    case 'window_column':
      return (
        <WindowColumnBody
          step={step}
          cols={cols}
          grain={grain}
          narrowed={narrowed}
          gaps={gaps}
          consumed={consumed}
          onChange={onChange}
        />
      );
  }
}

// R144 — bucket a temporal column to a granularity, appending a `date` column
// (the period's START date; week = ISO Monday-start). Only date/datetime
// columns are offered — mirrors the backend `bucket_col_not_date` guard.
function DateBucketBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: DateBucketStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  const temporal = cols.filter(isTemporalCol);
  const granularities: DateBucketStep['granularity'][] = ['day', 'week', 'month', 'quarter', 'year'];
  return (
    <Space wrap size={[8, 6]}>
      <FieldLabel text={t('queries.builder.steps.newColumn')}>
        <Input
          size="small"
          style={{ width: 140 }}
          value={step.name}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
        />
      </FieldLabel>
      <FieldLabel text={t('queries.builder.steps.bucketOf')}>
        <Select
          size="small"
          style={{ minWidth: 120 }}
          value={step.col || undefined}
          placeholder="—"
          options={nameOptions(temporal)}
          onChange={(col: string) => onChange({ ...step, col })}
        />
      </FieldLabel>
      <FieldLabel text={t('queries.builder.steps.granularity')}>
        <Select
          size="small"
          style={{ width: 110 }}
          value={step.granularity}
          options={granularities.map((g) => ({
            label: t(`queries.builder.steps.granularity_${g}`),
            value: g,
          }))}
          onChange={(granularity: DateBucketStep['granularity']) => onChange({ ...step, granularity })}
        />
      </FieldLabel>
    </Space>
  );
}

// R175 — one calendar PART of a date as a number (year, month, day of month…).
// The numeric companion of the bucket card: a bucket keeps a date for an axis, a
// part is a number to compare or subtract (vehicle age = lead year − model year).
function DatePartBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: DatePartStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  const parts: DatePartStep['part'][] = ['year', 'quarter', 'month', 'week', 'day', 'dow'];
  return (
    <Space wrap size={[8, 6]}>
      <FieldLabel text={t('queries.builder.steps.newColumn')}>
        <Input
          size="small"
          style={{ width: 140 }}
          value={step.name}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
        />
      </FieldLabel>
      <FieldLabel text={t('queries.builder.steps.partOf')}>
        <Select
          size="small"
          style={{ width: 130 }}
          value={step.part}
          options={parts.map((p) => ({ label: t(`queries.builder.steps.part_${p}`), value: p }))}
          onChange={(part: DatePartStep['part']) => onChange({ ...step, part })}
        />
        <Select
          size="small"
          style={{ minWidth: 120 }}
          value={step.col || undefined}
          placeholder="—"
          options={nameOptions(cols.filter(isTemporalCol))}
          onChange={(col: string) => onChange({ ...step, col })}
        />
      </FieldLabel>
    </Space>
  );
}

// R184 — a function from a CLOSED catalog (v1: trim) applied to one text column,
// written to a NEW column; the source stays as ingested so the difference is
// visible side by side. Only string columns are offered (the server 422s others).
function ComputeBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: ComputeStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  const text = nameOptions(cols.filter((c) => c.dtype === 'string'));
  const fns: ComputeStep['fn'][] = ['trim'];
  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <Space wrap size={[8, 6]}>
        <FieldLabel text={t('queries.builder.steps.newColumn')}>
          <Input
            size="small"
            style={{ width: 140 }}
            value={step.name}
            onChange={(e) => onChange({ ...step, name: e.target.value })}
          />
        </FieldLabel>
        <FieldLabel text={t('queries.builder.steps.computeFn')}>
          <Select
            size="small"
            style={{ width: 170 }}
            value={step.fn}
            options={fns.map((f) => ({ label: t(`queries.builder.steps.fn_${f}`), value: f }))}
            onChange={(fn: ComputeStep['fn']) => onChange({ ...step, fn })}
          />
        </FieldLabel>
        <FieldLabel text={t('queries.builder.steps.computeOf')}>
          <Select
            size="small"
            style={{ minWidth: 140 }}
            value={step.col || undefined}
            placeholder="—"
            options={text}
            onChange={(col: string) => onChange({ ...step, col })}
          />
        </FieldLabel>
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t(`queries.builder.steps.fn_${step.fn}_hint`)}
      </Typography.Text>
    </Space>
  );
}

// R175 — "how many months/days/years from A to B", counted on the CALENDAR
// (31 Aug → 1 Sep is one month). This is what lets a report say "this month" and
// "last month" relative to the data's own cut-off, with no hard-coded date.
function DateDiffBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: DateDiffStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  const temporal = nameOptions(cols.filter(isTemporalCol));
  const units: DateDiffStep['unit'][] = ['day', 'week', 'month', 'quarter', 'year'];
  return (
    <Space wrap size={[8, 6]}>
      <FieldLabel text={t('queries.builder.steps.newColumn')}>
        <Input
          size="small"
          style={{ width: 140 }}
          value={step.name}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
        />
      </FieldLabel>
      <FieldLabel text={t('queries.builder.steps.diffUnit')}>
        <Select
          size="small"
          style={{ width: 110 }}
          value={step.unit}
          options={units.map((u) => ({ label: t(`queries.builder.steps.granularity_${u}`), value: u }))}
          onChange={(unit: DateDiffStep['unit']) => onChange({ ...step, unit })}
        />
      </FieldLabel>
      <FieldLabel text={t('queries.builder.steps.diffFrom')}>
        <Select
          size="small"
          style={{ minWidth: 120 }}
          value={step.start || undefined}
          placeholder="—"
          options={temporal}
          onChange={(start: string) => onChange({ ...step, start })}
        />
      </FieldLabel>
      <FieldLabel text={t('queries.builder.steps.diffTo')}>
        <Select
          size="small"
          style={{ minWidth: 120 }}
          value={step.end || undefined}
          placeholder="—"
          options={temporal}
          onChange={(end: string) => onChange({ ...step, end })}
        />
      </FieldLabel>
    </Space>
  );
}

/** R175 — a THEN / OTHERWISE value: a literal (number when it parses as one) or
 *  a column. The toggle mirrors the derive card's operand-kind switch. */
function CaseValueInput({
  value,
  cols,
  allowBlank,
  onChange,
}: Readonly<{
  value: CaseValue | undefined;
  cols: readonly Column[];
  allowBlank?: boolean;
  onChange: (v: CaseValue | undefined) => void;
}>) {
  const { t } = useTranslation();
  const mode = value === undefined ? 'blank' : value.kind;
  const options = [
    { label: t('queries.builder.steps.valueLiteral'), value: 'const' },
    { label: t('queries.builder.steps.valueColumn'), value: 'col' },
    ...(allowBlank ? [{ label: t('queries.builder.steps.valueBlank'), value: 'blank' }] : []),
  ];
  const parse = (raw: string): string | number =>
    raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : raw;
  return (
    <Space size={4}>
      <Select
        size="small"
        style={{ width: 96 }}
        value={mode}
        options={options}
        onChange={(m: string) => {
          if (m === 'blank') onChange(undefined);
          else if (m === 'col') onChange({ kind: 'col', col: cols[0]?.name ?? '' });
          else onChange({ kind: 'const', value: '' });
        }}
      />
      {value?.kind === 'col' ? (
        <Select
          size="small"
          style={{ minWidth: 120 }}
          value={value.col}
          options={nameOptions(cols)}
          onChange={(col: string) => onChange({ kind: 'col', col })}
        />
      ) : value?.kind === 'const' ? (
        <Input
          size="small"
          style={{ width: 140 }}
          placeholder={t('queries.builder.steps.value')}
          value={String(value.value)}
          onChange={(e) => onChange({ kind: 'const', value: parse(e.target.value) })}
        />
      ) : null}
    </Space>
  );
}

// R175 — the CONDITIONAL COLUMN: Excel's IF/IFS without a formula. Each row is
// "when <conditions, AND> then <value>"; the first matching row wins, else the
// otherwise value. Buckets, 0/1 flags (sum them for a conditional count) and
// "column A unless it is blank" fallbacks are all this one card.
function CaseBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: CaseStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  const nameErrorId = useId();
  const collision = cols.some((c) => c.name === step.name);
  const mismatch = caseDtype(step, cols) === null && step.branches.length > 0;
  const setBranch = (i: number, patch: Partial<CaseStep['branches'][number]>) =>
    onChange({ ...step, branches: step.branches.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <FieldLabel text={t('queries.builder.steps.newColumn')}>
        <Input
          size="small"
          style={{ width: 160 }}
          value={step.name}
          status={collision ? 'error' : undefined}
          aria-invalid={collision || undefined}
          aria-errormessage={collision ? nameErrorId : undefined}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
        />
      </FieldLabel>
      {collision ? (
        <Typography.Text type="danger" id={nameErrorId} style={{ fontSize: 12 }}>
          {t('queries.builder.steps.nameCollision', { name: step.name })}
        </Typography.Text>
      ) : null}
      {step.branches.map((branch, i) => (
        <div
          key={i}
          data-component="CaseBranch"
          style={{ borderInlineStart: '2px solid var(--ant-color-border, #d9d9d9)', paddingInlineStart: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <PredicateList
                predicates={branch.when}
                cols={cols}
                firstLabel={t('queries.builder.steps.caseWhen')}
                onChange={(when) => setBranch(i, { when })}
              />
            </div>
            {step.branches.length > 1 ? (
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t('queries.builder.steps.removeBranch')}
                onClick={() => onChange({ ...step, branches: step.branches.filter((_, j) => j !== i) })}
              />
            ) : null}
          </div>
          <FieldLabel text={t('queries.builder.steps.caseThen')}>
            <CaseValueInput value={branch.then} cols={cols} onChange={(v) => v && setBranch(i, { then: v })} />
          </FieldLabel>
        </div>
      ))}
      <Button
        type="link"
        size="small"
        icon={<PlusOutlined />}
        style={{ alignSelf: 'flex-start', padding: 0 }}
        disabled={step.branches.length >= 20}
        onClick={() =>
          onChange({
            ...step,
            branches: [
              ...step.branches,
              { when: [{ col: cols[0]?.name ?? '', op: 'equals', val: '' }], then: { kind: 'const', value: '' } },
            ],
          })
        }
        data-component="CaseAddBranch"
      >
        {t('queries.builder.steps.addBranch')}
      </Button>
      <FieldLabel text={t('queries.builder.steps.caseOtherwise')}>
        <CaseValueInput
          value={step.otherwise}
          cols={cols}
          allowBlank
          onChange={(otherwise) => onChange({ ...step, otherwise })}
        />
      </FieldLabel>
      {mismatch ? (
        <Alert
          role="alert"
          type="error"
          showIcon
          data-component="CaseTypeMismatch"
          title={t('queries.builder.steps.caseMismatch')}
        />
      ) : null}
    </div>
  );
}

// R164 — the four ordered-window operations, in business words. The op labels are
// the ONLY name a user sees for this family: the wire kind (`window_column`) and
// the words "window", "partition", and "frame" appear nowhere on the surface.
const WINDOW_OPS: readonly WindowOp[] = ['pct_of_total', 'running_total', 'rank', 'prior_period'];

function opLabel(t: (k: string) => string, op: WindowOp): string {
  return {
    pct_of_total: t('queries.builder.steps.opPctOfTotal'),
    running_total: t('queries.builder.steps.opRunningTotal'),
    rank: t('queries.builder.steps.opRank'),
    prior_period: t('queries.builder.steps.opPriorPeriod'),
  }[op];
}

// R162/R164 — the grain line: one advisory sentence naming what a row means at
// THIS position. It rewrites itself when the card moves past an `aggregate`, so
// pooled-vs-average-of-groups is one keystroke apart and each reading is named in
// business words.
//
// R164 adds the SECOND clause: the row-narrowing steps above the card. R163
// demonstrated on real data that a `filter` moved above a within-group card
// collapses its denominator — every rate reads 100.0% — while the sentence said
// nothing, because it tracked position relative to `aggregate` only. Both card
// families share this component, so that fix lands on the shipped card too.
//
// It is ADVISORY: a live region, icon + text, never an <Alert>, never an error.
function GrainLine({
  grain,
  narrowed,
  component,
}: Readonly<{ grain: readonly string[] | null; narrowed: readonly string[]; component: string }>) {
  const { t } = useTranslation();
  const grainText =
    grain === null
      ? t('queries.builder.steps.grainRows')
      : grain.length > 0
        ? t('queries.builder.steps.grainGrouped', { grain: grain.join(' × ') })
        : t('queries.builder.steps.grainGroupedAnon');
  const filterText =
    narrowed.length > 0 ? ` ${t('queries.builder.steps.grainFiltered', { cols: narrowed.join(', ') })}` : '';
  return (
    <Typography.Text
      type="secondary"
      role="status"
      aria-live="polite"
      style={{ fontSize: 12 }}
      data-component={component}
    >
      {`ⓘ ${grainText}${filterText}`}
    </Typography.Text>
  );
}

// R164 — the ORDERED-WINDOW card. One kind, four operations, one card: the fields
// shown are the ones the chosen op actually takes, because a field an op REJECTS
// is a 422 on the wire, not something to render and ignore.
//
// `Within each` may be left EMPTY here (unlike the Group value card), and the
// empty state renders as the words "Across everything" rather than a blank
// control — R163's `group_by_required` guard exists against a SILENT whole-table
// window, and a named state is not silent.
function WindowColumnBody({
  step,
  cols,
  grain,
  narrowed,
  gaps,
  consumed,
  onChange,
}: Readonly<{
  step: WindowColumnStep;
  cols: readonly Column[];
  grain: readonly string[] | null;
  narrowed: readonly string[];
  gaps: { count: number; partial: boolean } | null;
  consumed: boolean;
  onChange: (s: Step) => void;
}>) {
  const { t } = useTranslation();
  const nameErrorId = useId();
  const valuePool = windowColumnPool(step.op, cols);
  const orderPool = windowOrderPool(step.op, cols);
  const { orphaned, collision } = windowColumnIssues(step, cols);
  const orderKey = step.orderBy?.[0];
  const granularities: DateBucketStep['granularity'][] = ['day', 'week', 'month', 'quarter', 'year'];

  // Switching the op re-derives the fields the NEW op takes and drops the ones it
  // rejects, so the step is never momentarily in a shape its own contract forbids.
  const setOp = (op: WindowOp) => {
    const pool = windowColumnPool(op, cols);
    const col = op === 'rank' ? undefined : pool.some((c) => c.name === step.col) ? step.col : pool[0]?.name;
    const nextOrder = windowOrderPool(op, cols);
    const keep = orderKey && nextOrder.some((c) => c.name === orderKey.col) ? orderKey : undefined;
    const first = nextOrder[0]?.name;
    const nextOrderBy = keep ? [keep] : first ? [{ col: first, descending: false }] : [];
    onChange({
      kind: 'window_column',
      op,
      // Rename ONLY while the name is still the previous op's default — an
      // explicitly typed name is the user's and is never overwritten.
      name: step.name === defaultWindowName(step.op, step.col) ? defaultWindowName(op, col) : step.name,
      col,
      by: step.by,
      ...(op === 'pct_of_total' ? {} : { orderBy: nextOrderBy }),
      ...(op === 'prior_period' ? { unit: step.unit ?? 'month' } : {}),
    });
  };

  return (
    <>
      <Space wrap size={[8, 6]}>
        <FieldLabel text={t('queries.builder.steps.what')}>
          <Select
            size="small"
            style={{ width: 190 }}
            aria-label={t('queries.builder.steps.what')}
            value={step.op}
            options={WINDOW_OPS.map((op) => ({
              label: opLabel(t, op),
              value: op,
              // D4 — unofferable at the gesture, with the reason in a tooltip.
              disabled: !windowOpAvailable(op, cols),
              title: windowOpAvailable(op, cols) ? undefined : t('queries.builder.steps.noEligibleOp'),
            }))}
            onChange={setOp}
          />
        </FieldLabel>

        {step.op === 'rank' ? null : (
          <FieldLabel text={t('queries.builder.steps.value')}>
            <Select
              size="small"
              style={{ minWidth: 120 }}
              aria-label={t('queries.builder.steps.value')}
              value={step.col}
              placeholder="—"
              disabled={valuePool.length === 0}
              title={valuePool.length === 0 ? t('queries.builder.steps.noEligibleColumn') : undefined}
              options={nameOptions(valuePool)}
              onChange={(col: string) => onChange({ ...step, col })}
            />
          </FieldLabel>
        )}

        {step.op === 'pct_of_total' ? null : (
          <FieldLabel text={t('queries.builder.steps.inOrderOf')}>
            <Select
              size="small"
              style={{ minWidth: 120 }}
              aria-label={t('queries.builder.steps.inOrderOf')}
              value={orderKey?.col}
              placeholder="—"
              disabled={orderPool.length === 0}
              title={orderPool.length === 0 ? t('queries.builder.steps.noEligibleColumn') : undefined}
              options={nameOptions(orderPool)}
              onChange={(col: string) => onChange({ ...step, orderBy: [{ col, descending: false }] })}
            />
          </FieldLabel>
        )}

        {step.op === 'prior_period' ? (
          <FieldLabel text={t('queries.builder.steps.granularity')}>
            <Select
              size="small"
              style={{ width: 110 }}
              aria-label={t('queries.builder.steps.granularity')}
              value={step.unit ?? 'month'}
              options={granularities.map((g) => ({ label: t(`queries.builder.steps.granularity_${g}`), value: g }))}
              onChange={(unit: DateBucketStep['granularity']) => onChange({ ...step, unit })}
            />
          </FieldLabel>
        ) : null}

        <FieldLabel text={t('queries.builder.steps.withinEach')}>
          <Select
            mode="multiple"
            size="small"
            style={{ minWidth: 160 }}
            aria-label={t('queries.builder.steps.withinEach')}
            value={[...step.by]}
            // The empty case is a NAMED state, not a blank field: a whole-table
            // window is a choice the user can see and a screen reader can read.
            placeholder={t('queries.builder.steps.acrossEverything')}
            options={nameOptions(cols)}
            onChange={(by: string[]) => onChange({ ...step, by })}
          />
        </FieldLabel>

        <FieldLabel text={t('queries.builder.steps.newColumn')}>
          <Input
            size="small"
            style={{ width: 140 }}
            aria-label={t('queries.builder.steps.newColumn')}
            value={step.name}
            status={collision ? 'error' : undefined}
            aria-invalid={collision || undefined}
            aria-errormessage={collision ? nameErrorId : undefined}
            onChange={(e) => onChange({ ...step, name: e.target.value })}
          />
        </FieldLabel>
      </Space>

      {collision ? (
        <Typography.Text type="danger" id={nameErrorId} style={{ fontSize: 12 }} data-component="WindowColumnNameError">
          {t('queries.builder.steps.nameCollision', { name: step.name })}
        </Typography.Text>
      ) : null}

      {orphaned.length > 0 ? (
        <Alert
          role="alert"
          type="error"
          showIcon
          data-component="WindowColumnOrphaned"
          title={t('queries.builder.steps.orphanedColumn', { cols: orphaned.join(', ') })}
        />
      ) : null}

      {/* R164 — `prior_period` emits the previous period's VALUE, so a
          month-over-month tile is TWO steps. R163's realised failure was a human
          building a chain with the `derive` steps missing and the product agreeing
          all the way to a dashboard-ready table — so the card names the next step,
          in the menu's own words, with the real column names in it. ADVISORY: it
          never blocks Save, and it does NOT auto-insert the step (silently adding
          an operation nobody asked for is the opposite of ordered operations). */}
      {step.op === 'prior_period' && step.col ? (
        <Typography.Text
          type="secondary"
          role="status"
          aria-live="polite"
          style={{ fontSize: 12 }}
          data-component="PriorPeriodHint"
        >
          {`ⓘ ${t('queries.builder.steps.priorPeriodHint', { col: step.col })}`}
          {/* R165 walk T2 — the INSTRUCTION half stops once a later `derive`
              consumes this column: advice that repeats after you have taken it is
              a scold, and it also trains the reader to stop reading the line the
              gap count lives on. The DESCRIPTION half above and the gap count
              below are facts, so both stay either way. */}
          {consumed
            ? ''
            : ` ${t('queries.builder.steps.priorPeriodAdd', {
                col: step.col,
                name: step.name,
                step: t('queries.builder.steps.kindDerive'),
              })}`}
          {/* R165 — blank means two things; only ONE of them is a data problem.
              The count is read off the shaped preview, so it needs no wire field. */}
          {gaps?.count
            ? ` ${t(
                gaps.partial ? 'queries.builder.steps.priorPeriodGapsPage' : 'queries.builder.steps.priorPeriodGaps',
                { count: gaps.count, col: step.orderBy?.[0]?.col ?? '' },
              )}`
            : ''}
        </Typography.Text>
      ) : null}

      <GrainLine grain={grain} narrowed={narrowed} component="WindowColumnGrain" />
    </>
  );
}

// R162 — the WITHIN-GROUP column ("Group value"). Deliberately the SAME
// vocabulary as AggregateBody's measure picker, with the opposite effect on the
// row count: aggregate collapses, this one keeps every row and appends the
// group's value beside it. That is the whole point — comparing a row to its
// group needed two shaped results only because this half was never shipped.
//
// There is NO `basis` control. Pooled-vs-average-of-groups is decided by WHERE
// the card sits relative to a collapsing aggregate (R162 D gate); the grain line
// below is what makes that choice legible instead of a parameter.
function GroupColumnBody({
  step,
  cols,
  grain,
  narrowed,
  onChange,
}: Readonly<{
  step: GroupColumnStep;
  cols: readonly Column[];
  grain: readonly string[] | null;
  narrowed: readonly string[];
  onChange: (s: Step) => void;
}>) {
  const { t } = useTranslation();
  const nameErrorId = useId();
  const pool = groupColumnPool(step.agg, cols);
  // R163 — the two states the REORDER gesture creates. The move is never blocked,
  // so the card is where the consequence has to be visible.
  const { orphaned, collision } = groupColumnIssues(step, cols);
  const setAgg = (agg: AggregateMeasure['agg']) => {
    if (agg === 'count') return onChange({ ...step, agg, col: undefined });
    const next = groupColumnPool(agg, cols);
    // Keep the current column when the new agg still accepts it; else the pool's first.
    const col = next.some((c) => c.name === step.col) ? step.col : next[0]?.name;
    onChange({ ...step, agg, col });
  };
  return (
    <>
      <Space wrap size={[8, 6]}>
        <FieldLabel text={t('queries.builder.steps.measure')}>
          <Select
            size="small"
            style={{ width: 140 }}
            aria-label={t('queries.builder.steps.measure')}
            value={step.agg}
            options={[
              { label: t('queries.builder.steps.sumOf'), value: 'sum' },
              { label: t('queries.builder.steps.avgOf'), value: 'avg' },
              { label: t('queries.builder.steps.minOf'), value: 'min' },
              { label: t('queries.builder.steps.maxOf'), value: 'max' },
              { label: t('queries.builder.steps.countDistinct'), value: 'count_distinct' },
              { label: t('queries.builder.steps.countRows'), value: 'count' },
            ]}
            onChange={setAgg}
          />
          {step.agg === 'count' ? null : (
            <Select
              size="small"
              style={{ minWidth: 120 }}
              value={step.col}
              placeholder="—"
              // Nothing to offer → disabled with a reason, never an empty open dropdown.
              disabled={pool.length === 0}
              title={pool.length === 0 ? t('queries.builder.steps.noEligibleColumn') : undefined}
              options={nameOptions(pool)}
              onChange={(col: string) => onChange({ ...step, col })}
            />
          )}
        </FieldLabel>
        <FieldLabel text={t('queries.builder.steps.withinEach')}>
          <Select
            mode="multiple"
            size="small"
            style={{ minWidth: 160 }}
            aria-label={t('queries.builder.steps.withinEach')}
            value={[...step.by]}
            // R175 — empty is legal (the whole table) and NAMED, never blank: the
            // same "Across everything" state the ordered-window card renders.
            placeholder={t('queries.builder.steps.acrossEverything')}
            options={nameOptions(cols)}
            onChange={(by: string[]) => onChange({ ...step, by })}
          />
        </FieldLabel>
        <FieldLabel text={t('queries.builder.steps.newColumn')}>
          <Input
            size="small"
            style={{ width: 140 }}
            aria-label={t('queries.builder.steps.newColumn')}
            value={step.name}
            // Name collision (the backend's `column_exists`) → an inline field
            // error tied to the input, not a page-level alert.
            status={collision ? 'error' : undefined}
            aria-invalid={collision || undefined}
            aria-errormessage={collision ? nameErrorId : undefined}
            onChange={(e) => onChange({ ...step, name: e.target.value })}
          />
        </FieldLabel>
      </Space>
      {collision ? (
        <Typography.Text type="danger" id={nameErrorId} style={{ fontSize: 12 }} data-component="GroupColumnNameError">
          {t('queries.builder.steps.nameCollision', { name: step.name })}
        </Typography.Text>
      ) : null}
      {orphaned.length > 0 ? (
        <Alert
          role="alert"
          type="error"
          showIcon
          data-component="GroupColumnOrphaned"
          title={t('queries.builder.steps.orphanedColumn', { cols: orphaned.join(', ') })}
        />
      ) : null}
      <GrainLine grain={grain} narrowed={narrowed} component="GroupColumnGrain" />
    </>
  );
}

function AggregateBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: AggregateStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  const numeric = cols.filter(isNumericCol);
  const orderable = cols.filter(isOrderableCol);
  // R140 — the column pool each agg draws from (mirrors the backend dtype rules).
  const poolFor = (agg: AggregateMeasure['agg']): readonly Column[] => {
    if (agg === 'sum' || agg === 'avg') return numeric;
    if (agg === 'min' || agg === 'max') return orderable;
    return cols; // count_distinct — any column
  };
  const measures = step.measures.length > 0 ? step.measures : [{ agg: 'count' as const }];
  const setMeasures = (next: AggregateMeasure[]) => onChange({ ...step, measures: next });
  const setAgg = (i: number, agg: AggregateMeasure['agg']) => {
    const m = measures[i];
    if (agg === 'count') return setMeasures(measures.map((x, j) => (j === i ? { agg } : x)));
    const pool = poolFor(agg);
    // Keep the current col when the new agg still accepts it; else the pool's first.
    const col = pool.some((c) => c.name === m.col) ? m.col : pool[0]?.name;
    setMeasures(measures.map((x, j) => (j === i ? { agg, col } : x)));
  };
  // R175 — a new measure defaults to the next numeric column not yet summed.
  const addMeasure = () => {
    const used = new Set(measures.map((m) => m.col));
    const next = numeric.find((c) => !used.has(c.name));
    setMeasures([...measures, next ? { agg: 'sum', col: next.name } : { agg: 'count' }]);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <FieldLabel text={t('queries.builder.steps.groupBy')}>
        <Select
          mode="multiple"
          size="small"
          style={{ minWidth: 160 }}
          value={[...step.dimensions]}
          options={nameOptions(cols)}
          onChange={(dimensions: string[]) => onChange({ ...step, dimensions })}
        />
      </FieldLabel>
      {measures.map((measure, i) => (
        <Space key={i} wrap size={[8, 6]} data-component="AggregateMeasureRow">
          <FieldLabel text={i === 0 ? t('queries.builder.steps.measure') : t('queries.builder.steps.andMeasure')}>
            <Select
              size="small"
              style={{ width: 140 }}
              value={measure.agg}
              options={[
                { label: t('queries.builder.steps.sumOf'), value: 'sum' },
                { label: t('queries.builder.steps.avgOf'), value: 'avg' },
                { label: t('queries.builder.steps.minOf'), value: 'min' },
                { label: t('queries.builder.steps.maxOf'), value: 'max' },
                { label: t('queries.builder.steps.countDistinct'), value: 'count_distinct' },
                { label: t('queries.builder.steps.countRows'), value: 'count' },
              ]}
              onChange={(agg: AggregateMeasure['agg']) => setAgg(i, agg)}
            />
            {measure.agg === 'count' ? null : (
              <Select
                size="small"
                style={{ minWidth: 120 }}
                value={measure.col}
                placeholder="—"
                options={nameOptions(poolFor(measure.agg))}
                onChange={(col: string) => setMeasures(measures.map((x, j) => (j === i ? { agg: x.agg, col } : x)))}
              />
            )}
          </FieldLabel>
          {measures.length > 1 ? (
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              aria-label={t('queries.builder.steps.removeMeasure')}
              onClick={() => setMeasures(measures.filter((_, j) => j !== i))}
            />
          ) : null}
        </Space>
      ))}
      <Button
        type="link"
        size="small"
        icon={<PlusOutlined />}
        style={{ alignSelf: 'flex-start', padding: 0 }}
        onClick={addMeasure}
        data-component="AggregateAddMeasure"
      >
        {t('queries.builder.steps.addMeasure')}
      </Button>
    </div>
  );
}

function DeriveBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: DeriveStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  const numeric = cols.filter(isNumericCol);
  const right = step.right;
  // Same preference as `blankStep`: switching to a column lands on one you would
  // actually compare against rather than on `left` itself (`count − count`).
  const otherNum = [...numeric].reverse().find((c) => c.name !== step.left) ?? numeric[0];
  return (
    <Space wrap size={[8, 6]}>
      <FieldLabel text={t('queries.builder.steps.newColumn')}>
        <Input
          size="small"
          style={{ width: 140 }}
          value={step.name}
          onChange={(e) => onChange({ ...step, name: e.target.value })}
        />
      </FieldLabel>
      <Select
        size="small"
        style={{ minWidth: 120 }}
        value={step.left}
        options={nameOptions(numeric)}
        onChange={(left: string) => onChange({ ...step, left })}
      />
      <Select
        size="small"
        style={{ width: 64 }}
        value={step.op}
        options={['+', '-', '*', '/'].map((o) => ({ label: o, value: o }))}
        onChange={(op: DeriveStep['op']) => onChange({ ...step, op })}
      />
      {/* R165 walk T1 — the toggle is the control that decides what this row IS
          (column−column or column−literal), but unlabelled it read as one more
          value picker among four. It carries its own label now, like every other
          field on the card. */}
      <FieldLabel text={t('queries.builder.steps.rightKind')}>
        {/* R171 item 5 — R165 W-1's second half. The label made this control
            FINDABLE; it still did not read as PRESSABLE, and the re-walk said
            so ("vẫn chưa thật 'rõ' lắm để biết nó là 1 toggle"). Cause: antd's
            `Segmented` paints its selected item as a white raised thumb, and
            this card is white — so only the UNSELECTED half carried any grey,
            i.e. the half that looks pressable is the one that isn't.
            `Radio.Group optionType="button"` boxes BOTH halves, so the control
            reads as a switch from either state, and the filled half reads as
            the current one. */}
        <Radio.Group
          size="small"
          optionType="button"
          buttonStyle="solid"
          value={right.kind}
          options={[
            { label: t('queries.builder.steps.byColumn'), value: 'col' },
            { label: t('queries.builder.steps.byNumber'), value: 'const' },
          ]}
          onChange={(e) => {
            const k = e.target.value as 'col' | 'const';
            onChange({
              ...step,
              right: k === 'col' ? { kind: 'col', col: otherNum?.name ?? '' } : { kind: 'const', value: 0 },
            });
          }}
          data-component="DeriveOperandKind"
        />
      </FieldLabel>
      {right.kind === 'col' ? (
        <Select
          size="small"
          style={{ minWidth: 120 }}
          value={right.col}
          options={nameOptions(numeric)}
          onChange={(col: string) => onChange({ ...step, right: { kind: 'col', col } })}
        />
      ) : (
        <InputNumber
          size="small"
          value={right.value}
          onChange={(value) => onChange({ ...step, right: { kind: 'const', value: value ?? 0 } })}
        />
      )}
    </Space>
  );
}

function FilterBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: FilterStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  return (
    <PredicateList
      predicates={step.predicates}
      cols={cols}
      firstLabel={t('queries.builder.steps.where')}
      onChange={(predicates) => onChange({ ...step, predicates })}
    />
  );
}

/** R175 — operators that take no operand (mirrors the backend `_NO_VALUE_OPS`). */
const NO_VALUE_OPS = new Set(['is_empty', 'is_not_empty', 'is_null', 'is_not_null', 'is_true', 'is_false']);

/** R176 — atom-only list operators (mirrors the backend `_LIST_OPS`); not on booleans. */
const LIST_OPS = ['in', 'not_in'] as const;
const isListOp = (op: string) => (LIST_OPS as readonly string[]).includes(op);
/** R176 — comparison ops that may take another column instead of a value (backend `_REF_OPS`). */
const REF_OPS = new Set(['equals', 'ne', 'gt', 'lt', 'gte', 'lte', 'before', 'after']);
/** R176 — dtype families a column operand must share (backend `_DTYPE_FAMILY`). */
const dtypeFamily = (dt: string | undefined) =>
  dt === 'integer' || dt === 'float' ? 'number' : dt === 'date' || dt === 'datetime' ? 'time' : dt;

/** R176 — the operators a predicate row offers for `dtype`: the chip vocabulary plus the list ops. */
export function predicateOps(dtype: string): string[] {
  const base = [...(OPS_BY_DTYPE[dtype as keyof typeof OPS_BY_DTYPE] ?? [])] as string[];
  return dtype === 'boolean' ? base : [...base, ...LIST_OPS];
}

/** R175 — an AND-list of predicates in the filter vocabulary, shared by the
 *  filter card and each WHEN of the conditional column. It used to edit only
 *  `predicates[0]`, which silently dropped the rest of a definition saved through
 *  the API on the first keystroke; every predicate is now a row. A numeric or
 *  date column takes its operand as typed text and the backend parses it — the
 *  same contract as the source chip filters. `between` shows min/max. */
function PredicateList({
  predicates,
  cols,
  firstLabel,
  onChange,
}: Readonly<{
  predicates: readonly FilterStepPredicate[];
  cols: readonly Column[];
  firstLabel: string;
  onChange: (next: FilterStepPredicate[]) => void;
}>) {
  const { t } = useTranslation();
  const rows = predicates.length > 0 ? predicates : [{ col: cols[0]?.name ?? '', op: 'equals' }];
  const setRow = (i: number, patch: Partial<FilterStepPredicate>) =>
    onChange(rows.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const numericOperand = (col: string) => {
    const dt = cols.find((c) => c.name === col)?.dtype;
    return dt === 'integer' || dt === 'float';
  };
  const asOperand = (col: string, raw: string): string | number => {
    if (numericOperand(col) && raw.trim() !== '' && Number.isFinite(Number(raw))) return Number(raw);
    return raw;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-component="PredicateList">
      {rows.map((pred, i) => {
        const dtype = cols.find((c) => c.name === pred.col)?.dtype ?? 'string';
        const ops = predicateOps(dtype);
        const refable = REF_OPS.has(pred.op);
        const refMode = refable && pred.refCol !== undefined;
        const refOptions = cols
          .filter((c) => c.name !== pred.col && dtypeFamily(c.dtype) === dtypeFamily(dtype))
          .map((c) => ({ label: c.name, value: c.name }));
        return (
          <Space key={i} wrap size={[8, 6]} data-component="PredicateRow">
            <FieldLabel text={i === 0 ? firstLabel : t('queries.builder.steps.and')}>
              <Select
                size="small"
                style={{ minWidth: 120 }}
                value={pred.col}
                options={nameOptions(cols)}
                onChange={(col: string) => setRow(i, { col })}
              />
            </FieldLabel>
            <Select
              size="small"
              style={{ minWidth: 110 }}
              value={pred.op}
              options={ops.map((o) => ({ label: o, value: o }))}
              onChange={(op: string) => {
                const cleared = { val: undefined, min: undefined, max: undefined, vals: undefined, refCol: undefined };
                if (NO_VALUE_OPS.has(op)) setRow(i, { op, ...cleared });
                else if (isListOp(op)) setRow(i, { ...cleared, op, vals: pred.vals ?? [] });
                else
                  setRow(i, {
                    op,
                    vals: undefined,
                    refCol: REF_OPS.has(op) ? pred.refCol : undefined,
                  });
              }}
              data-component="PredicateOp"
            />
            {refable ? (
              <Select
                size="small"
                style={{ minWidth: 90 }}
                value={refMode ? 'column' : 'value'}
                aria-label={t('queries.builder.steps.operandKind')}
                options={[
                  { label: t('queries.builder.steps.operandValue'), value: 'value' },
                  { label: t('queries.builder.steps.operandColumn'), value: 'column' },
                ]}
                onChange={(kind: string) =>
                  setRow(
                    i,
                    kind === 'column'
                      ? { val: undefined, refCol: refOptions[0]?.value ?? '' }
                      : { refCol: undefined, val: '' },
                  )
                }
                data-component="PredicateOperandKind"
              />
            ) : null}
            {refMode ? (
              <Select
                size="small"
                style={{ minWidth: 140 }}
                value={pred.refCol || undefined}
                placeholder={t('queries.builder.steps.pickColumn')}
                options={refOptions}
                onChange={(refCol: string) => setRow(i, { refCol })}
                data-component="PredicateRefCol"
              />
            ) : isListOp(pred.op) ? (
              <Select
                size="small"
                mode="tags"
                style={{ minWidth: 220 }}
                tokenSeparators={[',']}
                placeholder={t('queries.builder.steps.values')}
                aria-label={t('queries.builder.steps.values')}
                value={(pred.vals ?? []).map(String)}
                open={false}
                onChange={(next: string[]) => setRow(i, { vals: next.map((v) => asOperand(pred.col, v)) })}
                data-component="PredicateValues"
              />
            ) : pred.op === 'between' ? (
              <>
                <Input
                  size="small"
                  style={{ width: 100 }}
                  placeholder={t('queries.builder.steps.min')}
                  value={(pred.min as string | number | undefined) ?? ''}
                  onChange={(e) => setRow(i, { min: asOperand(pred.col, e.target.value) })}
                />
                <Input
                  size="small"
                  style={{ width: 100 }}
                  placeholder={t('queries.builder.steps.max')}
                  value={(pred.max as string | number | undefined) ?? ''}
                  onChange={(e) => setRow(i, { max: asOperand(pred.col, e.target.value) })}
                />
              </>
            ) : NO_VALUE_OPS.has(pred.op) ? null : (
              <Input
                size="small"
                style={{ width: 120 }}
                placeholder={t('queries.builder.steps.value')}
                value={(pred.val as string | number | undefined) ?? ''}
                onChange={(e) => setRow(i, { val: asOperand(pred.col, e.target.value) })}
              />
            )}
            {rows.length > 1 ? (
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                aria-label={t('queries.builder.steps.removeCondition')}
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              />
            ) : null}
          </Space>
        );
      })}
      <Button
        type="link"
        size="small"
        icon={<PlusOutlined />}
        style={{ alignSelf: 'flex-start', padding: 0 }}
        onClick={() => onChange([...rows, { col: cols[0]?.name ?? '', op: 'equals', val: '' }])}
        data-component="PredicateAdd"
      >
        {t('queries.builder.steps.addCondition')}
      </Button>
    </div>
  );
}

function TopNBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: TopNStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  return (
    <Space wrap size={[8, 6]}>
      <FieldLabel text={t('queries.builder.steps.keepFirst')}>
        <InputNumber size="small" min={1} value={step.n} onChange={(n) => onChange({ ...step, n: n ?? 1 })} />
      </FieldLabel>
      <FieldLabel text={t('queries.builder.steps.orderBy')}>
        <Select
          size="small"
          style={{ minWidth: 120 }}
          value={step.col}
          options={nameOptions(cols)}
          onChange={(col: string) => onChange({ ...step, col })}
        />
      </FieldLabel>
      <FieldLabel text={t('queries.builder.steps.highestFirst')}>
        <Switch
          size="small"
          checked={step.descending ?? false}
          onChange={(descending) => onChange({ ...step, descending })}
        />
      </FieldLabel>
    </Space>
  );
}

function SortBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: SortStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  const setKey = (i: number, patch: Partial<SortStep['keys'][number]>) =>
    onChange({ ...step, keys: step.keys.map((k, j) => (j === i ? { ...k, ...patch } : k)) });
  const removeKey = (i: number) => onChange({ ...step, keys: step.keys.filter((_, j) => j !== i) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {step.keys.map((key, i) => (
        <Space key={i} wrap size={[8, 6]}>
          <FieldLabel text={i === 0 ? t('queries.builder.steps.sortBy') : t('queries.builder.steps.thenBy')}>
            <Select
              size="small"
              style={{ minWidth: 120 }}
              value={key.col}
              options={nameOptions(cols)}
              onChange={(col: string) => setKey(i, { col })}
            />
          </FieldLabel>
          <FieldLabel text={t('queries.builder.steps.highestFirst')}>
            <Switch
              size="small"
              checked={key.descending ?? false}
              onChange={(descending) => setKey(i, { descending })}
            />
          </FieldLabel>
          {step.keys.length > 1 && (
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('queries.builder.steps.removeKey')}
              onClick={() => removeKey(i)}
            />
          )}
        </Space>
      ))}
      <Button
        size="small"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onChange({ ...step, keys: [...step.keys, { col: cols[0]?.name ?? '', descending: false }] })}
      >
        {t('queries.builder.steps.addKey')}
      </Button>
    </div>
  );
}

function SelectBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: SelectStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  const setCol = (i: number, patch: Partial<SelectStep['cols'][number]>) =>
    onChange({ ...step, cols: step.cols.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const removeCol = (i: number) => onChange({ ...step, cols: step.cols.filter((_, j) => j !== i) });
  const moveCol = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= step.cols.length) return;
    const next = [...step.cols];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...step, cols: next });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {step.cols.map((entry, i) => (
        <Space key={i} wrap size={[8, 6]}>
          <Space size={0}>
            <Button
              type="text"
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={i === 0}
              aria-label={t('queries.builder.steps.up')}
              onClick={() => moveCol(i, -1)}
            />
            <Button
              type="text"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={i === step.cols.length - 1}
              aria-label={t('queries.builder.steps.down')}
              onClick={() => moveCol(i, 1)}
            />
          </Space>
          <Select
            size="small"
            style={{ minWidth: 120 }}
            value={entry.col}
            options={nameOptions(cols)}
            onChange={(col: string) => setCol(i, { col })}
          />
          <Input
            size="small"
            style={{ width: 140 }}
            placeholder={t('queries.builder.steps.renameOptional')}
            value={entry.name ?? ''}
            onChange={(e) => setCol(i, { name: e.target.value || undefined })}
          />
          {step.cols.length > 1 && (
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('queries.builder.steps.removeColumn')}
              onClick={() => removeCol(i)}
            />
          )}
        </Space>
      ))}
      <Button
        size="small"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onChange({ ...step, cols: [...step.cols, { col: cols[0]?.name ?? '' }] })}
      >
        {t('queries.builder.steps.addColumn')}
      </Button>
    </div>
  );
}

function FieldLabel({ text, children }: Readonly<{ text: string; children: React.ReactNode }>) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {text}
      </Typography.Text>
      {children}
    </span>
  );
}

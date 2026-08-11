// R125 — the transform-steps authoring UI (the "workflow" surface). Renders the
// query's ordered `steps` as cards over the PRE-step column space, threading the
// evolving columns through each step (steps.ts) so every step offers the columns
// available AT that point. Edits call `onChange` with the next step list; the
// live preview (which sends the steps) shows the shaped result. R129 — works for
// ALL query shapes (single-source / joined / composed): the preview reports the
// PRE-step `baseColumns` the builder feeds here. One measure per aggregate / one
// predicate per filter (chain steps for more). Backend re-validates on preview/save.

import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons';
import { Alert, Button, Input, InputNumber, Segmented, Select, Space, Switch, Typography } from 'antd';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { OPS_BY_DTYPE, type Operator } from '@/features/data-management/datasets/filters/types';
import type { Column } from '@/features/data-management/datasets/types';
import {
  STEP_KINDS,
  blankStep,
  grainAt,
  groupColumnIssues,
  groupColumnPool,
  isNumericCol,
  isOrderableCol,
  isTemporalCol,
  threadColumns,
} from './steps';
import type {
  AggregateMeasure,
  AggregateStep,
  DateBucketStep,
  DeriveStep,
  GroupColumnStep,
  FilterStep,
  SelectStep,
  SortStep,
  Step,
  TopNStep,
} from './types';

type StepsEditorProps = Readonly<{
  steps: readonly Step[];
  /** The PRE-step (base) column space — single-source dataset columns in v1. */
  columns: readonly Column[];
  onChange: (steps: Step[]) => void;
}>;

const nameOptions = (cols: readonly Column[]) => cols.map((c) => ({ label: c.name, value: c.name }));

export function StepsEditor({ steps, columns, onChange }: StepsEditorProps) {
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
  const add = (kind: Step['kind']) => onChange([...steps, blankStep(kind, final)]);

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
    })[kind];

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
              {i + 1}. {kindLabel(step.kind)}
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
            onChange={(next) => replace(i, next)}
          />
        </div>
      ))}

      <Select
        data-component="AddStepSelect"
        size="small"
        value={null}
        placeholder={t('queries.builder.steps.add')}
        style={{ width: 180 }}
        options={STEP_KINDS.map((k) => ({ label: kindLabel(k), value: k }))}
        onChange={(k: Step['kind']) => add(k)}
      />
    </div>
  );
}

/** Dispatch to the per-kind body. */
function StepBody({
  step,
  cols,
  grain,
  onChange,
}: Readonly<{
  step: Step;
  cols: readonly Column[];
  /** R162 — what one row means HERE (see `grainAt`); only the group-value card uses it. */
  grain: readonly string[] | null;
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
    case 'group_column':
      return <GroupColumnBody step={step} cols={cols} grain={grain} onChange={onChange} />;
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
  onChange,
}: Readonly<{
  step: GroupColumnStep;
  cols: readonly Column[];
  grain: readonly string[] | null;
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
  // The grain line: one sentence naming what a row means at THIS position. It
  // rewrites itself when the card is moved past an aggregate, so the two readings
  // are one keystroke apart and each is named in business words.
  const grainText =
    grain === null
      ? t('queries.builder.steps.grainRows')
      : grain.length > 0
        ? t('queries.builder.steps.grainGrouped', { grain: grain.join(' × ') })
        : t('queries.builder.steps.grainGroupedAnon');
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
      <Typography.Text
        type="secondary"
        role="status"
        aria-live="polite"
        style={{ fontSize: 12 }}
        data-component="GroupColumnGrain"
      >
        {`ⓘ ${grainText}`}
      </Typography.Text>
    </>
  );
}

function AggregateBody({
  step,
  cols,
  onChange,
}: Readonly<{ step: AggregateStep; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  const { t } = useTranslation();
  const measure = step.measures[0] ?? { agg: 'count' as const };
  const numeric = cols.filter(isNumericCol);
  const orderable = cols.filter(isOrderableCol);
  // R140 — the column pool each agg draws from (mirrors the backend dtype rules).
  const poolFor = (agg: AggregateMeasure['agg']): readonly Column[] => {
    if (agg === 'sum' || agg === 'avg') return numeric;
    if (agg === 'min' || agg === 'max') return orderable;
    return cols; // count_distinct — any column
  };
  const setAgg = (agg: AggregateMeasure['agg']) => {
    if (agg === 'count') return onChange({ ...step, measures: [{ agg }] });
    const pool = poolFor(agg);
    // Keep the current col when the new agg still accepts it; else the pool's first.
    const col = pool.some((c) => c.name === measure.col) ? measure.col : pool[0]?.name;
    onChange({ ...step, measures: [{ agg, col }] });
  };
  return (
    <Space wrap size={[8, 6]}>
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
      <FieldLabel text={t('queries.builder.steps.measure')}>
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
          onChange={setAgg}
        />
        {measure.agg === 'count' ? null : (
          <Select
            size="small"
            style={{ minWidth: 120 }}
            value={measure.col}
            placeholder="—"
            options={nameOptions(poolFor(measure.agg))}
            onChange={(col: string) => onChange({ ...step, measures: [{ agg: measure.agg, col }] })}
          />
        )}
      </FieldLabel>
    </Space>
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
      <Segmented
        size="small"
        value={right.kind}
        options={[
          { label: t('queries.builder.steps.byColumn'), value: 'col' },
          { label: t('queries.builder.steps.byNumber'), value: 'const' },
        ]}
        onChange={(k) =>
          onChange({
            ...step,
            right: k === 'col' ? { kind: 'col', col: numeric[0]?.name ?? '' } : { kind: 'const', value: 0 },
          })
        }
      />
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
  const pred = step.predicates[0] ?? { col: cols[0]?.name ?? '', op: 'equals' };
  const dtype = cols.find((c) => c.name === pred.col)?.dtype ?? 'string';
  const ops = [...(OPS_BY_DTYPE[dtype] ?? [])];
  const setPred = (patch: Partial<typeof pred>) => onChange({ ...step, predicates: [{ ...pred, ...patch }] });
  return (
    <Space wrap size={[8, 6]}>
      <FieldLabel text={t('queries.builder.steps.where')}>
        <Select
          size="small"
          style={{ minWidth: 120 }}
          value={pred.col}
          options={nameOptions(cols)}
          onChange={(col: string) => setPred({ col })}
        />
      </FieldLabel>
      <Select
        size="small"
        style={{ minWidth: 110 }}
        value={pred.op}
        options={ops.map((o: Operator) => ({ label: o, value: o }))}
        onChange={(op: string) => setPred({ op })}
      />
      <Input
        size="small"
        style={{ width: 120 }}
        placeholder={t('queries.builder.steps.value')}
        value={(pred.val as string | number | undefined) ?? ''}
        onChange={(e) => setPred({ val: e.target.value })}
      />
    </Space>
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

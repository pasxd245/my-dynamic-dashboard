// R125 — the transform-steps authoring UI (the "workflow" surface). Renders the
// query's ordered `steps` as cards over the PRE-step column space, threading the
// evolving columns through each step (steps.ts) so every step offers the columns
// available AT that point. Edits call `onChange` with the next step list; the
// live preview (which sends the steps) shows the shaped result. R129 — works for
// ALL query shapes (single-source / joined / composed): the preview reports the
// PRE-step `baseColumns` the builder feeds here. One measure per aggregate / one
// predicate per filter (chain steps for more). Backend re-validates on preview/save.

import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Segmented, Select, Space, Switch, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { OPS_BY_DTYPE, type Operator } from '@/features/data-management/datasets/filters/types';
import type { Column } from '@/features/data-management/datasets/types';
import { STEP_KINDS, blankStep, isNumericCol, isOrderableCol, threadColumns } from './steps';
import type { AggregateMeasure, AggregateStep, DeriveStep, FilterStep, Step, TopNStep } from './types';

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
          <StepBody step={step} cols={entering[i] ?? columns} onChange={(next) => replace(i, next)} />
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
  onChange,
}: Readonly<{ step: Step; cols: readonly Column[]; onChange: (s: Step) => void }>) {
  switch (step.kind) {
    case 'aggregate':
      return <AggregateBody step={step} cols={cols} onChange={onChange} />;
    case 'derive':
      return <DeriveBody step={step} cols={cols} onChange={onChange} />;
    case 'filter':
      return <FilterBody step={step} cols={cols} onChange={onChange} />;
    case 'top_n':
      return <TopNBody step={step} cols={cols} onChange={onChange} />;
  }
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

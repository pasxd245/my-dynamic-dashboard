// R203 (item 5.3, pulls 4.5) — "Within N days of a start date…": a dialog that
// appends FIVE ordinary steps (steps.ts › withinDaysRecipe) so a rate by start
// period reads only the rows that have had the full window. No step kind of its
// own: the engine already says it; this is the finding-and-assembling the first
// user missed. Nothing is saved here — `[Add]` edits the draft like any card.

import { Input, InputNumber, Modal, Select, Typography } from 'antd';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Column } from '@/features/data-management/datasets/types';
import {
  WITHIN_DAYS_MAX,
  WITHIN_DAYS_MIN,
  isTemporalCol,
  withinDaysDefaults,
  withinDaysProblem,
  withinDaysRecipe,
  type WithinDaysSpec,
} from './steps';
import type { Step } from './types';

type Props = Readonly<{
  open: boolean;
  /** The column space at the END of the chain — where the five steps land. */
  cols: readonly Column[];
  onAdd: (steps: Step[]) => void;
  onCancel: () => void;
}>;

/** A label ABOVE its control (the Data-Entry convention the design names),
 *  bound by id so a screen reader reads the label with the control. */
function Field({ label, id, children }: Readonly<{ label: string; id: string; children: React.ReactNode }>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
      <label htmlFor={id}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {label}
        </Typography.Text>
      </label>
      {children}
    </div>
  );
}

export function WithinDaysDialog({ open, cols, onAdd, onCancel }: Props) {
  const { t } = useTranslation();
  const ids = { start: useId(), end: useId(), days: useId(), observed: useId(), within: useId() };
  const [spec, setSpec] = useState<WithinDaysSpec>(() => withinDaysDefaults(cols));
  // A default name follows N until the user types in that field.
  const [typed, setTyped] = useState({ observed: false, within: false });

  useEffect(() => {
    if (open) {
      setSpec(withinDaysDefaults(cols));
      setTyped({ observed: false, within: false });
    }
    // Reset on every OPEN, not on every column change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const temporal = cols.filter(isTemporalCol).map((c) => ({ label: c.name, value: c.name }));
  const problem = withinDaysProblem(spec, cols);

  const setDays = (v: number | null) => {
    const days = v ?? spec.days;
    setSpec((s) => ({
      ...s,
      days,
      observedName: typed.observed ? s.observedName : `observed_${days}d`,
      withinName: typed.within ? s.withinName : `within_${days}d`,
    }));
  };

  return (
    <Modal
      open={open}
      title={t('queries.builder.steps.withinDaysTitle')}
      okText={t('queries.builder.steps.withinDaysAdd')}
      cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
      okButtonProps={{ disabled: problem !== null, 'data-component': 'WithinDaysAdd' } as never}
      onOk={() => {
        if (problem === null) onAdd(withinDaysRecipe(spec, cols));
      }}
      onCancel={onCancel}
      destroyOnHidden
    >
      <div data-component="WithinDaysDialog" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Field label={t('queries.builder.steps.withinDaysStart')} id={ids.start}>
            <Select
              id={ids.start}
              size="small"
              value={spec.start || undefined}
              options={temporal}
              onChange={(v) => setSpec((s) => ({ ...s, start: v }))}
            />
          </Field>
          <Field label={t('queries.builder.steps.withinDaysEnd')} id={ids.end}>
            <Select
              id={ids.end}
              size="small"
              value={spec.end || undefined}
              options={temporal}
              onChange={(v) => setSpec((s) => ({ ...s, end: v }))}
            />
          </Field>
          <Field label={t('queries.builder.steps.withinDaysDays')} id={ids.days}>
            <InputNumber
              id={ids.days}
              size="small"
              min={WITHIN_DAYS_MIN}
              max={WITHIN_DAYS_MAX}
              precision={0}
              value={spec.days}
              onChange={setDays}
            />
          </Field>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Field label={t('queries.builder.steps.withinDaysObserved')} id={ids.observed}>
            <Input
              id={ids.observed}
              size="small"
              value={spec.observedName}
              onChange={(e) => {
                setTyped((x) => ({ ...x, observed: true }));
                setSpec((s) => ({ ...s, observedName: e.target.value }));
              }}
            />
          </Field>
          <Field label={t('queries.builder.steps.withinDaysWithin')} id={ids.within}>
            <Input
              id={ids.within}
              size="small"
              value={spec.withinName}
              onChange={(e) => {
                setTyped((x) => ({ ...x, within: true }));
                setSpec((s) => ({ ...s, withinName: e.target.value }));
              }}
            />
          </Field>
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('queries.builder.steps.withinDaysHelp', { n: spec.days })}
        </Typography.Text>
        {problem && (
          <Typography.Text type="warning" style={{ fontSize: 12 }} role="status">
            {t(`queries.builder.steps.withinDaysProblem_${problem}`)}
          </Typography.Text>
        )}
      </div>
    </Modal>
  );
}

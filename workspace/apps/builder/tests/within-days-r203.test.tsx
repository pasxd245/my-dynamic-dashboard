// R203 (item 5.3, pulls 4.5) — "Within N days of a start date…": a menu entry that
// opens a dialog and appends FIVE ordinary steps (no step kind of its own). Covers
// the recipe's exact bodies, fresh names, the dialog's problems and defaults, the
// menu's disabled reason, EN/VI, and the MSW preview reading only observable rows.

import { AntdConfig } from '@mdd/ui';
import { App } from 'antd';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { queriesApi } from '@/api/queriesApi';
import { i18n } from '@/i18n';
import type { Column } from '@/features/data-management/datasets/types';
import { StepsEditor } from '@/features/data-management/queries/StepsEditor';
import {
  STEP_MENU,
  isRecipeChoice,
  threadColumns,
  withinDaysAvailable,
  withinDaysDefaults,
  withinDaysProblem,
  withinDaysRecipe,
} from '@/features/data-management/queries/steps';
import type { PreviewQueryRequest, Step } from '@/features/data-management/queries/types';
import { MOCK_DATASET } from '@/mocks/fixtures';

const COLS: Column[] = [
  { name: 'created', dtype: 'datetime' },
  { name: 'closed', dtype: 'date' },
  { name: 'team', dtype: 'string' },
];

function renderEditor(steps: Step[], columns: Column[] = COLS) {
  const onChange = vi.fn();
  render(
    <AntdConfig>
      <App>
        <StepsEditor steps={steps} columns={columns} onChange={onChange} />
      </App>
    </AntdConfig>,
  );
  return onChange;
}

function openMenu() {
  // The Add-step <Select> is the editor's last combobox (cards render theirs above it).
  const boxes = screen.getAllByRole('combobox');
  fireEvent.mouseDown(boxes[boxes.length - 1]);
}

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

describe('R203 the recipe (steps.ts)', () => {
  it('appends exactly the five documented steps, observed then within', () => {
    const steps = withinDaysRecipe(
      { start: 'created', end: 'closed', days: 14, observedName: 'observed_14d', withinName: 'within_14d' },
      COLS,
    );
    expect(steps).toEqual([
      { kind: 'group_column', name: 'created_as_of', agg: 'max', col: 'created', by: [] },
      { kind: 'date_diff', start: 'created', end: 'created_as_of', unit: 'day', name: 'created_age_days' },
      { kind: 'date_diff', start: 'created', end: 'closed', unit: 'day', name: 'created_to_closed_days' },
      {
        kind: 'case',
        name: 'observed_14d',
        branches: [{ when: [{ col: 'created_age_days', op: 'gte', val: 14 }], then: { kind: 'const', value: 1 } }],
        otherwise: { kind: 'const', value: 0 },
      },
      {
        kind: 'case',
        name: 'within_14d',
        branches: [
          {
            when: [
              { col: 'observed_14d', op: 'equals', val: 1 },
              { col: 'created_to_closed_days', op: 'gte', val: 0 },
              { col: 'created_to_closed_days', op: 'lte', val: 14 },
            ],
            then: { kind: 'const', value: 1 },
          },
        ],
        otherwise: { kind: 'const', value: 0 },
      },
    ]);
    // Threaded: the five names appear for later steps; within ⊂ observed is the case body's AND.
    const { final } = threadColumns(COLS, steps);
    expect(final.map((c) => c.name).slice(3)).toEqual([
      'created_as_of',
      'created_age_days',
      'created_to_closed_days',
      'observed_14d',
      'within_14d',
    ]);
    expect(final.at(-1)?.dtype).toBe('integer');
  });

  it('never collides: a name already present gets _2, _3 …, including the typed ones', () => {
    const cols: Column[] = [
      ...COLS,
      { name: 'created_as_of', dtype: 'datetime' },
      { name: 'within_30d', dtype: 'integer' },
      { name: 'within_30d_2', dtype: 'integer' },
    ];
    const steps = withinDaysRecipe(
      { start: 'created', end: 'closed', days: 30, observedName: 'observed_30d', withinName: 'within_30d' },
      cols,
    );
    const names = steps.map((s) => (s as { name: string }).name);
    expect(names).toEqual([
      'created_as_of_2',
      'created_age_days',
      'created_to_closed_days',
      'observed_30d',
      'within_30d_3',
    ]);
    // the step that reads the as-of reads the RENAMED one
    expect(steps[1]).toMatchObject({ end: 'created_as_of_2' });
  });

  it('defaults to the first two date columns, 30 days and names that say what they hold', () => {
    expect(withinDaysDefaults(COLS)).toEqual({
      start: 'created',
      end: 'closed',
      days: 30,
      observedName: 'observed_30d',
      withinName: 'within_30d',
    });
  });

  it('says why it cannot be added', () => {
    const ok = withinDaysDefaults(COLS);
    expect(withinDaysProblem(ok, COLS)).toBeNull();
    expect(withinDaysProblem({ ...ok, start: 'team' }, COLS)).toBe('pickColumns');
    expect(withinDaysProblem({ ...ok, end: 'created' }, COLS)).toBe('sameColumn');
    expect(withinDaysProblem({ ...ok, days: 0 }, COLS)).toBe('days');
    expect(withinDaysProblem({ ...ok, days: 3661 }, COLS)).toBe('days');
    expect(withinDaysProblem({ ...ok, days: 2.5 }, COLS)).toBe('days');
    expect(withinDaysProblem({ ...ok, withinName: '  ' }, COLS)).toBe('names');
    expect(withinDaysProblem({ ...ok, withinName: 'observed_30d' }, COLS)).toBe('names');
  });

  it('is a recipe entry at the end of the add-column group, and needs two date columns', () => {
    const items = STEP_MENU.find((g) => g.group === 'addColumn')?.items ?? [];
    const last = items.at(-1);
    expect(last && isRecipeChoice(last)).toBe(true);
    expect(withinDaysAvailable(COLS)).toBe(true);
    expect(withinDaysAvailable(COLS.filter((c) => c.name !== 'closed'))).toBe(false);
  });
});

describe('R203 the dialog (StepsEditor)', () => {
  it('the menu entry is disabled with a reason when fewer than two date columns exist', async () => {
    renderEditor(
      [],
      COLS.filter((c) => c.name !== 'closed'),
    );
    openMenu();
    const option = await screen.findByTitle('Needs two date columns at this point');
    expect(option.closest('.ant-select-item-option')).toHaveClass('ant-select-item-option-disabled');
    // QA-1 — the reason is visible text in the option, not only a hover title
    expect(within(option).getByText('Needs two date columns at this point')).toBeInTheDocument();
  });

  it('opens from the menu, names follow N until typed, and Add appends the five steps', async () => {
    const onChange = renderEditor([{ kind: 'sort', keys: [{ col: 'created' }] }]);
    openMenu();
    fireEvent.click(await screen.findByText('Within N days of a start date…'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue('observed_30d')).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('within_30d')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Within (days)'), { target: { value: '14' } });
    await waitFor(() => expect(within(dialog).getByDisplayValue('observed_14d')).toBeInTheDocument());
    fireEvent.change(within(dialog).getByLabelText('Within column'), { target: { value: 'won_14d' } });
    fireEvent.change(within(dialog).getByLabelText('Within (days)'), { target: { value: '7' } });
    await waitFor(() => expect(within(dialog).getByDisplayValue('observed_7d')).toBeInTheDocument());
    expect(within(dialog).getByDisplayValue('won_14d')).toBeInTheDocument(); // typed → stays

    // CR-2 / BA-F4 — the final names are shown before [Add]
    expect(
      within(dialog).getByText(
        /Will add: created_as_of, created_age_days, created_to_closed_days, observed_7d, won_14d/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const next = onChange.mock.calls.at(-1)?.[0] as Step[];
    expect(next).toHaveLength(6); // the sort kept, five appended after it
    expect(next[0]).toEqual({ kind: 'sort', keys: [{ col: 'created' }] });
    expect(next.slice(1).map((s) => s.kind)).toEqual(['group_column', 'date_diff', 'date_diff', 'case', 'case']);
    expect(
      next
        .slice(1)
        .map((s) => (s as { name: string }).name)
        .slice(3),
    ).toEqual(['observed_7d', 'won_14d']);
  });

  it('Add is disabled, with the reason, while the two names are equal', async () => {
    renderEditor([]);
    openMenu();
    fireEvent.click(await screen.findByText('Within N days of a start date…'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Within column'), { target: { value: 'observed_30d' } });
    expect(await within(dialog).findByText('Give the two new columns different, non-empty names.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('a cleared Days field is a problem, not the previous N kept quietly (CR-3); one day reads singular (QA-2)', async () => {
    renderEditor([]);
    openMenu();
    fireEvent.click(await screen.findByText('Within N days of a start date…'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Within (days)'), { target: { value: '1' } });
    expect(await within(dialog).findByText(/once 1 day has passed/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Within (days)'), { target: { value: '' } });
    expect(await within(dialog).findByText('Days must be a whole number from 1 to 3660.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('reads in Vietnamese', async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
    renderEditor([]);
    openMenu();
    fireEvent.click(await screen.findByText('Trong N ngày kể từ ngày bắt đầu…'));
    const dialog = await screen.findByRole('dialog');
    for (const label of ['Ngày bắt đầu', 'Ngày sự kiện', 'Trong (ngày)', 'Cột đủ thời gian', 'Cột trong hạn']) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }
    expect(within(dialog).getByText(/kỳ chưa đủ tuổi/)).toBeInTheDocument();
  });
});

describe('R203 the MSW preview', () => {
  it('reads within only on observable rows, and within never exceeds observed', async () => {
    const steps = withinDaysRecipe(
      { start: 'created_at', end: 'won_at', days: 14, observedName: 'observed_14d', withinName: 'within_14d' },
      MOCK_DATASET.columns as Column[],
    );
    const req: PreviewQueryRequest = {
      sourceId: MOCK_DATASET.id,
      definition: { q: null, filters: [], advanced: [], steps },
    };
    const res = await queriesApi.preview(MOCK_DATASET.workspaceId, req, 1, 100);
    const names = res.resolvedColumns?.map((c) => c.name) ?? [];
    const oi = names.indexOf('observed_14d');
    const wi = names.indexOf('within_14d');
    expect(oi).toBeGreaterThan(-1);
    expect(wi).toBeGreaterThan(-1);
    expect(res.rows.length).toBeGreaterThan(0);
    for (const row of res.rows) {
      expect(['0', '1']).toContain(row[oi]);
      expect(['0', '1']).toContain(row[wi]);
      if (row[wi] === '1') expect(row[oi]).toBe('1');
    }
    // CR-1 — the mock's as-of is a real date (max over a date column), so BOTH outcomes appear:
    // older rows observed, the newest (fewer than 14 days before the latest start) not
    const ai = names.indexOf('created_at_as_of');
    expect(res.rows.every((r) => r[ai] !== null)).toBe(true);
    expect(res.rows.some((r) => r[oi] === '1')).toBe(true);
    expect(res.rows.some((r) => r[oi] === '0')).toBe(true);
  });
});

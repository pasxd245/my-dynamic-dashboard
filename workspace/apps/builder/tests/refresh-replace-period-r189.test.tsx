// R189 — the replace_period refresh mode. The Confirm step offers "Replace a
// period" with a date-column picker (a date on both the file and the dataset);
// the commit sends `refresh_mode: 'replace_period'` + `period_column` and the
// 201 carries the period report. An append that overlaps offers the switch.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { datasetsApi } from '@/api/datasetsApi';
import type { Dataset, RefreshSettings } from '@/features/data-management/datasets/types';
import { UploadConfirmStep } from '@/features/data-management/datasets/upload/UploadConfirmStep';
import {
  CSV_SHEET_KEY,
  INITIAL_WIZARD_STATE,
  periodBlocked,
  periodColumnOptions,
  refreshCommitItem,
  wizardReducer,
  type SheetState,
  type WizardState,
} from '@/features/data-management/datasets/upload/state';

const target: Dataset = {
  id: 'ds_12345678',
  workspaceId: 'ws_abcdef01',
  name: 'daily_calls',
  sizeBytes: 10,
  rowCount: 5,
  columnCount: 3,
  columns: [
    { name: 'id', dtype: 'integer' },
    { name: 'day', dtype: 'date' },
    { name: 'logged', dtype: 'string' },
  ],
  sourceFormat: 'csv',
  createdAt: '2026-09-01T00:00:00Z',
  refreshedAt: '2026-09-01T00:00:00Z',
  dataVersion: 1,
};

// The incoming file: `day` is a date on both sides; `logged` parses as a
// datetime here but is a string on the dataset (so it is not offered).
const incoming: SheetState = {
  status: 'ok',
  columns: [
    { name: 'id', dtype: 'integer' },
    { name: 'day', dtype: 'date' },
    { name: 'logged', dtype: 'datetime' },
  ],
  rowCount: 3,
  sampleRows: [],
  columnOverrides: {},
  excludedColumns: [],
  parseOptions: {},
  name: 'daily_calls',
  sheetName: '',
};

const seeded = (settings?: RefreshSettings): WizardState => ({
  ...wizardReducer(INITIAL_WIZARD_STATE, { type: 'SEED_REFRESH', target, settings }),
  tempId: 'tmp_1111111111111111',
  sheets: { [CSV_SHEET_KEY]: incoming },
});

function renderConfirm(state: WizardState) {
  const dispatch = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <UploadConfirmStep state={state} dispatch={dispatch} commitError={null} />
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
  return dispatch;
}

describe('R189 replace_period — state', () => {
  it('a remembered replace_period carries forward with its column', () => {
    const s = seeded({ available: true, refresh_mode: 'replace_period', period_column: 'day' });
    expect(s.refreshMode).toBe('replace_period');
    expect(s.periodColumn).toBe('day');
  });

  it('falls back to replace when the remembered column is gone or no longer a date', () => {
    const gone = seeded({ available: true, refresh_mode: 'replace_period', period_column: 'when' });
    const notDate = seeded({ available: true, refresh_mode: 'replace_period', period_column: 'logged' });
    expect([gone.refreshMode, gone.periodColumn]).toEqual(['replace', null]);
    expect([notDate.refreshMode, notDate.periodColumn]).toEqual(['replace', null]);
  });

  it('offers only columns that are a date on both sides, and blocks until one is picked', () => {
    let s = wizardReducer(seeded(), { type: 'SET_REFRESH_MODE', mode: 'replace_period' });
    expect(periodColumnOptions(s).map((c) => c.name)).toEqual(['day']);
    expect(periodBlocked(s)).toBe(true);
    s = wizardReducer(s, { type: 'SET_PERIOD_COLUMN', column: 'day' });
    expect(periodBlocked(s)).toBe(false);
    // Excluding the picked column re-blocks (the backend would refuse it).
    s = { ...s, sheets: { [CSV_SHEET_KEY]: { ...incoming, excludedColumns: ['day'] } } };
    expect(periodBlocked(s)).toBe(true);
    // Other modes never block on the period.
    expect(periodBlocked(wizardReducer(s, { type: 'SET_REFRESH_MODE', mode: 'replace' }))).toBe(false);
  });

  it('the commit item carries the mode and the column — and nothing period-ish otherwise', () => {
    const s = wizardReducer(wizardReducer(seeded(), { type: 'SET_REFRESH_MODE', mode: 'replace_period' }), {
      type: 'SET_PERIOD_COLUMN',
      column: 'day',
    });
    expect(refreshCommitItem(s)).toEqual({
      name: 'daily_calls',
      target_dataset_id: 'ds_12345678',
      refresh_mode: 'replace_period',
      period_column: 'day',
    });
    const replace = wizardReducer(s, { type: 'SET_REFRESH_MODE', mode: 'replace' });
    expect(refreshCommitItem(replace)).toEqual({ name: 'daily_calls', target_dataset_id: 'ds_12345678' });
  });

  it('the 201 wrapper carries the period report (contract-checked mock)', async () => {
    const result = await datasetsApi.commitBatch('ws_abcdef01', {
      temp_id: 'tmp_1111111111111111',
      items: [{ name: 'x', target_dataset_id: 'ds_12345678', refresh_mode: 'replace_period', period_column: 'day' }],
    });
    expect(!Array.isArray(result) && 'period' in result && result.period).toMatchObject({
      column: 'day',
      removed: 90,
      inserted: 100,
      kept: 5047,
    });
  });
});

describe('R189 replace_period — Confirm step', () => {
  it('offers the mode as a fourth choice', () => {
    const dispatch = renderConfirm(seeded());
    fireEvent.click(screen.getByText('Replace a period'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_REFRESH_MODE', mode: 'replace_period' });
  });

  it('without a column: the picker and the blocked alert', () => {
    renderConfirm(wizardReducer(seeded(), { type: 'SET_REFRESH_MODE', mode: 'replace_period' }));
    expect(document.querySelector('[data-component="PeriodColumnPicker"]')).not.toBeNull();
    expect(screen.getByText('Pick a date column to replace a period')).toBeInTheDocument();
  });

  it('with a column the confirm note explains the period', () => {
    renderConfirm(seeded({ available: true, refresh_mode: 'replace_period', period_column: 'day' }));
    expect(screen.getByText('This replaces a period of “daily_calls”')).toBeInTheDocument();
    expect(screen.getByText(/earliest to the latest “day”/)).toBeInTheDocument();
    expect(document.querySelector('[data-component="PeriodBlocked"]')).toBeNull();
  });

  it('an overlapping append offers to replace that period instead', async () => {
    // The MSW overlap mock reports an overlap for a field whose name contains
    // "overlap" — make that the date column on both sides.
    const t2: Dataset = { ...target, columns: [...target.columns, { name: 'overlap_day', dtype: 'date' }] };
    const sheet: SheetState = { ...incoming, columns: [...incoming.columns, { name: 'overlap_day', dtype: 'date' }] };
    const s: WizardState = {
      ...wizardReducer(INITIAL_WIZARD_STATE, { type: 'SEED_REFRESH', target: t2 }),
      tempId: 'tmp_1111111111111111',
      sheets: { [CSV_SHEET_KEY]: sheet },
      refreshMode: 'append',
      overlapCheckField: 'overlap_day',
    };
    const dispatch = renderConfirm(s);
    const btn = await waitFor(() => screen.getByText('Replace this period instead'));
    fireEvent.click(btn);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_REFRESH_MODE', mode: 'replace_period' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_PERIOD_COLUMN', column: 'overlap_day' });
  });
});

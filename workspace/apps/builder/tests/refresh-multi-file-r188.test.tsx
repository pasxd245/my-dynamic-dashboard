// R188 — a refresh may stack several files. The wizard's Confirm step (refresh
// mode) lists the files after the first and adds more; each is uploaded when
// added and the commit sends their ids as `extra_temp_ids`. A value that does not
// fit names its file in the error.

import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Dataset } from '@/features/data-management/datasets/types';
import { BatchApiErrorThrown } from '@/features/data-management/_shared/types';
import { UploadConfirmStep } from '@/features/data-management/datasets/upload/UploadConfirmStep';
import {
  INITIAL_WIZARD_STATE,
  wizardReducer,
  type WizardState,
} from '@/features/data-management/datasets/upload/state';

const target: Dataset = {
  id: 'ds_12345678',
  workspaceId: 'ws_abcdef01',
  name: 'monthly_calls',
  sizeBytes: 10,
  rowCount: 2,
  columnCount: 2,
  columns: [
    { name: 'key', dtype: 'integer' },
    { name: 'calls', dtype: 'integer' },
  ],
  sourceFormat: 'csv',
  createdAt: '2026-07-01T00:00:00Z',
  refreshedAt: '2026-07-01T00:00:00Z',
  dataVersion: 1,
};

const seeded = (): WizardState => ({
  ...wizardReducer(INITIAL_WIZARD_STATE, { type: 'SEED_REFRESH', target }),
  file: new File(['key,calls\n1,2\n'], 'july.csv', { type: 'text/csv' }),
  tempId: 'tmp_1111111111111111',
});

function renderConfirm(state: WizardState, commitError: Error | null = null) {
  const dispatch = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AntdConfig>
        <App>
          <UploadConfirmStep state={state} dispatch={dispatch} commitError={commitError} />
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
  return dispatch;
}

describe('R188 extra files — reducer', () => {
  it('adds files in order, ignores the same upload twice, removes by id', () => {
    let s = seeded();
    s = wizardReducer(s, { type: 'ADD_EXTRA_FILE', file: { tempId: 'tmp_a', name: 'aug.csv', size: 10 } });
    s = wizardReducer(s, { type: 'ADD_EXTRA_FILE', file: { tempId: 'tmp_b', name: 'sep.csv', size: 12 } });
    s = wizardReducer(s, { type: 'ADD_EXTRA_FILE', file: { tempId: 'tmp_a', name: 'aug.csv', size: 10 } });
    expect(s.extraFiles.map((f) => f.name)).toEqual(['aug.csv', 'sep.csv']);
    s = wizardReducer(s, { type: 'REMOVE_EXTRA_FILE', tempId: 'tmp_a' });
    expect(s.extraFiles.map((f) => f.name)).toEqual(['sep.csv']);
  });

  it('starts empty and a reset clears it', () => {
    expect(INITIAL_WIZARD_STATE.extraFiles).toEqual([]);
    const s = wizardReducer(
      { ...seeded(), extraFiles: [{ tempId: 'tmp_a', name: 'a.csv', size: 1 }] },
      { type: 'RESET' },
    );
    expect(s.extraFiles).toEqual([]);
  });
});

describe('R188 extra files — Confirm step', () => {
  it('lists the first file then the added ones, each removable', () => {
    const dispatch = renderConfirm({ ...seeded(), extraFiles: [{ tempId: 'tmp_b', name: 'sep.csv', size: 12 }] });
    expect(screen.getByText('More files in this refresh')).toBeInTheDocument();
    expect(screen.getByText(/same columns as july\.csv/)).toBeInTheDocument();
    const list = document.querySelector('[data-component="RefreshExtraFileList"]') as HTMLElement;
    expect(list.textContent).toMatch(/july\.csv.*first file.*sep\.csv/s);
    fireEvent.click(screen.getByLabelText('Remove sep.csv'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_EXTRA_FILE', tempId: 'tmp_b' });
  });

  it('adding a file uploads it and records its temp id', async () => {
    const dispatch = renderConfirm(seeded());
    const input = document.querySelector('[data-component="RefreshExtraFiles"] input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['key,calls\n3,4\n'], 'aug.csv', { type: 'text/csv' })] } });
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith({
        type: 'ADD_EXTRA_FILE',
        file: expect.objectContaining({ name: 'aug.csv', tempId: expect.stringMatching(/^tmp_/) }),
      }),
    );
  });

  it('a coercion failure on a stacked file names the file first', () => {
    const err = new BatchApiErrorThrown(422, {
      code: 'coercion_failed',
      file: 'sep.csv',
      column: 'calls',
      dtype: 'integer',
      cells: [{ row: 2, value: 'lots' }],
      totalFailed: 1,
    });
    renderConfirm({ ...seeded(), extraFiles: [{ tempId: 'tmp_b', name: 'sep.csv', size: 12 }] }, err);
    expect(screen.getByText(/sep\.csv › calls can't convert to integer/)).toBeInTheDocument();
  });

  it('is not shown when creating a dataset', () => {
    renderConfirm({ ...INITIAL_WIZARD_STATE, workspaceId: 'ws_abcdef01' });
    expect(document.querySelector('[data-component="RefreshExtraFiles"]')).toBeNull();
  });
});

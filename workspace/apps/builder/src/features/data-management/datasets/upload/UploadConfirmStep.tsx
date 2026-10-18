import { Alert, Button, Input, Radio, Select, Space, Table, Tag, Typography, Upload } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { uploadsApi } from '@/api/uploadsApi';
import type { TFunction } from 'i18next';
import type { Dispatch } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ERROR_CODES, NAME_LENGTHS } from '@/_generated/constants';
import { VALIDATION_ERROR } from '@/api/datasetsApi';
import { formatBytes } from '@/lib/formatBytes';
import { BatchApiErrorThrown } from '@/features/data-management/_shared/types';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import { useAppendOverlapQuery } from '../hooks';
import {
  dateFieldOptions,
  mergeKeyIssues,
  periodBlocked,
  periodColumnOptions,
  refreshSheetKey,
  units,
  type WizardAction,
  type WizardState,
} from './state';

const SAMPLE_SEP = ' · ';

/** R147 D2 — the loud stop teaches the fix: the declared key is not the
 *  row's identity (pick a fuller key or clean the export). */
function mergeDuplicateKeysDescription(
  body: Extract<BatchApiErrorThrown['body'], { code: 'merge_duplicate_keys' }>,
  t: TFunction,
): string {
  return t('upload.confirm.errorMergeDuplicateKeysDescription', {
    key: body.key.join(' + '),
    count: body.duplicateKeyCount,
    samples: body.sampleKeys.join(SAMPLE_SEP),
  });
}

function commitErrorTitle(err: Error, t: TFunction): string {
  if (err instanceof BatchApiErrorThrown && 'code' in err.body) {
    if (err.body.code === ERROR_CODES.NAME_TAKEN) {
      return t('upload.confirm.errorNameTakenTitle');
    }
    if (err.body.code === ERROR_CODES.COERCION_FAILED) {
      return t('upload.confirm.errorCoercionFailedTitle');
    }
    if (err.body.code === ERROR_CODES.MERGE_DUPLICATE_KEYS) {
      return t('upload.confirm.errorMergeDuplicateKeysTitle');
    }
  }
  return t('upload.confirm.errorGenericTitle');
}

function commitErrorDescription(err: Error, t: TFunction): string {
  if (err instanceof BatchApiErrorThrown) {
    if ('code' in err.body) {
      if (err.body.code === ERROR_CODES.NAME_TAKEN) {
        return t('upload.confirm.errorNameTakenDescription');
      }
      if (err.body.code === ERROR_CODES.COERCION_FAILED) {
        // R143 — name the column, target dtype, sample cells, total count.
        const { sheet, file, column, dtype, cells, totalFailed } = err.body;
        const samples = cells
          .map((c) => t('upload.confirm.errorCoercionFailedCell', { row: c.row, value: c.value }))
          .join(SAMPLE_SEP);
        // R188 — on a multi-file refresh the file comes first: "march.csv › calls".
        const where = [file, sheet, column].filter(Boolean).join(' \u203a ');
        const base = t('upload.confirm.errorCoercionFailedDescription', {
          column: where,
          dtype,
          count: totalFailed,
          samples,
        });
        // R144 (Review findings #3/#6) \u2014 help the user tell WRONG DATA from
        // WRONG TYPE/FORMAT. A failing cell equal to the column name is a
        // repeated header row in the source file (a data fix, not an override
        // fix). A `date` target whose failing values carry a time part means
        // the TYPE is wrong \u2014 choose datetime (day-level grouping is the Date
        // bucket step's job, never silent truncation at ingest). Otherwise
        // offer both readings.
        const headerRow = cells.some((c) => c.value.trim() === column);
        const timeInDate = dtype === 'date' && cells.some((c) => /\d{1,2}:\d{2}/.test(c.value));
        let hintKey = 'upload.confirm.errorCoercionFailedHint';
        if (headerRow) hintKey = 'upload.confirm.errorCoercionFailedHeaderRowHint';
        else if (timeInDate) hintKey = 'upload.confirm.errorCoercionFailedTimeInDateHint';
        return `${base} ${t(hintKey)}`;
      }
      if (err.body.code === ERROR_CODES.MERGE_DUPLICATE_KEYS) {
        return mergeDuplicateKeysDescription(err.body, t);
      }
      return t('upload.confirm.errorServerCode', { code: err.body.code });
    }
    // R171 item 1 — the uncoded fallback, split in two. A pydantic body
    // rejection ("Extra inputs are not permitted") used to render raw, naming
    // no field and posing as advice; it is an app bug, and now says so —
    // `datasetsApi` keeps each entry's `loc` path, so it also names the field.
    // The router's OWN string messages are untouched: R144 wrote those to be
    // read as guidance, and they are.
    if (err.body.error === VALIDATION_ERROR) {
      return t('upload.confirm.errorUnexpectedDescription', { detail: err.body.detail ?? err.body.error });
    }
    return err.body.detail ?? err.body.error;
  }
  return err.message;
}

type Props = Readonly<{
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  commitError?: Error | null;
}>;

/** R147 — the refresh-semantics block (upload.md § Refresh merge mode): the
 *  replace|merge choice + key picker live HERE on Confirm (no new wizard
 *  step). Key guards mirror the backend (F5×F2): a missing / dtype-drifted
 *  key column blocks MERGE — never the refresh (switch to replace, fix the
 *  override, or re-pick). The page-level commit button reads the same
 *  `mergeKeyIssues` helper. */
function RefreshSemantics({ state, dispatch }: Readonly<Pick<Props, 'state' | 'dispatch'>>) {
  const { t } = useTranslation();
  const keyIssues = mergeKeyIssues(state.refreshBaseline ?? [], state.sheets[refreshSheetKey(state)], state.mergeKey);
  const mergeBlocked = state.refreshMode === 'merge' && (state.mergeKey.length === 0 || keyIssues.length > 0);
  const dateOptions = dateFieldOptions(state.sheets[refreshSheetKey(state)]);
  // R189 — replace_period needs a date column on both the file and the dataset.
  const periodOptions = periodColumnOptions(state);
  const periodIsBlocked = periodBlocked(state);
  // R155 — the live overlap advisory (append + a date field picked). Advisory:
  // a failed check falls back to a soft note; the append is never blocked.
  const overlapField = state.overlapCheckField;
  const overlap = useAppendOverlapQuery(
    state.targetDatasetId ?? undefined,
    state.tempId,
    state.sourceFormat === 'csv' ? undefined : refreshSheetKey(state),
    overlapField,
    state.refreshMode === 'append' && overlapField !== null,
  );
  const issueText =
    state.mergeKey.length === 0
      ? t('upload.refresh.mergeKeyRequired')
      : `${keyIssues
          .map((i) =>
            i.kind === 'missing'
              ? t('upload.refresh.mergeKeyIssueMissing', { name: i.name })
              : t('upload.refresh.mergeKeyIssueDtype', { name: i.name, from: i.from, to: i.to }),
          )
          .join(SAMPLE_SEP)} ${t('upload.refresh.mergeKeyBlockedHint')}`;

  return (
    <div data-component="RefreshSemantics" style={{ marginBottom: 12 }}>
      <Typography.Text strong>{t('upload.refresh.modeLabel')}</Typography.Text>
      <Radio.Group
        value={state.refreshMode}
        onChange={(e) => dispatch({ type: 'SET_REFRESH_MODE', mode: e.target.value })}
        style={{ display: 'block', margin: '8px 0' }}
        data-component="RefreshModeChoice"
      >
        <Space orientation="vertical" size={4}>
          <Radio value="replace" data-component="RefreshModeReplace">
            {t('upload.refresh.modeReplace')}{' '}
            <Typography.Text type="secondary">{t('upload.refresh.modeReplaceHint')}</Typography.Text>
          </Radio>
          <Radio value="merge" data-component="RefreshModeMerge">
            {t('upload.refresh.modeMerge')}{' '}
            <Typography.Text type="secondary">{t('upload.refresh.modeMergeHint')}</Typography.Text>
          </Radio>
          <Radio value="append" data-component="RefreshModeAppend">
            {t('upload.refresh.modeAppend')}{' '}
            <Typography.Text type="secondary">{t('upload.refresh.modeAppendHint')}</Typography.Text>
          </Radio>
          <Radio value="replace_period" data-component="RefreshModePeriod">
            {t('upload.refresh.modePeriod')}{' '}
            <Typography.Text type="secondary">{t('upload.refresh.modePeriodHint')}</Typography.Text>
          </Radio>
        </Space>
      </Radio.Group>
      {state.refreshMode === 'merge' ? (
        <div style={{ marginBottom: 8, maxWidth: 520 }} data-component="MergeKeyPicker">
          <Typography.Text>{t('upload.refresh.mergeKeyLabel')}</Typography.Text>
          <Select
            mode="multiple"
            style={{ width: '100%', marginTop: 4 }}
            placeholder={t('upload.refresh.mergeKeyPlaceholder')}
            value={state.mergeKey}
            onChange={(key: string[]) => dispatch({ type: 'SET_MERGE_KEY', key })}
            options={(state.refreshBaseline ?? []).map((c) => ({
              value: c.name,
              label: `${c.name} (${c.dtype})`,
            }))}
            status={mergeBlocked ? 'error' : undefined}
            data-component="MergeKeySelect"
          />
        </div>
      ) : null}
      {state.refreshMode === 'merge' && mergeBlocked ? (
        <Alert
          type="error"
          showIcon
          title={t('upload.refresh.mergeKeyBlockedTitle')}
          description={issueText}
          data-component="MergeKeyBlocked"
        />
      ) : null}
      {state.refreshMode === 'merge' && !mergeBlocked ? (
        <Alert
          type="info"
          showIcon
          title={t('upload.refresh.confirmMergeTitle', { name: state.refreshTargetName ?? '' })}
          description={t('upload.refresh.confirmMergeBody', { key: state.mergeKey.join(' + ') })}
          data-component="RefreshConfirmNote"
        />
      ) : null}
      {state.refreshMode === 'replace' ? (
        <Alert
          type="warning"
          showIcon
          title={t('upload.refresh.confirmReplaceTitle', { name: state.refreshTargetName ?? '' })}
          description={t('upload.refresh.confirmReplaceBody')}
          data-component="RefreshConfirmNote"
        />
      ) : null}
      {state.refreshMode === 'append' ? (
        <div style={{ marginBottom: 8, maxWidth: 520 }} data-component="AppendOverlapPicker">
          <Typography.Text>{t('upload.refresh.overlapFieldLabel')}</Typography.Text>
          <Select
            allowClear
            style={{ width: '100%', marginTop: 4 }}
            placeholder={t('upload.refresh.overlapFieldPlaceholder')}
            value={state.overlapCheckField ?? undefined}
            onChange={(field?: string) => dispatch({ type: 'SET_OVERLAP_FIELD', field: field ?? null })}
            options={dateOptions.map((c) => ({ value: c.name, label: `${c.name} (${c.dtype})` }))}
            notFoundContent={t('upload.refresh.overlapFieldNone')}
            data-component="AppendOverlapSelect"
          />
        </div>
      ) : null}
      {state.refreshMode === 'append' && !overlapField ? (
        <Alert
          type="warning"
          showIcon
          title={t('upload.refresh.confirmAppendTitle', { name: state.refreshTargetName ?? '' })}
          description={t('upload.refresh.confirmAppendUncheckedBody')}
          data-component="AppendConfirmNote"
        />
      ) : null}
      {state.refreshMode === 'append' && overlapField && overlap.isLoading ? (
        <Alert
          type="info"
          showIcon
          title={t('upload.refresh.overlapChecking', { field: overlapField })}
          data-component="AppendOverlapChecking"
        />
      ) : null}
      {state.refreshMode === 'append' && overlapField && overlap.isError ? (
        <Alert
          type="info"
          showIcon
          title={t('upload.refresh.confirmAppendTitle', { name: state.refreshTargetName ?? '' })}
          description={t('upload.refresh.overlapCheckFailed', { field: overlapField })}
          data-component="AppendOverlapNote"
        />
      ) : null}
      {state.refreshMode === 'append' && overlapField && overlap.data && !overlap.data.overlaps ? (
        <Alert
          type="info"
          showIcon
          title={t('upload.refresh.confirmAppendTitle', { name: state.refreshTargetName ?? '' })}
          description={t('upload.refresh.overlapClean', { field: overlapField })}
          data-component="AppendOverlapNote"
        />
      ) : null}
      {state.refreshMode === 'append' && overlapField && overlap.data?.overlaps ? (
        <Alert
          type="warning"
          showIcon
          title={t('upload.refresh.overlapWarnTitle')}
          description={t('upload.refresh.overlapWarnBody', {
            field: overlapField,
            name: state.refreshTargetName ?? '',
            min: overlap.data.overlappingRange?.min ?? overlap.data.incomingRange?.min ?? '',
            max: overlap.data.overlappingRange?.max ?? overlap.data.incomingRange?.max ?? '',
          })}
          action={
            periodOptions.some((c) => c.name === overlapField) ? (
              <Button
                size="small"
                onClick={() => {
                  dispatch({ type: 'SET_REFRESH_MODE', mode: 'replace_period' });
                  dispatch({ type: 'SET_PERIOD_COLUMN', column: overlapField });
                }}
                data-component="AppendOverlapSwitchToPeriod"
              >
                {t('upload.refresh.overlapSwitchToPeriod')}
              </Button>
            ) : undefined
          }
          data-component="AppendOverlapWarn"
        />
      ) : null}
      {state.refreshMode === 'replace_period' ? (
        <div style={{ marginBottom: 8, maxWidth: 520 }} data-component="PeriodColumnPicker">
          <Typography.Text>{t('upload.refresh.periodColumnLabel')}</Typography.Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            placeholder={t('upload.refresh.periodColumnPlaceholder')}
            value={state.periodColumn ?? undefined}
            onChange={(column: string) => dispatch({ type: 'SET_PERIOD_COLUMN', column })}
            options={periodOptions.map((c) => ({ value: c.name, label: `${c.name} (${c.dtype})` }))}
            notFoundContent={t('upload.refresh.periodColumnNone')}
            status={periodIsBlocked ? 'error' : undefined}
            data-component="PeriodColumnSelect"
          />
        </div>
      ) : null}
      {state.refreshMode === 'replace_period' && periodIsBlocked ? (
        <Alert
          type="error"
          showIcon
          title={t('upload.refresh.periodBlockedTitle')}
          description={
            periodOptions.length === 0 ? t('upload.refresh.periodColumnNone') : t('upload.refresh.periodColumnRequired')
          }
          data-component="PeriodBlocked"
        />
      ) : null}
      {state.refreshMode === 'replace_period' && !periodIsBlocked ? (
        <Alert
          type="warning"
          showIcon
          title={t('upload.refresh.confirmPeriodTitle', { name: state.refreshTargetName ?? '' })}
          description={t('upload.refresh.confirmPeriodBody', { field: state.periodColumn ?? '' })}
          data-component="RefreshConfirmNote"
        />
      ) : null}
    </div>
  );
}

type RowData = {
  key: string;
  unitKey: string;
  sheetLabel: string;
  range: string;
  name: string;
  rowCount: number;
  kept: number;
  total: number;
  overrideCount: number;
};

/** R188 — more files in the same refresh. Each is uploaded when added (so the
 *  commit only sends ids); the server checks columns and values at commit and
 *  names the file that does not fit. Order = the order added. */
function RefreshExtraFiles({ state, dispatch }: Readonly<Pick<Props, 'state' | 'dispatch'>>) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const first = state.file?.name ?? '—';
  const full = 1 + state.extraFiles.length >= 20;
  const add = async (file: File) => {
    setBusy((n) => n + 1);
    setFailed(null);
    try {
      const res = await uploadsApi.createTemp(file, state.sourceFormat);
      dispatch({ type: 'ADD_EXTRA_FILE', file: { tempId: res.temp_id, name: file.name, size: file.size } });
    } catch {
      setFailed(file.name);
    } finally {
      setBusy((n) => n - 1);
    }
  };
  return (
    <div data-component="RefreshExtraFiles" style={{ marginBottom: 16 }}>
      <Typography.Text strong>{t('upload.refresh.extraFilesTitle')}</Typography.Text>
      <Typography.Paragraph type="secondary" style={{ margin: '4px 0 8px' }}>
        {t('upload.refresh.extraFilesHint', { first })}
      </Typography.Paragraph>
      {state.extraFiles.length > 0 ? (
        <ol style={{ margin: '0 0 8px', paddingInlineStart: 20 }} data-component="RefreshExtraFileList">
          <li>
            {first} <Typography.Text type="secondary">({t('upload.refresh.extraFilesFirst')})</Typography.Text>
          </li>
          {state.extraFiles.map((f) => (
            <li key={f.tempId}>
              {f.name} <Typography.Text type="secondary">({formatBytes(f.size)})</Typography.Text>{' '}
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                aria-label={t('upload.refresh.extraFilesRemove', { name: f.name })}
                onClick={() => dispatch({ type: 'REMOVE_EXTRA_FILE', tempId: f.tempId })}
              />
            </li>
          ))}
        </ol>
      ) : null}
      {state.extraFiles.length > 0 ? (
        <Typography.Paragraph type="secondary" style={{ margin: '0 0 8px' }}>
          {t('upload.refresh.extraFilesRowsNote', { count: state.extraFiles.length })}
        </Typography.Paragraph>
      ) : null}
      <Upload
        multiple
        accept={state.sourceFormat === 'csv' ? '.csv,text/csv' : '.xlsx,.xls'}
        showUploadList={false}
        disabled={full}
        beforeUpload={(file) => {
          void add(file as File);
          return false;
        }}
      >
        <Button icon={<PlusOutlined />} loading={busy > 0} disabled={full} data-component="RefreshAddFiles">
          {t('upload.refresh.extraFilesAdd')}
        </Button>
      </Upload>
      {failed ? (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 8 }}
          title={t('upload.refresh.extraFilesUploadFailed', { name: failed })}
        />
      ) : null}
    </div>
  );
}

export function UploadConfirmStep({ state, dispatch, commitError }: Props) {
  const { t } = useTranslation();
  const isCsv = state.sourceFormat === 'csv';
  const isRefresh = state.mode === 'refresh';
  const workspaces = useWorkspacesQuery();
  const workspaceName = workspaces.data?.find((w) => w.id === state.workspaceId)?.name ?? state.workspaceId ?? '—';

  const fileName = state.file?.name ?? (isCsv ? 'file.csv' : 'workbook');
  const fileSize = state.file ? formatBytes(state.file.size) : null;
  const sourceLabel = isCsv ? 'CSV' : 'Excel';

  // F8 — one row per UNIT. Sheet + Range distinguish two units of one sheet.
  const rows: RowData[] = units(state).map((unit) => {
    const sheet = unit.state;
    const total = sheet.columns.length;
    const kept = total - sheet.excludedColumns.length;
    return {
      key: unit.key || 'csv',
      unitKey: unit.key,
      sheetLabel: isCsv ? '—' : unit.sheetName,
      range: unit.range ?? t('upload.confirm.rangeFull'),
      name: sheet.name,
      rowCount: sheet.rowCount,
      kept,
      total,
      overrideCount: Object.keys(sheet.columnOverrides).length,
    };
  });

  const tableColumns = [
    ...(isCsv
      ? []
      : ([
          {
            title: t('upload.confirm.tableSheet'),
            dataIndex: 'sheetLabel',
            key: 'sheetLabel',
            render: (label: string) => <span style={{ fontWeight: 500 }}>{label}</span>,
          },
          {
            title: t('upload.confirm.rangeColumn'),
            dataIndex: 'range',
            key: 'range',
            render: (range: string) => <Typography.Text type="secondary">{range}</Typography.Text>,
          },
        ] as const)),
    {
      title: (
        <>
          {t('upload.confirm.tableDatasetName')}
          {isRefresh ? null : (
            <>
              {' '}
              <Typography.Text type="danger" style={{ marginLeft: 2 }}>
                *
              </Typography.Text>
            </>
          )}
        </>
      ),
      dataIndex: 'name',
      key: 'name',
      // Refresh pins the dataset name (state.ts RefreshPreset.name — "refresh
      // never renames"); the commit ignores any edit. Render it read-only so
      // the affordance tells the truth instead of a no-op editable input.
      render: (name: string, row: RowData) =>
        isRefresh ? (
          <Typography.Text
            data-component="DatasetNameStatic"
            data-unit={row.unitKey}
            title={t('upload.confirm.namePinnedHint')}
          >
            {state.refreshTargetName ?? name}
          </Typography.Text>
        ) : (
          <Input
            value={name}
            onChange={(e) =>
              dispatch({
                type: 'SET_DATASET_NAME',
                unit: row.unitKey,
                name: e.target.value,
              })
            }
            placeholder={t('upload.confirm.datasetNamePlaceholder')}
            maxLength={NAME_LENGTHS.DATASET_MAX}
            size="small"
            data-component="DatasetNameInput"
            data-unit={row.unitKey}
          />
        ),
    },
    {
      title: t('upload.confirm.tableRows'),
      dataIndex: 'rowCount',
      key: 'rowCount',
      align: 'right' as const,
      render: (n: number) => n.toLocaleString(),
    },
    {
      title: t('upload.confirm.tableCols'),
      key: 'cols',
      align: 'right' as const,
      render: (_: unknown, row: RowData) => `${row.kept} / ${row.total}`,
    },
    {
      title: t('upload.confirm.tableOverrides'),
      key: 'overrides',
      render: (_: unknown, row: RowData) =>
        row.overrideCount > 0 ? (
          <Tag color="blue">{t('upload.confirm.overrideCount', { count: row.overrideCount })}</Tag>
        ) : (
          <Typography.Text type="secondary">{t('upload.confirm.noOverrides')}</Typography.Text>
        ),
    },
  ];

  return (
    <div data-component="UploadConfirmStep">
      {isRefresh ? <RefreshSemantics state={state} dispatch={dispatch} /> : null}
      {isRefresh ? <RefreshExtraFiles state={state} dispatch={dispatch} /> : null}
      <div
        style={{
          marginBottom: 12,
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
        }}
        data-component="ConfirmSummary"
      >
        <span>
          <Typography.Text type="secondary">{t('upload.confirm.workspaceLabel')}</Typography.Text>{' '}
          <strong>{workspaceName}</strong>
        </span>
        <span>
          <Typography.Text type="secondary">{t('upload.confirm.sourceLabel')}</Typography.Text> {sourceLabel} ·{' '}
          {fileName}
          {fileSize ? ` (${fileSize})` : ''}
        </span>
      </div>
      <Table
        size="small"
        pagination={false}
        rowKey="key"
        dataSource={rows}
        columns={tableColumns}
        data-component="ConfirmTable"
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 12 }} data-component="ConfirmFooter">
        {isRefresh ? (
          // R191 — a refresh creates nothing: name the dataset it refreshes.
          <Trans
            i18nKey="upload.confirm.footerRefresh"
            values={{ name: state.refreshTargetName ?? '', workspace: workspaceName }}
            components={{ strong: <strong /> }}
          />
        ) : (
          <Trans
            i18nKey="upload.confirm.footer"
            count={rows.length}
            values={{ count: rows.length, workspace: workspaceName }}
            components={{ strong: <strong /> }}
          />
        )}
      </Typography.Paragraph>

      {commitError ? (
        <Alert
          type="error"
          showIcon
          title={commitErrorTitle(commitError, t)}
          description={commitErrorDescription(commitError, t)}
          style={{ marginTop: 12 }}
          data-component="CommitError"
        />
      ) : null}
    </div>
  );
}

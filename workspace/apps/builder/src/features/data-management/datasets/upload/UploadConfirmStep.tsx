import { Alert, Input, Table, Tag, Typography } from 'antd';
import type { TFunction } from 'i18next';
import type { Dispatch } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ERROR_CODES, NAME_LENGTHS } from '@/_generated/constants';
import { formatBytes } from '@/lib/formatBytes';
import { BatchApiErrorThrown } from '@/features/data-management/_shared/types';
import { useWorkspacesQuery } from '@/features/data-management/workspaces/hooks';
import { CSV_SHEET_KEY, type WizardAction, type WizardState } from './state';

function commitErrorTitle(err: Error, t: TFunction): string {
  if (err instanceof BatchApiErrorThrown && 'code' in err.body) {
    if (err.body.code === ERROR_CODES.NAME_TAKEN) {
      return t('upload.confirm.errorNameTakenTitle');
    }
    if (err.body.code === ERROR_CODES.COERCION_FAILED) {
      return t('upload.confirm.errorCoercionFailedTitle');
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
        const { sheet, column, dtype, cells, totalFailed } = err.body;
        const samples = cells
          .map((c) => t('upload.confirm.errorCoercionFailedCell', { row: c.row, value: c.value }))
          .join(' \u00b7 ');
        const base = t('upload.confirm.errorCoercionFailedDescription', {
          column: sheet ? `${sheet} \u203a ${column}` : column,
          dtype,
          count: totalFailed,
          samples,
        });
        // R144 (Review finding #3) \u2014 help the user tell WRONG DATA from WRONG
        // FORMAT. A failing cell equal to the column name is a repeated header
        // row in the source file (the real-export append seam) \u2014 a data fix,
        // not an override fix; otherwise offer both readings.
        const headerRow = cells.some((c) => c.value.trim() === column);
        const hint = t(
          headerRow
            ? 'upload.confirm.errorCoercionFailedHeaderRowHint'
            : 'upload.confirm.errorCoercionFailedHint',
        );
        return `${base} ${hint}`;
      }
      return t('upload.confirm.errorServerCode', { code: err.body.code });
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

type RowData = {
  key: string;
  sheetKey: string;
  sheetLabel: string;
  name: string;
  rowCount: number;
  kept: number;
  total: number;
  overrideCount: number;
};

export function UploadConfirmStep({ state, dispatch, commitError }: Props) {
  const { t } = useTranslation();
  const isCsv = state.sourceFormat === 'csv';
  const sheetKeys = isCsv ? [CSV_SHEET_KEY] : state.selectedSheets;
  const workspaces = useWorkspacesQuery();
  const workspaceName = workspaces.data?.find((w) => w.id === state.workspaceId)?.name ?? state.workspaceId ?? '—';

  const fileName = state.file?.name ?? (isCsv ? 'file.csv' : 'workbook');
  const fileSize = state.file ? formatBytes(state.file.size) : null;
  const sourceLabel = isCsv ? 'CSV' : 'Excel';

  const rows: RowData[] = sheetKeys
    .map((key) => {
      const sheet = state.sheets[key];
      if (!sheet) return null;
      const total = sheet.columns.length;
      const kept = total - sheet.excludedColumns.length;
      return {
        key: key || 'csv',
        sheetKey: key,
        sheetLabel: isCsv ? '—' : key,
        name: sheet.name,
        rowCount: sheet.rowCount,
        kept,
        total,
        overrideCount: Object.keys(sheet.columnOverrides).length,
      };
    })
    .filter((r): r is RowData => r !== null);

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
        ] as const)),
    {
      title: (
        <>
          {t('upload.confirm.tableDatasetName')}{' '}
          <Typography.Text type="danger" style={{ marginLeft: 2 }}>
            *
          </Typography.Text>
        </>
      ),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: RowData) => (
        <Input
          value={name}
          onChange={(e) =>
            dispatch({
              type: 'SET_DATASET_NAME',
              sheet: row.sheetKey,
              name: e.target.value,
            })
          }
          placeholder={t('upload.confirm.datasetNamePlaceholder')}
          maxLength={NAME_LENGTHS.DATASET_MAX}
          size="small"
          data-component="DatasetNameInput"
          data-sheet={row.sheetKey}
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
          <Typography.Text type="secondary">{t('upload.confirm.sourceLabel')}</Typography.Text> {sourceLabel} · {fileName}
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
        <Trans
          i18nKey="upload.confirm.footer"
          count={rows.length}
          values={{ count: rows.length, workspace: workspaceName }}
          components={{ strong: <strong /> }}
        />
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


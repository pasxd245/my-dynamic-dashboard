import { Alert, Input, Table, Tag, Typography } from 'antd';
import type { Dispatch } from 'react';
import { BatchApiErrorThrown } from '../../_shared/types';
import { useWorkspacesQuery } from '../../workspaces/hooks';
import { CSV_SHEET_KEY, type WizardAction, type WizardState } from './state';

function commitErrorTitle(err: Error): string {
  if (err instanceof BatchApiErrorThrown && 'code' in err.body) {
    if (err.body.code === 'name_taken') {
      return 'A dataset with that name already exists in this workspace';
    }
  }
  return "Couldn't commit datasets";
}

function commitErrorDescription(err: Error): string {
  if (err instanceof BatchApiErrorThrown) {
    if ('code' in err.body) {
      if (err.body.code === 'name_taken') {
        return "Rename one of the items in the table above (the wizard's Confirm step) so each dataset name is unique within this workspace, then try again.";
      }
      return `Server returned code ${err.body.code}.`;
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
            title: 'Sheet',
            dataIndex: 'sheetLabel',
            key: 'sheetLabel',
            render: (label: string) => <span style={{ fontWeight: 500 }}>{label}</span>,
          },
        ] as const)),
    {
      title: (
        <>
          Dataset name{' '}
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
          placeholder="Dataset name"
          maxLength={120}
          size="small"
          data-component="DatasetNameInput"
          data-sheet={row.sheetKey}
        />
      ),
    },
    {
      title: 'Rows',
      dataIndex: 'rowCount',
      key: 'rowCount',
      align: 'right' as const,
      render: (n: number) => n.toLocaleString(),
    },
    {
      title: 'Cols',
      key: 'cols',
      align: 'right' as const,
      render: (_: unknown, row: RowData) => `${row.kept} / ${row.total}`,
    },
    {
      title: 'Overrides',
      key: 'overrides',
      render: (_: unknown, row: RowData) =>
        row.overrideCount > 0 ? (
          <Tag color="blue">
            {row.overrideCount} column{row.overrideCount === 1 ? '' : 's'}
          </Tag>
        ) : (
          <Typography.Text type="secondary">none</Typography.Text>
        ),
    },
  ];

  const verb = rows.length === 1 ? 'dataset' : 'datasets';

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
          <Typography.Text type="secondary">Workspace:</Typography.Text> <strong>{workspaceName}</strong>
        </span>
        <span>
          <Typography.Text type="secondary">Source:</Typography.Text> {sourceLabel} · {fileName}
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
        Creating <strong>{rows.length}</strong> {verb} in <strong>{workspaceName}</strong>.
      </Typography.Paragraph>

      {commitError ? (
        <Alert
          type="error"
          showIcon
          message={commitErrorTitle(commitError)}
          description={commitErrorDescription(commitError)}
          style={{ marginTop: 12 }}
          data-component="CommitError"
        />
      ) : null}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

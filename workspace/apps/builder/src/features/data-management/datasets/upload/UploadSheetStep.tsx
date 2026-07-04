import { Alert, Button, Checkbox, Empty, Space, Table, Typography } from "antd";
import type { Dispatch } from "react";
import { useTranslation } from "react-i18next";
import { formatBytes } from "@/lib/formatBytes";
import type { WizardAction, WizardState } from "./state";

type Props = Readonly<{
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}>;

export function UploadSheetStep({ state, dispatch }: Props) {
  const { t } = useTranslation();

  if (state.availableSheets.length === 0) {
    return (
      <Empty
        description={t('upload.sheet.noWorkbookSheets')}
        data-component="UploadSheetStepEmpty"
      />
    );
  }

  const fileName = state.file?.name ?? "workbook";
  const fileSize = state.file ? formatBytes(state.file.size) : "";
  const total = state.availableSheets.length;
  const selectedCount = state.selectedSheets.length;

  const selectAll = () => {
    for (const s of state.availableSheets) {
      if (!state.selectedSheets.includes(s.sheet)) {
        dispatch({ type: "TOGGLE_SELECTED_SHEET", sheet: s.sheet });
      }
    }
  };
  const clearAll = () => {
    for (const s of state.selectedSheets) {
      dispatch({ type: "TOGGLE_SELECTED_SHEET", sheet: s });
    }
  };

  const columns = [
    {
      title: "",
      key: "selected",
      width: 48,
      render: (_: unknown, row: { sheet: string }) => (
        <Checkbox
          checked={state.selectedSheets.includes(row.sheet)}
          onChange={() =>
            dispatch({ type: "TOGGLE_SELECTED_SHEET", sheet: row.sheet })
          }
          data-component="SheetCheckbox"
          data-sheet={row.sheet}
        />
      ),
    },
    { title: t('upload.sheet.tableSheet'), dataIndex: "sheet", key: "sheet" },
    {
      title: t('upload.sheet.tableRows'),
      dataIndex: "rowCount",
      key: "rowCount",
      align: "right" as const,
      render: (n: number) => n.toLocaleString(),
    },
    {
      title: t('upload.sheet.tableCols'),
      dataIndex: "columnCount",
      key: "columnCount",
      align: "right" as const,
    },
  ];

  return (
    <div data-component="UploadSheetStep">
      {state.mode === 'refresh' && state.refreshTargetSheet ? (
        <Alert
          type="info"
          showIcon
          title={t('upload.refresh.sheetNote', { sheet: state.refreshTargetSheet })}
          style={{ marginBottom: 12 }}
          data-component="RefreshSheetNote"
        />
      ) : null}
      <Typography.Paragraph style={{ marginBottom: 4 }}>
        <strong>{fileName}</strong>
        {fileSize ? ` · ${fileSize}` : ""} · {t('upload.sheet.fileSummary', { count: total })}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">{t('upload.sheet.selectionHint')}</Typography.Paragraph>
      <Table
        rowKey="sheet"
        size="small"
        pagination={false}
        dataSource={state.availableSheets.map((s) => ({ ...s, key: s.sheet }))}
        columns={columns}
      />
      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Space>
          <Button
            type="link"
            size="small"
            onClick={selectAll}
            disabled={selectedCount === total}
            data-component="SheetSelectAll"
          >
            {t('upload.sheet.selectAll')}
          </Button>
          <Button
            type="link"
            size="small"
            onClick={clearAll}
            disabled={selectedCount === 0}
            data-component="SheetClear"
          >
            {t('upload.sheet.clear')}
          </Button>
        </Space>
        <Typography.Text type="secondary" data-component="SheetSelectedCount">
          {t('upload.sheet.selectedOfTotal', { selected: selectedCount, total })}
        </Typography.Text>
      </div>
    </div>
  );
}


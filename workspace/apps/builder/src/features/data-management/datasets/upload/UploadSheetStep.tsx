import { Button, Checkbox, Empty, Space, Table, Typography } from "antd";
import type { Dispatch } from "react";
import type { WizardAction, WizardState } from "./state";

type Props = Readonly<{
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}>;

export function UploadSheetStep({ state, dispatch }: Props) {
  if (state.availableSheets.length === 0) {
    return (
      <Empty
        description="No sheets found in the workbook"
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
    { title: "Sheet", dataIndex: "sheet", key: "sheet" },
    {
      title: "Rows",
      dataIndex: "rowCount",
      key: "rowCount",
      align: "right" as const,
      render: (n: number) => n.toLocaleString(),
    },
    {
      title: "Cols",
      dataIndex: "columnCount",
      key: "columnCount",
      align: "right" as const,
    },
  ];

  return (
    <div data-component="UploadSheetStep">
      <Typography.Paragraph style={{ marginBottom: 4 }}>
        <strong>{fileName}</strong>
        {fileSize ? ` · ${fileSize}` : ""} · {total}{" "}
        {total === 1 ? "sheet" : "sheets"}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        Select sheets to import. One dataset is created per selected sheet.
      </Typography.Paragraph>
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
            Select all
          </Button>
          <Button
            type="link"
            size="small"
            onClick={clearAll}
            disabled={selectedCount === 0}
            data-component="SheetClear"
          >
            Clear
          </Button>
        </Space>
        <Typography.Text type="secondary" data-component="SheetSelectedCount">
          {selectedCount} of {total} selected
        </Typography.Text>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

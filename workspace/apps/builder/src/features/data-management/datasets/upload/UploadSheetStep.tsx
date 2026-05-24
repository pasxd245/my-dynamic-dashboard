import { Checkbox, Empty, Table, Typography } from "antd";
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
    { title: "Rows", dataIndex: "rowCount", key: "rowCount" },
    { title: "Columns", dataIndex: "columnCount", key: "columnCount" },
    {
      title: "Range",
      dataIndex: "usedRange",
      key: "usedRange",
      render: (v?: string) => v ?? "—",
    },
  ];

  return (
    <div data-component="UploadSheetStep">
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Select sheets to import
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Each selected sheet becomes its own dataset.
      </Typography.Paragraph>
      <Table
        rowKey="sheet"
        size="small"
        pagination={false}
        dataSource={state.availableSheets.map((s) => ({ ...s, key: s.sheet }))}
        columns={columns}
      />
    </div>
  );
}

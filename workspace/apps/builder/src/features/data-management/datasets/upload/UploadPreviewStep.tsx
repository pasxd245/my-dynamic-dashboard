import { Alert, Button, Space, Table, Tabs, Typography } from "antd";
import type { Dispatch } from "react";
import type { Dtype } from "../types";
import { CSV_SHEET_KEY, type WizardAction, type WizardState } from "./state";

type Props = Readonly<{
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}>;

export function UploadPreviewStep({ state, dispatch }: Props) {
  const isCsv = state.sourceFormat === "csv";
  const sheetKeys = isCsv ? [CSV_SHEET_KEY] : state.selectedSheets;

  if (sheetKeys.length === 0) {
    return (
      <Alert
        type="info"
        showIcon
        message="No sheets selected"
        description="Go back to the Sheet step and pick at least one."
      />
    );
  }

  if (isCsv) {
    return (
      <div data-component="UploadPreviewStep">
        <SheetPreview
          sheetKey={CSV_SHEET_KEY}
          state={state}
          dispatch={dispatch}
        />
      </div>
    );
  }

  return (
    <div data-component="UploadPreviewStep">
      <Tabs
        items={sheetKeys.map((key) => ({
          key,
          label: tabLabel(key, state),
          children: (
            <SheetPreview sheetKey={key} state={state} dispatch={dispatch} />
          ),
        }))}
      />
    </div>
  );
}

type SheetPreviewProps = Readonly<{
  sheetKey: string;
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}>;

function tabLabel(key: string, state: WizardState): string {
  const sheet = state.sheets[key];
  if (!sheet) return key;
  if (sheet.status === "failed") return `${key} ✗`;
  if (sheet.status === "ok") return `${key} ✓`;
  return key;
}

function SheetPreview({ sheetKey, state, dispatch }: SheetPreviewProps) {
  const sheet = state.sheets[sheetKey];
  const isCsv = state.sourceFormat === "csv";

  if (!sheet) {
    return <Alert type="info" message="Not parsed yet" />;
  }

  if (sheet.status === "failed") {
    return (
      <div>
        <Alert
          type="error"
          showIcon
          message={`Parse failed: ${sheet.parseError?.error ?? "unknown"}`}
          description={sheet.parseError?.detail}
          data-component="SheetParseFailed"
        />
        <Space style={{ marginTop: 12 }} data-component="SheetParseFailedActions">
          <Button
            onClick={() => dispatch({ type: "GOTO_STEP", step: "source" })}
            data-component="SheetParseFailedRepickFile"
          >
            Re-pick file
          </Button>
          {isCsv ? null : (
            <Button
              onClick={() =>
                dispatch({ type: "TOGGLE_SELECTED_SHEET", sheet: sheetKey })
              }
              data-component="SheetParseFailedDeselect"
            >
              Deselect this sheet
            </Button>
          )}
          <Button
            type="primary"
            onClick={() => dispatch({ type: "GOTO_STEP", step: "metadata" })}
            data-component="SheetParseFailedAdjustOptions"
          >
            Adjust parse options
          </Button>
        </Space>
      </div>
    );
  }

  const includedColumns = sheet.columns.filter(
    (c) => !sheet.excludedColumns.includes(c.name),
  );

  const resolvedDtype = (name: string, inferred: Dtype): Dtype =>
    sheet.columnOverrides[name]?.dtype ?? inferred;

  const fileName = state.file?.name ?? (isCsv ? "file.csv" : "workbook");
  const sheetLabel = isCsv ? "" : sheetKey;

  return (
    <div>
      <Typography.Paragraph style={{ marginTop: 0, marginBottom: 4 }}>
        {sheetLabel ? (
          <>
            <strong>{sheetLabel}</strong> ({fileName})
          </>
        ) : (
          <strong>{fileName}</strong>
        )}{" "}
        · {sheet.rowCount.toLocaleString()} rows · {includedColumns.length} of{" "}
        {sheet.columns.length} columns
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        Dtypes reflect your overrides from the Metadata step. Use Back to
        revise.
      </Typography.Paragraph>
      <Table
        size="small"
        pagination={false}
        rowKey="__idx"
        dataSource={sheet.sampleRows.map((row, idx) => {
          const obj: Record<string, string | null> = { __idx: String(idx) };
          sheet.columns.forEach((col, i) => {
            obj[col.name] = row[i] ?? null;
          });
          return obj;
        })}
        columns={includedColumns.map((col) => ({
          title: (
            <div>
              <div>{col.name}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                {resolvedDtype(col.name, col.dtype)}
              </div>
            </div>
          ),
          dataIndex: col.name,
          key: col.name,
          render: (v: string | null) =>
            v ?? <em style={{ opacity: 0.4 }}>null</em>,
        }))}
        scroll={{ x: true }}
        data-component="SheetPreviewTable"
      />
      <Typography.Paragraph
        type="secondary"
        style={{ marginTop: 8, fontSize: 12 }}
      >
        Showing {sheet.sampleRows.length} of{" "}
        {sheet.rowCount.toLocaleString()} rows · {includedColumns.length}{" "}
        columns (scroll horizontally for more)
      </Typography.Paragraph>
    </div>
  );
}

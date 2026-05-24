import { Alert, Checkbox, Select, Spin, Table, Tabs, Typography } from "antd";
import type { Dispatch } from "react";
import type { ColumnOverride, Dtype } from "../types";
import { CSV_SHEET_KEY, type WizardAction, type WizardState } from "./state";

const DTYPES: Dtype[] = [
  "string",
  "integer",
  "float",
  "boolean",
  "date",
  "datetime",
];

type Props = Readonly<{
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}>;

export function UploadMetadataStep({ state, dispatch }: Props) {
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

  return (
    <div data-component="UploadMetadataStep">
      <Tabs
        items={sheetKeys.map((key) => ({
          key: key || "csv",
          label: tabLabel(key, state),
          children: <SheetPane sheetKey={key} state={state} dispatch={dispatch} />,
        }))}
      />
    </div>
  );
}

function tabLabel(key: string, state: WizardState): string {
  const name = key || "CSV";
  const sheet = state.sheets[key];
  if (!sheet) return name;
  if (sheet.status === "parsing") return `${name} ⏳`;
  if (sheet.status === "failed") return `${name} ✗`;
  if (sheet.status === "ok") return `${name} ✓`;
  return name;
}

type PaneProps = Readonly<{
  sheetKey: string;
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}>;

function SheetPane({ sheetKey, state, dispatch }: PaneProps) {
  const sheet = state.sheets[sheetKey];

  if (!sheet) {
    return <Alert type="info" message="Not parsed yet" />;
  }

  if (sheet.status === "parsing") {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin /> Parsing…
      </div>
    );
  }

  if (sheet.status === "failed") {
    return (
      <Alert
        type="error"
        showIcon
        message={`Parse failed: ${sheet.parseError?.error ?? "unknown"}`}
        description={sheet.parseError?.detail}
        data-component="SheetParseFailed"
      />
    );
  }

  const columns = [
    {
      title: "Include",
      key: "include",
      width: 80,
      render: (_: unknown, row: { name: string }) => (
        <Checkbox
          checked={!sheet.excludedColumns.includes(row.name)}
          onChange={() =>
            dispatch({
              type: "TOGGLE_EXCLUDED_COLUMN",
              sheet: sheetKey,
              column: row.name,
            })
          }
          data-component="ColumnIncludeCheckbox"
          data-column={row.name}
        />
      ),
    },
    { title: "Column", dataIndex: "name", key: "name" },
    {
      title: "Dtype",
      key: "dtype",
      render: (_: unknown, row: { name: string; dtype: Dtype }) => {
        const override = sheet.columnOverrides[row.name];
        return (
          <Select
            size="small"
            style={{ width: 140 }}
            value={override?.dtype ?? row.dtype}
            options={DTYPES.map((d) => ({ value: d, label: d }))}
            onChange={(value) => {
              const same = value === row.dtype;
              if (same) {
                dispatch({
                  type: "SET_COLUMN_OVERRIDE",
                  sheet: sheetKey,
                  column: row.name,
                  override: null,
                });
                return;
              }
              const next: ColumnOverride = { dtype: value };
              if (value === "date" || value === "datetime") {
                next.format =
                  override?.format ??
                  (value === "date" ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm:ss");
              }
              dispatch({
                type: "SET_COLUMN_OVERRIDE",
                sheet: sheetKey,
                column: row.name,
                override: next,
              });
            }}
            data-component="ColumnDtypeSelect"
            data-column={row.name}
          />
        );
      },
    },
  ];

  return (
    <div>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Columns ({sheet.columns.length - sheet.excludedColumns.length} of {sheet.columns.length} kept)
      </Typography.Title>
      <Table
        size="small"
        pagination={false}
        rowKey="name"
        dataSource={sheet.columns.map((c) => ({ ...c, key: c.name }))}
        columns={columns}
      />
      <Typography.Title level={5} style={{ marginTop: 24 }}>
        Preview ({sheet.sampleRows.length} of {sheet.rowCount} rows)
      </Typography.Title>
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
        columns={sheet.columns.map((col) => ({
          title: col.name,
          dataIndex: col.name,
          key: col.name,
          render: (v: string | null) => v ?? <em style={{ opacity: 0.4 }}>null</em>,
        }))}
        scroll={{ x: true }}
        data-component="SheetPreviewTable"
      />
    </div>
  );
}

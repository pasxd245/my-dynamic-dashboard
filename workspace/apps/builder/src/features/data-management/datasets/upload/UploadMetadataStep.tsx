import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Typography,
} from "antd";
import type { Dispatch } from "react";
import type {
  Column,
  ColumnOverride,
  Dtype,
  ParseOptions,
  SheetSummary,
} from "../types";
import {
  CSV_SHEET_KEY,
  type SheetState,
  type WizardAction,
  type WizardState,
} from "./state";

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
  /** Excel-only: re-parse a single sheet using its current parseOptions.
   *  CSV passes `undefined` since R19 Q1=C has no CSV re-parse. */
  onReparseSheet?: (sheet: string) => void;
}>;

export function UploadMetadataStep({
  state,
  dispatch,
  onReparseSheet,
}: Props) {
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
      <div data-component="UploadMetadataStep">
        <SheetPane
          sheetKey={CSV_SHEET_KEY}
          state={state}
          dispatch={dispatch}
          onReparse={undefined}
        />
      </div>
    );
  }

  return (
    <div data-component="UploadMetadataStep">
      <Tabs
        items={sheetKeys.map((key) => ({
          key,
          label: tabLabel(key, state),
          children: (
            <SheetPane
              sheetKey={key}
              state={state}
              dispatch={dispatch}
              onReparse={onReparseSheet}
            />
          ),
        }))}
      />
    </div>
  );
}

function tabLabel(key: string, state: WizardState): React.ReactNode {
  const name = key || "CSV";
  const sheet = state.sheets[key];
  if (!sheet) return name;
  if (sheet.status === "parsing") return `${name} ⏳`;
  if (sheet.status === "failed") return `${name} ✗`;
  if (sheet.status === "ok") {
    const hasOverrides =
      Object.keys(sheet.columnOverrides).length > 0 ||
      sheet.excludedColumns.length > 0;
    if (hasOverrides) {
      return (
        <span data-component="SheetTabLabel" data-overridden="true">
          {name}{" "}
          <span
            style={{ color: "#d48806", fontWeight: 600 }}
            aria-label="has overrides"
            title="This sheet has user overrides"
          >
            ✎
          </span>
        </span>
      );
    }
    return (
      <span data-component="SheetTabLabel" data-overridden="false">
        {name}{" "}
        <span style={{ color: "#52c41a" }} aria-label="parsed">
          ✓
        </span>
      </span>
    );
  }
  return name;
}

type PaneProps = Readonly<{
  sheetKey: string;
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  /** Excel-only re-parse callback; undefined for CSV (R19 Q1=C). */
  onReparse: ((sheet: string) => void) | undefined;
}>;

function SheetPane({ sheetKey, state, dispatch, onReparse }: PaneProps) {
  const sheet = state.sheets[sheetKey];
  const isCsv = state.sourceFormat === "csv";

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

  // The parse-options disclosure is always available (auto-expands on
  // failed so the user lands on the obvious next action).
  const optionsDisclosure = (
    <ParseOptionsDisclosure
      sheetKey={sheetKey}
      sheet={sheet}
      isCsv={isCsv}
      availableSheets={state.availableSheets}
      dispatch={dispatch}
      onReparse={onReparse}
    />
  );

  if (sheet.status === "failed") {
    return (
      <div>
        {optionsDisclosure}
        <Alert
          type="error"
          showIcon
          message={`Parse failed: ${sheet.parseError?.error ?? "unknown"}`}
          description={sheet.parseError?.detail}
          data-component="SheetParseFailed"
        />
        <ParseFailedActions
          sheetKey={sheetKey}
          isCsv={isCsv}
          dispatch={dispatch}
        />
      </div>
    );
  }

  const sheetLabel = isCsv ? "" : sheetKey;
  const total = sheet.columns.length;
  const kept = total - sheet.excludedColumns.length;

  const resetAll = () => {
    for (const col of sheet.columns) {
      if (sheet.columnOverrides[col.name]) {
        dispatch({
          type: "SET_COLUMN_OVERRIDE",
          sheet: sheetKey,
          column: col.name,
          override: null,
        });
      }
    }
  };
  const hasAnyOverride = Object.keys(sheet.columnOverrides).length > 0;

  const tableColumns = [
    {
      title: "Include",
      key: "include",
      width: 80,
      render: (_: unknown, row: Column) => (
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
    {
      title: "Column",
      dataIndex: "name",
      key: "name",
      render: (name: string) => (
        <span style={{ fontWeight: 500 }}>{name}</span>
      ),
    },
    {
      title: "Detected",
      dataIndex: "dtype",
      key: "detected",
      render: (d: Dtype) => (
        <Typography.Text type="secondary">{d}</Typography.Text>
      ),
    },
    {
      title: "Override",
      key: "override",
      render: (_: unknown, row: Column) => (
        <OverrideCell
          row={row}
          override={sheet.columnOverrides[row.name]}
          onChange={(override) =>
            dispatch({
              type: "SET_COLUMN_OVERRIDE",
              sheet: sheetKey,
              column: row.name,
              override,
            })
          }
        />
      ),
    },
    {
      title: "Sample values",
      key: "sample",
      render: (_: unknown, row: Column) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {sampleFor(sheet.sampleRows, sheet.columns, row.name)}
        </Typography.Text>
      ),
    },
  ];

  return (
    <div>
      {optionsDisclosure}
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Detected schema {sheetLabel ? <>for <strong>{sheetLabel}</strong> </> : null}
        ({sheet.rowCount.toLocaleString()} rows · {total} columns). Override
        any column's dtype before previewing.
      </Typography.Paragraph>
      <Table
        size="small"
        pagination={false}
        rowKey="name"
        dataSource={sheet.columns.map((c) => ({ ...c, key: c.name }))}
        columns={tableColumns}
      />
      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Button
          type="link"
          size="small"
          onClick={resetAll}
          disabled={!hasAnyOverride}
          data-component="ResetOverrides"
        >
          Reset all to detected
        </Button>
        <Typography.Text
          type="secondary"
          data-component="MetadataIncludedCount"
        >
          {sheetLabel ? `${sheetLabel} · ` : ""}
          {kept} of {total} columns included
        </Typography.Text>
      </div>
    </div>
  );
}

type OverrideProps = Readonly<{
  row: Column;
  override: ColumnOverride | undefined;
  onChange: (override: ColumnOverride | null) => void;
}>;

function OverrideCell({ row, override, onChange }: OverrideProps) {
  const dtype = override?.dtype ?? row.dtype;
  const showFormat = dtype === "date" || dtype === "datetime";
  const isOverridden = override !== undefined;
  return (
    <Space direction="vertical" size={4} style={{ width: "100%" }}>
      <Select
        size="small"
        status={isOverridden ? "warning" : undefined}
        style={{
          width: 140,
          background: isOverridden ? "#fffbe6" : undefined,
        }}
        value={dtype}
        options={DTYPES.map((d) => ({ value: d, label: d }))}
        onChange={(value) => {
          const same = value === row.dtype;
          if (same) {
            onChange(null);
            return;
          }
          const next: ColumnOverride = { dtype: value };
          if (value === "date" || value === "datetime") {
            next.format =
              override?.format ??
              (value === "date" ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm:ss");
          }
          onChange(next);
        }}
        data-component="ColumnDtypeSelect"
        data-column={row.name}
        data-overridden={isOverridden}
      />
      {showFormat ? (
        <Input
          size="small"
          value={override?.format ?? ""}
          placeholder={dtype === "date" ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm:ss"}
          onChange={(e) => onChange({ dtype, format: e.target.value })}
          data-component="ColumnFormatInput"
          data-column={row.name}
          style={{ width: 180 }}
        />
      ) : null}
    </Space>
  );
}

function sampleFor(
  rows: (string | null)[][],
  cols: Column[],
  name: string,
): string {
  const idx = cols.findIndex((c) => c.name === name);
  if (idx < 0) return "—";
  const values = rows
    .map((r) => r[idx])
    .filter((v): v is string => v != null && v !== "")
    .slice(0, 3);
  if (values.length === 0) return "—";
  return values.join(", ");
}

type DisclosureProps = Readonly<{
  sheetKey: string;
  sheet: SheetState;
  isCsv: boolean;
  availableSheets: SheetSummary[];
  dispatch: Dispatch<WizardAction>;
  onReparse: ((sheet: string) => void) | undefined;
}>;

function ParseOptionsDisclosure({
  sheetKey,
  sheet,
  isCsv,
  availableSheets,
  dispatch,
  onReparse,
}: DisclosureProps) {
  const opts = sheet.parseOptions;
  const update = (patch: Partial<ParseOptions>) => {
    const next: ParseOptions = { ...opts, ...patch };
    // Strip undefined values so an empty input clears the field.
    for (const k of Object.keys(next) as (keyof ParseOptions)[]) {
      if (next[k] === undefined) delete next[k];
    }
    dispatch({ type: "SET_PARSE_OPTIONS", sheet: sheetKey, options: next });
  };

  const usedRange = isCsv
    ? undefined
    : availableSheets.find((s) => s.sheet === sheetKey)?.usedRange;

  const body = (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      {isCsv ? (
        <div data-component="ParseOptionCsvSkipRows">
          <Typography.Text>Skip rows: </Typography.Text>
          <InputNumber
            min={0}
            value={opts.skip_rows ?? null}
            onChange={(v) =>
              update({ skip_rows: typeof v === "number" ? v : undefined })
            }
            placeholder="0"
            data-component="ParseOptionSkipRowsInput"
          />
          <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
            Leading rows to drop before the header.
          </Typography.Text>
        </div>
      ) : (
        <div data-component="ParseOptionExcelRange">
          <Typography.Text>Range: </Typography.Text>
          <Input
            value={opts.range ?? ""}
            onChange={(e) =>
              update({ range: e.target.value === "" ? undefined : e.target.value })
            }
            placeholder={usedRange ?? "A1:C20"}
            style={{ width: 160 }}
            data-component="ParseOptionRangeInput"
          />
          <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
            Cell range like <code>A1:C20</code>. Default is the sheet's
            used range.
          </Typography.Text>
        </div>
      )}
      <div data-component="ParseOptionHasHeader">
        <Typography.Text style={{ marginRight: 8 }}>
          First row is a header:
        </Typography.Text>
        <Switch
          checked={opts.has_header ?? true}
          onChange={(v) => update({ has_header: v })}
          data-component="ParseOptionHasHeaderSwitch"
        />
        <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
          When off, columns are named <code>column1, column2, …</code>.
        </Typography.Text>
      </div>
      {!isCsv && onReparse ? (
        <Button
          onClick={() => onReparse(sheetKey)}
          disabled={sheet.status === "parsing"}
          loading={sheet.status === "parsing"}
          data-component="ParseOptionReparseButton"
        >
          Re-parse this sheet
        </Button>
      ) : null}
      <Alert
        type="info"
        showIcon
        message={
          isCsv
            ? "Editing parse options resets your column dtype overrides and exclusions for this file."
            : "Re-parsing or editing the range resets your column overrides and exclusions for this sheet."
        }
        data-component="ParseOptionResetWarning"
      />
    </Space>
  );

  // Auto-expand on failed so the user lands on the obvious next action.
  const defaultOpen = sheet.status === "failed";

  return (
    <Collapse
      size="small"
      style={{ marginBottom: 12 }}
      defaultActiveKey={defaultOpen ? ["parse-options"] : []}
      items={[
        {
          key: "parse-options",
          label: "Parse options",
          children: body,
        },
      ]}
      data-component="ParseOptionsDisclosure"
    />
  );
}

type ParseFailedActionsProps = Readonly<{
  sheetKey: string;
  isCsv: boolean;
  dispatch: Dispatch<WizardAction>;
}>;

function ParseFailedActions({
  sheetKey,
  isCsv,
  dispatch,
}: ParseFailedActionsProps) {
  return (
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
      <Typography.Text type="secondary" style={{ marginLeft: 4 }}>
        Or adjust parse options above and re-parse.
      </Typography.Text>
    </Space>
  );
}

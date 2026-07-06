import { Alert, Button, Space, Table, Tabs, Typography } from "antd";
import type { TFunction } from "i18next";
import type { Dispatch } from "react";
import { useTranslation } from "react-i18next";
import type { Dtype } from "../types";
import {
  sheetHasMultipleUnits,
  units,
  type WizardAction,
  type WizardState,
  type WizardUnit,
} from "./state";

type Props = Readonly<{
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}>;

export function UploadPreviewStep({ state, dispatch }: Props) {
  const { t } = useTranslation();
  const isCsv = state.sourceFormat === "csv";
  const unitList = units(state);

  if (unitList.length === 0) {
    return (
      <Alert
        type="info"
        showIcon
        title={t('upload.preview.noSheetsSelected')}
        description={t('upload.preview.noSheetsHint')}
      />
    );
  }

  if (isCsv) {
    return (
      <div data-component="UploadPreviewStep">
        <SheetPreview unit={unitList[0]} state={state} dispatch={dispatch} />
      </div>
    );
  }

  return (
    <div data-component="UploadPreviewStep">
      <Tabs
        items={unitList.map((unit) => ({
          key: unit.key,
          label: tabLabel(unit, state, t),
          children: <SheetPreview unit={unit} state={state} dispatch={dispatch} />,
        }))}
      />
    </div>
  );
}

type SheetPreviewProps = Readonly<{
  unit: WizardUnit;
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}>;

/** F8 — a preview tab is a UNIT; disambiguate same-sheet units by range. */
function unitLabelText(unit: WizardUnit, state: WizardState, t: TFunction): string {
  const base = sheetHasMultipleUnits(state, unit.sheetName)
    ? `${unit.sheetName} · ${unit.range ?? t('upload.confirm.rangeFull')}`
    : unit.sheetName;
  return base || 'CSV';
}

function tabLabel(unit: WizardUnit, state: WizardState, t: TFunction): string {
  const name = unitLabelText(unit, state, t);
  const sheet = unit.state;
  if (sheet.status === "failed") return `${name} ✗`;
  if (sheet.status === "ok") return `${name} ✓`;
  return name;
}

function SheetPreview({ unit, state, dispatch }: SheetPreviewProps) {
  const { t } = useTranslation();
  const sheet = unit.state;
  const isCsv = state.sourceFormat === "csv";
  const isAdded = unit.key !== unit.sheetName;

  if (sheet.status === "failed") {
    // F8 — remove an added range-unit on its own; deselect an initial unit's
    // sheet; CSV has neither.
    let removeAction: React.ReactNode = null;
    if (!isCsv && isAdded) {
      removeAction = (
        <Button
          onClick={() => dispatch({ type: "REMOVE_RANGE_UNIT", unit: unit.key })}
          data-component="SheetParseFailedRemoveRange"
        >
          {t('upload.metadata.removeRange')}
        </Button>
      );
    } else if (!isCsv) {
      removeAction = (
        <Button
          onClick={() =>
            dispatch({ type: "TOGGLE_SELECTED_SHEET", sheet: unit.sheetName })
          }
          data-component="SheetParseFailedDeselect"
        >
          {t('upload.preview.deselectSheet')}
        </Button>
      );
    }
    return (
      <div>
        <Alert
          type="error"
          showIcon
          title={t('upload.preview.parseFailed', { error: sheet.parseError?.error ?? 'unknown' })}
          description={sheet.parseError?.detail}
          data-component="SheetParseFailed"
        />
        <Space style={{ marginTop: 12 }} data-component="SheetParseFailedActions">
          <Button
            onClick={() => dispatch({ type: "GOTO_STEP", step: "source" })}
            data-component="SheetParseFailedRepickFile"
          >
            {t('upload.preview.repickFile')}
          </Button>
          {removeAction}
          <Button
            type="primary"
            onClick={() => dispatch({ type: "GOTO_STEP", step: "metadata" })}
            data-component="SheetParseFailedAdjustOptions"
          >
            {t('upload.preview.adjustOptions')}
          </Button>
        </Space>
      </div>
    );
  }

  if (sheet.status !== "ok") {
    return <Alert type="info" title={t('upload.preview.notParsedYet')} />;
  }

  const includedColumns = sheet.columns.filter(
    (c) => !sheet.excludedColumns.includes(c.name),
  );

  const resolvedDtype = (name: string, inferred: Dtype): Dtype =>
    sheet.columnOverrides[name]?.dtype ?? inferred;

  const fileName = state.file?.name ?? (isCsv ? "file.csv" : "workbook");
  const sheetLabel = isCsv ? "" : unit.sheetName;

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
        ·{" "}
        {t('upload.preview.summary', {
          count: sheet.rowCount,
          shown: includedColumns.length,
          total: sheet.columns.length,
        })}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        {t('upload.preview.dtypeHint')}
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
        {t('upload.preview.showing', {
          count: sheet.rowCount,
          shown: sheet.sampleRows.length,
          total: sheet.rowCount,
          cols: includedColumns.length,
        })}
      </Typography.Paragraph>
    </div>
  );
}

import { Alert, Card, Input, Typography } from "antd";
import type { Dispatch } from "react";
import { CSV_SHEET_KEY, type WizardAction, type WizardState } from "./state";

type Props = Readonly<{
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  commitError?: Error | null;
}>;

export function UploadConfirmStep({ state, dispatch, commitError }: Props) {
  const isCsv = state.sourceFormat === "csv";
  const sheetKeys = isCsv ? [CSV_SHEET_KEY] : state.selectedSheets;

  return (
    <div data-component="UploadConfirmStep">
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Confirm — {sheetKeys.length}{" "}
        {sheetKeys.length === 1 ? "dataset" : "datasets"} will be created
      </Typography.Title>
      {sheetKeys.map((key) => {
        const sheet = state.sheets[key];
        if (!sheet) return null;
        const kept = sheet.columns.length - sheet.excludedColumns.length;
        return (
          <Card
            key={key || "csv"}
            size="small"
            style={{ marginBottom: 12 }}
            data-component="ConfirmDatasetCard"
            data-sheet={key}
          >
            <Typography.Text type="secondary">
              {isCsv ? "CSV" : `Sheet "${key}"`} · {sheet.rowCount} rows ·{" "}
              {kept} of {sheet.columns.length} columns
            </Typography.Text>
            <Input
              value={sheet.name}
              onChange={(e) =>
                dispatch({
                  type: "SET_DATASET_NAME",
                  sheet: key,
                  name: e.target.value,
                })
              }
              placeholder="Dataset name"
              maxLength={120}
              style={{ marginTop: 8 }}
              data-component="DatasetNameInput"
              data-sheet={key}
            />
          </Card>
        );
      })}

      {commitError ? (
        <Alert
          type="error"
          showIcon
          message="Couldn't commit datasets"
          description={commitError.message}
          style={{ marginTop: 12 }}
          data-component="CommitError"
        />
      ) : null}
    </div>
  );
}

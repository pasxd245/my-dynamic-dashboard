import { PageCard, PageHeader } from "@mdd/ui";
import { Button, Space, Steps } from "antd";
import { useEffect, useReducer } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useDatasetsCommitMutation,
  useUploadParseMutation,
} from "../hooks";
import type { CommitBatchItem } from "../types";
import {
  CSV_SHEET_KEY,
  INITIAL_WIZARD_STATE,
  stepIndex,
  type WizardStep,
  wizardReducer,
} from "./state";
import { UploadConfirmStep } from "./UploadConfirmStep";
import { UploadMetadataStep } from "./UploadMetadataStep";
import { UploadSheetStep } from "./UploadSheetStep";
import { UploadSourceStep } from "./UploadSourceStep";

const BREADCRUMB = [
  { label: "Home", route: "/" },
  { label: "Data Management" },
  { label: "Datasets", route: "/data-management/datasets" },
  { label: "New" },
];

export function DatasetNewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD_STATE);
  const parseMutation = useUploadParseMutation();
  const commitMutation = useDatasetsCommitMutation();

  // Pre-fill the workspace from `?workspace=<ws_id>` if present.
  const workspaceQs = searchParams.get("workspace");
  useEffect(() => {
    if (workspaceQs && !state.workspaceId) {
      dispatch({ type: "SET_WORKSPACE", workspaceId: workspaceQs });
    }
  }, [workspaceQs, state.workspaceId]);

  const stepsByFormat: Record<typeof state.sourceFormat, WizardStep[]> = {
    csv: ["source", "metadata", "confirm"],
    excel: ["source", "sheet", "metadata", "confirm"],
  };
  const steps = stepsByFormat[state.sourceFormat];
  const currentIdx = stepIndex(state) - 1;

  const goBack = () => {
    if (currentIdx === 0) {
      navigate("/data-management/datasets");
      return;
    }
    dispatch({ type: "GOTO_STEP", step: steps[currentIdx - 1] });
  };

  const goNext = async () => {
    const next = steps[currentIdx + 1];
    if (!next) return;
    // Excel: when leaving the Sheet step, kick off parses for selected sheets.
    if (state.step === "sheet" && next === "metadata") {
      if (state.selectedSheets.length === 0 || !state.tempId) return;
      for (const sheet of state.selectedSheets) {
        dispatch({ type: "PARSE_SHEET_START", sheet });
      }
      try {
        const res = await parseMutation.mutateAsync({
          tempId: state.tempId,
          body: { items: state.selectedSheets.map((sheet) => ({ sheet })) },
        });
        for (const result of res.results) {
          if (result.status === "ok") {
            dispatch({ type: "PARSE_SHEET_SUCCESS", sheet: result.sheet, result });
          } else {
            dispatch({ type: "PARSE_SHEET_FAILED", sheet: result.sheet, result });
          }
        }
      } catch (err) {
        // Mark all selected as failed with a generic error.
        for (const sheet of state.selectedSheets) {
          dispatch({
            type: "PARSE_SHEET_FAILED",
            sheet,
            result: {
              sheet,
              status: "failed",
              error: "request_failed",
              detail: err instanceof Error ? err.message : "Unknown error",
            },
          });
        }
      }
    }
    dispatch({ type: "GOTO_STEP", step: next });
  };

  const commit = async () => {
    if (!state.tempId || !state.workspaceId) return;
    const isCsv = state.sourceFormat === "csv";
    const sheetKeys = isCsv ? [CSV_SHEET_KEY] : state.selectedSheets;
    const items: CommitBatchItem[] = sheetKeys.map((key) => {
      const s = state.sheets[key];
      const item: CommitBatchItem = { name: s.name };
      if (!isCsv) item.sheet = key;
      if (Object.keys(s.columnOverrides).length > 0) {
        item.column_overrides = s.columnOverrides;
      }
      if (s.excludedColumns.length > 0) {
        item.excluded_columns = s.excludedColumns;
      }
      return item;
    });
    try {
      await commitMutation.mutateAsync({
        workspaceId: state.workspaceId,
        body: { temp_id: state.tempId, items },
      });
      navigate("/data-management/datasets");
    } catch {
      // Error surfaces via mutation.isError; nothing to do here.
    }
  };

  const canAdvance = (() => {
    switch (state.step) {
      case "source":
        return state.tempId !== null && state.workspaceId !== null;
      case "sheet":
        return state.selectedSheets.length > 0;
      case "metadata": {
        const isCsv = state.sourceFormat === "csv";
        const keys = isCsv ? [CSV_SHEET_KEY] : state.selectedSheets;
        return keys.every((k) => state.sheets[k]?.status === "ok");
      }
      case "confirm":
        return false; // handled separately by Commit button
    }
  })();

  const header = (
    <PageHeader
      breadcrumb={BREADCRUMB}
      title="New dataset"
      subtitle="Upload a file and turn it into a queryable dataset."
      onNavigate={(route) => navigate(route)}
      actions={
        <Button onClick={() => navigate("/data-management/datasets")}>
          Cancel
        </Button>
      }
    />
  );

  let body: React.ReactNode;
  switch (state.step) {
    case "source":
      body = <UploadSourceStep state={state} dispatch={dispatch} />;
      break;
    case "sheet":
      body = <UploadSheetStep state={state} dispatch={dispatch} />;
      break;
    case "metadata":
      body = <UploadMetadataStep state={state} dispatch={dispatch} />;
      break;
    case "confirm":
      body = (
        <UploadConfirmStep
          state={state}
          dispatch={dispatch}
          commitError={commitMutation.isError ? commitMutation.error : null}
        />
      );
      break;
  }

  return (
    <>
      {header}
      <PageCard>
        <Steps
          current={currentIdx}
          size="small"
          style={{ marginBottom: 24 }}
          items={steps.map((s) => ({ title: titleCase(s) }))}
        />
        {body}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Button onClick={goBack} data-component="WizardBackButton">
            Back
          </Button>
          <Space>
            {state.step === "confirm" ? (
              <Button
                type="primary"
                onClick={commit}
                loading={commitMutation.isPending}
                disabled={!state.workspaceId}
                data-component="WizardCommitButton"
              >
                Commit
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={goNext}
                disabled={!canAdvance}
                loading={parseMutation.isPending && state.step === "sheet"}
                data-component="WizardNextButton"
              >
                Next
              </Button>
            )}
          </Space>
        </div>
      </PageCard>
    </>
  );
}

function titleCase(step: WizardStep): string {
  return step.charAt(0).toUpperCase() + step.slice(1);
}

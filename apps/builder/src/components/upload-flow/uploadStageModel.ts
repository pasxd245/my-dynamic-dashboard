import type { UploadSourceType } from "../../api/types";

export type UploadStepKey = "workspace" | "source" | "sheet" | "submit";

export interface UploadStepNavItem {
  readonly key: UploadStepKey;
  readonly title: string;
  readonly subtitle: string;
  readonly blockedReason: string | null;
}

export interface UploadStepContext {
  readonly workspaceId: string | null;
  readonly hasSelectedFile: boolean;
  readonly selectedSourceType: UploadSourceType | null;
  readonly requiresSheetSelection: boolean;
  readonly selectedSheetName: string | null;
}

const uploadStepLabels: Record<UploadStepKey, { title: string; subtitle: string }> = {
  workspace: { title: "Workspace", subtitle: "Create or pick workspace" },
  source: { title: "Source", subtitle: "File + source type" },
  sheet: { title: "Sheet", subtitle: "Excel sheet selection" },
  submit: { title: "Submit", subtitle: "Upload and continue" },
};

export function getUploadStepBlockedReason(step: UploadStepKey, context: UploadStepContext): string | null {
  if (step === "workspace") {
    return null;
  }

  if (!context.workspaceId) {
    return "Create a workspace before moving to the next upload stage.";
  }

  if (step === "source") {
    return null;
  }

  if (!context.hasSelectedFile || !context.selectedSourceType) {
    return "Choose a file and source type before opening downstream stages.";
  }

  if (step === "sheet") {
    if (context.selectedSourceType !== "excel") {
      return "Sheet selection is only available for Excel uploads.";
    }
    return null;
  }

  if (context.requiresSheetSelection && !context.selectedSheetName) {
    return "Choose an Excel sheet before continuing to submit.";
  }

  return null;
}

export function deriveUploadStep(context: UploadStepContext): UploadStepKey {
  if (!context.workspaceId) {
    return "workspace";
  }
  if (!context.hasSelectedFile || !context.selectedSourceType) {
    return "source";
  }
  if (context.requiresSheetSelection && !context.selectedSheetName) {
    return "sheet";
  }
  return "submit";
}

export function buildUploadStepNavItems(context: UploadStepContext): UploadStepNavItem[] {
  return (["workspace", "source", "sheet", "submit"] as UploadStepKey[]).map((step) => ({
    key: step,
    title: uploadStepLabels[step].title,
    subtitle: uploadStepLabels[step].subtitle,
    blockedReason: getUploadStepBlockedReason(step, context),
  }));
}

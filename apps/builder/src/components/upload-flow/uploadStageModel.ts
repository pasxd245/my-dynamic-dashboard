import type { UploadSourceType } from "../../api/types";

export type UploadStepKey = "source" | "extract" | "define" | "publish";

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
  source: { title: "Source", subtitle: "Pick source kind + raw input" },
  extract: { title: "Extract", subtitle: "Source-specific reading params" },
  define: { title: "Define", subtitle: "Upload and define schema" },
  publish: { title: "Publish", subtitle: "Commit as a revision (coming soon)" },
};

const WORKSPACE_REQUIRED_REASON =
  "Select or create a workspace before continuing.";
const SOURCE_REQUIRED_REASON =
  "Choose a file and source type before opening downstream stages.";
const SHEET_REQUIRED_REASON =
  "Choose an Excel sheet before continuing.";
const PUBLISH_NOT_READY_REASON =
  "Publish lands in a later round — continue via Define.";

export function getUploadStepBlockedReason(
  step: UploadStepKey,
  context: UploadStepContext,
): string | null {
  if (!context.workspaceId) {
    return WORKSPACE_REQUIRED_REASON;
  }

  if (step === "source") {
    return null;
  }

  if (!context.hasSelectedFile || !context.selectedSourceType) {
    return SOURCE_REQUIRED_REASON;
  }

  if (step === "extract") {
    return null;
  }

  if (context.requiresSheetSelection && !context.selectedSheetName) {
    return SHEET_REQUIRED_REASON;
  }

  if (step === "define") {
    return null;
  }

  // step === "publish"
  return PUBLISH_NOT_READY_REASON;
}

export function deriveUploadStep(context: UploadStepContext): UploadStepKey {
  if (!context.workspaceId) {
    return "source";
  }
  if (!context.hasSelectedFile || !context.selectedSourceType) {
    return "source";
  }
  if (context.requiresSheetSelection && !context.selectedSheetName) {
    return "extract";
  }
  return "define";
}

export function buildUploadStepNavItems(context: UploadStepContext): UploadStepNavItem[] {
  return (["source", "extract", "define", "publish"] as UploadStepKey[]).map((step) => ({
    key: step,
    title: uploadStepLabels[step].title,
    subtitle: uploadStepLabels[step].subtitle,
    blockedReason: getUploadStepBlockedReason(step, context),
  }));
}

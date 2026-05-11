import { useEffect, useMemo, useState } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  FilePlus2,
  Library,
  Workflow,
  ListChecks,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import {
  assignColumnRoles,
  createWorkspace,
  discoverExcelSheets,
  exportManifest,
  getWorkspaceProfile,
  getReadiness,
  importManifest,
  overrideSheet,
  uploadSource,
} from "./api/workspaceApi";
import type {
  ActionableError,
  ManifestResponse,
} from "./api/types";
import { getActionableError } from "./api/httpErrors";
import { setActiveContext } from "./api/builderSessionApi";
import ActionableErrorPanel from "./components/errors/ActionableErrorPanel";
import { PageCard } from "./components/layout";
import ExcelSheetPicker from "./components/upload-flow/ExcelSheetPicker";
import UploadProgressPanel from "./components/upload-flow/UploadProgressPanel";
import SourceTypeSelector from "./components/upload-flow/SourceTypeSelector";
import UploadValidationNotice from "./components/upload-flow/UploadValidationNotice";
import {
  UploadLoadingMask,
  UploadStageSidebar,
  UploadToastStack,
  buildUploadStepNavItems,
  deriveUploadStep,
} from "./components/upload-flow";
import type { AppToast } from "./components/feedback";
import {
  getSourceTypeMismatchMessage,
  isSourceTypeCompatibleWithFilename,
} from "./components/upload-flow/sourceTypeRules";
import QueryBuilderPanel from "./components/query-builder/QueryBuilderPanel";
import { SaveQueryDialog } from "./components/SavedQuery";
import type { SaveQueryResponse } from "./api/queryApi";
import BuilderWorkflowPage from "./pages/BuilderWorkflowPage";
import { SavedQueryLibraryPage, SavedQueryDetail } from "./pages/SavedQueryLibrary";
import { useQueryBuilderStore, useUploadFlowStore } from "./state";

const panelStyle: React.CSSProperties = {
  marginTop: "1.5rem",
  padding: "1rem",
  border: "1px solid #e8e4f5",
  borderRadius: "1rem",
  background: "#ffffff",
  boxShadow: "0 6px 18px rgba(54, 51, 89, 0.06)",
};

const preStyle: React.CSSProperties = {
  padding: "0.75rem",
  overflowX: "auto",
  borderRadius: "0.65rem",
  border: "1px solid #ece8f7",
};

const sidebarSectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontWeight: 700,
  color: "#8d86a7",
  fontFamily: "'Cairo', 'Poppins', sans-serif",
};

const sidebarNavListStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.45rem",
  marginBottom: "1rem",
};

const sidebarLinkBaseStyle: React.CSSProperties = {
  borderRadius: "0.75rem",
  padding: "0.54rem 0.64rem",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "0.9rem",
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  transition: "all 150ms ease",
};

const menuIconStyle: React.CSSProperties = {
  minWidth: "2rem",
  width: "2rem",
  height: "2rem",
  borderRadius: "0.55rem",
  background: "#f1eefb",
  color: "#4f45b6",
  display: "grid",
  placeItems: "center",
  border: "1px solid #e2dcf2",
};

const sidebarSectionToggleStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: 0,
  background: "transparent",
  color: "#8d86a7",
  padding: "0.4rem 0.45rem",
  marginBottom: "0.35rem",
  borderRadius: "0.6rem",
  cursor: "pointer",
  boxShadow: "none",
  fontWeight: 700,
};

const hamburgerButtonStyle: React.CSSProperties = {
  width: "2.4rem",
  height: "2.4rem",
  padding: 0,
  borderRadius: "0.65rem",
  border: "1px solid #e3ddf3",
  background: "#ffffff",
  color: "#4f45b6",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  boxShadow: "none",
};

export default function App(): React.ReactElement {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [headerRow, setHeaderRow] = useState<string>("1");
  const [dataRange, setDataRange] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("identity_key");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [manifestText, setManifestText] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [uploadActionableError, setUploadActionableError] = useState<ActionableError | null>(null);
  const [profileActionableError, setProfileActionableError] = useState<ActionableError | null>(null);
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const [stageGuidanceMessage, setStageGuidanceMessage] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [isQueryMenuExpanded, setQueryMenuExpanded] = useState<boolean>(true);
  const [isWorkflowMenuExpanded, setWorkflowMenuExpanded] = useState<boolean>(true);

  // Saved Queries state
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);

  const {
    workspaceName,
    workspaceId,
    uploadResult,
    profile,
    readiness,
    manifestPreview,
    builderSnapshot,
    loadedSnapshot,
    init: initQueryBuilderStore,
    setWorkspaceName,
    setWorkspaceId,
    setUploadResult,
    setProfile,
    setReadiness,
    setManifestPreview,
    setBuilderSnapshot,
    setLoadedSnapshot,
  } = useQueryBuilderStore();

  const navigate = useNavigate();
  const location = useLocation();
  const {
    focusedStep: focusedUploadStep,
    selectedSourceType,
    selectedSheetName,
    sheetOptions,
    progressState,
    isUploading,
    errorMessage: uploadFlowErrorMessage,
    setFocusedStep,
    setSelectedSourceType,
    setSelectedSheetName,
    setSheetOptions,
    setProgressState,
    setIsUploading,
    setErrorMessage,
    setLastUpload,
  } = useUploadFlowStore();

  useEffect(() => {
    initQueryBuilderStore();
  }, [initQueryBuilderStore]);

  useEffect(() => {
    if (!toasts.length) {
      return;
    }
    const timer = globalThis.window.setTimeout(() => {
      setToasts([]);
    }, 3200);
    return () => globalThis.window.clearTimeout(timer);
  }, [toasts]);

  const currentSheet = useMemo(() => uploadResult?.sheets?.[0] ?? null, [uploadResult]);
  const sourceValidationMessage = useMemo(() => {
    if (!selectedFile) {
      return null;
    }
    if (!selectedSourceType) {
      return "Select a source type before uploading.";
    }
    return getSourceTypeMismatchMessage(selectedSourceType, selectedFile.name);
  }, [selectedFile, selectedSourceType]);
  const requiresSheetSelection = useMemo(
    () => selectedSourceType === "excel" && sheetOptions.length > 1,
    [selectedSourceType, sheetOptions],
  );
  const canUploadSelection = useMemo(() => {
    if (!workspaceId || !selectedFile || !selectedSourceType || isUploading) {
      return false;
    }
    if (!isSourceTypeCompatibleWithFilename(selectedSourceType, selectedFile.name)) {
      return false;
    }
    if (requiresSheetSelection && !selectedSheetName) {
      return false;
    }
    return true;
  }, [workspaceId, selectedFile, selectedSourceType, isUploading, requiresSheetSelection, selectedSheetName]);

  const canAccessSourceStep = Boolean(workspaceId);
  const canAccessSubmitStep = canAccessSourceStep && Boolean(selectedFile) && Boolean(selectedSourceType);
  const shouldShowLoadingMask =
    isUploading || progressState === "validating" || progressState === "discovering_sheets";

  const uploadStepContext = useMemo(
    () => ({
      workspaceId: workspaceId || null,
      hasSelectedFile: Boolean(selectedFile),
      selectedSourceType,
      requiresSheetSelection,
      selectedSheetName,
    }),
    [workspaceId, selectedFile, selectedSourceType, requiresSheetSelection, selectedSheetName],
  );

  const detectedUploadStep = useMemo(() => deriveUploadStep(uploadStepContext), [uploadStepContext]);

  useEffect(() => {
    setFocusedStep(detectedUploadStep);
    setStageGuidanceMessage(null);
  }, [detectedUploadStep, setFocusedStep]);

  const stepNavItems = useMemo(() => buildUploadStepNavItems(uploadStepContext), [uploadStepContext]);

  const pushToast = (tone: AppToast["tone"], text: string): void => {
    setToasts([
      {
        id: `${Date.now()}`,
        tone,
        text,
      },
    ]);
  };

  const loadingMaskCopyByState: Partial<Record<typeof progressState, string>> = {
    discovering_sheets: "Reading workbook sheets",
    validating: "Validating file and source type",
    uploading: "Uploading source to workspace",
  };

  const loadingMaskMessage = loadingMaskCopyByState[progressState] ?? "Uploading source to workspace";

  const routeMeta = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/workflow")) {
      if (path.includes("query")) {
        return {
          section: "Workflow Management",
          title: "Workflow Query Stage",
          subtitle: "Review and execute workflow query stages.",
        };
      }
      return {
        section: "Workflow Management",
        title: "Workflow Builder",
        subtitle: "Build and run upload-to-workflow stages.",
      };
    }
    if (path.startsWith("/saved-queries")) {
      return {
        section: "Query Management",
        title: "Queries Management",
        subtitle: "Browse, review, and reuse saved queries.",
      };
    }
    return {
      section: "Query Management",
      title: "Create Query",
      subtitle: "Create and validate a query from the builder workspace.",
    };
  }, [location.pathname]);

  const sidebarNavLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    ...sidebarLinkBaseStyle,
    color: isActive ? "#352f74" : "#7f7999",
    background: isActive ? "#ffffff" : "transparent",
    border: isActive ? "1px solid #e1dbf0" : "1px solid transparent",
    boxShadow: isActive ? "0 4px 14px rgba(58, 51, 102, 0.08)" : "none",
  });

  const collapsedRailLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    width: "2.2rem",
    height: "2.2rem",
    borderRadius: "0.6rem",
    display: "grid",
    placeItems: "center",
    color: isActive ? "#ffffff" : "#5a5297",
    background: isActive ? "#4f45b6" : "transparent",
    border: isActive ? "1px solid #4f45b6" : "1px solid transparent",
    textDecoration: "none",
    transition: "all 150ms ease",
  });

  const onCreateWorkspace = async (): Promise<void> => {
    try {
      const payload = await createWorkspace(workspaceName);
      setWorkspaceId(payload.id);
      setUploadActionableError(null);
      setProfileActionableError(null);
      setProgressState("idle");
      setErrorMessage(null);
      setStageGuidanceMessage(null);
      setMessage(`Workspace created: ${payload.id}`);
      pushToast("success", `Workspace ${payload.id} is ready.`);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Unknown error";
      setMessage(nextMessage);
      pushToast("error", nextMessage);
    }
  };

  const onUpload = async (): Promise<void> => {
    if (!workspaceId || !selectedFile || !selectedSourceType) {
      setMessage("Create workspace, choose source type, and select a file first.");
      pushToast("info", "Complete workspace, source type, and file selection first.");
      return;
    }

    if (!isSourceTypeCompatibleWithFilename(selectedSourceType, selectedFile.name)) {
      const nextMessage =
        getSourceTypeMismatchMessage(selectedSourceType, selectedFile.name) ?? "Invalid source/file combination.";
      setMessage(nextMessage);
      pushToast("error", nextMessage);
      return;
    }

    try {
      setProgressState("validating");
      setUploadActionableError(null);
      setErrorMessage(null);
      setMessage(`Uploading ${selectedFile.name}...`);
      let resolvedSheetName = selectedSheetName;

      if (selectedSourceType === "excel" && !resolvedSheetName) {
        setProgressState("discovering_sheets");
        const discovery = await discoverExcelSheets(workspaceId, selectedFile);
        setSheetOptions(discovery.options);

        if (discovery.requires_sheet_selection) {
          setMessage("Choose an Excel sheet before uploading.");
          setProgressState("idle");
          setFocusedStep("sheet");
          pushToast("info", "Select an Excel sheet to continue.");
          return;
        }

        resolvedSheetName = discovery.options[0]?.name ?? null;
        setSelectedSheetName(resolvedSheetName);
      }

      const payload = await uploadSource(workspaceId, selectedFile, {
        sourceType: selectedSourceType,
        sheetName: resolvedSheetName ?? undefined,
        lifecycle: {
          onStart: () => {
            setIsUploading(true);
            setProgressState("uploading");
          },
          onSuccess: (response) => {
            setLastUpload(response);
            setProgressState("success");
          },
          onError: (error) => {
            setProgressState("error");
            setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
          },
          onSettled: () => {
            setIsUploading(false);
          },
        },
      });
      setUploadResult(payload);
      setLastUpload(payload);
      setDataRange(payload.sheets?.[0]?.data_range_effective ?? "");
      setHeaderRow(String(payload.sheets?.[0]?.header_row_effective ?? 1));
      await setActiveContext({
        workspace_id: workspaceId,
        source_id: payload.source_id,
      });
      setMessage("Upload complete. Workflow context is ready.");
      pushToast("success", "Upload complete. Opening workflow stage.");
      navigate("/workflow/schema-sheet");
    } catch (error) {
      setUploadActionableError(getActionableError(error));
      setProgressState("error");
      const nextMessage = error instanceof Error ? error.message : "Unknown error";
      setErrorMessage(nextMessage);
      setMessage(nextMessage);
      pushToast("error", nextMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const onSelectedFileChange = (file: File | null): void => {
    setSelectedFile(file);
    setSelectedSheetName(null);
    setSheetOptions([]);
    setProgressState("idle");
    setErrorMessage(null);
    setStageGuidanceMessage(null);
    if (file) {
      pushToast("info", `${file.name} selected.`);
    }
  };

  const onOverride = async (): Promise<void> => {
    if (!workspaceId || !currentSheet) {
      setMessage("Upload a source first.");
      return;
    }

    try {
      setProfileActionableError(null);
      const payload = await overrideSheet(workspaceId, currentSheet.id, {
        header_row: Number(headerRow),
        data_range: dataRange,
        reason,
      });
      setUploadResult(
        uploadResult
          ? {
              ...uploadResult,
              sheets: [payload],
            }
          : null,
      );
      setMessage("Override applied.");
    } catch (error) {
      setProfileActionableError(getActionableError(error));
      setMessage(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const onLoadProfile = async (): Promise<void> => {
    if (!workspaceId) {
      setMessage("Create workspace first.");
      return;
    }

    try {
      setProfileActionableError(null);
      const payload = await getWorkspaceProfile(workspaceId);
      setProfile(payload);
      setSelectedColumnId(payload.columns?.[0]?.column_id ?? "");
      setMessage("Profile loaded.");
    } catch (error) {
      setProfileActionableError(getActionableError(error));
      setMessage(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const onAssignRole = async (): Promise<void> => {
    if (!workspaceId || !selectedColumnId) {
      setMessage("Load profile and choose a column first.");
      return;
    }

    try {
      setProfileActionableError(null);
      await assignColumnRoles(workspaceId, selectedColumnId, {
        roles: [selectedRole],
        override_reason: overrideReason || null,
      });
      setMessage(`Role ${selectedRole} assigned.`);
    } catch (error) {
      setProfileActionableError(getActionableError(error));
      setMessage(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const onLoadReadiness = async (): Promise<void> => {
    if (!workspaceId) {
      setMessage("Create workspace first.");
      return;
    }

    try {
      setProfileActionableError(null);
      const payload = await getReadiness(workspaceId);
      setReadiness(payload);
      setMessage("Readiness loaded.");
    } catch (error) {
      setProfileActionableError(getActionableError(error));
      setMessage(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const onExportManifest = async (): Promise<void> => {
    if (!workspaceId) {
      setMessage("Create workspace first.");
      return;
    }

    try {
      const payload = await exportManifest(workspaceId);
      setManifestPreview(payload);
      setManifestText(JSON.stringify(payload, null, 2));
      setMessage("Manifest exported.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const onImportManifest = async (): Promise<void> => {
    if (!manifestText.trim()) {
      setMessage("Paste or export a manifest first.");
      return;
    }

    try {
      const manifest = JSON.parse(manifestText) as ManifestResponse;
      const payload = await importManifest(manifest);
      setWorkspaceId(payload.id);
      setWorkspaceName(payload.name);
      setUploadResult(null);
      setProfile(null);
      setReadiness(null);
      setMessage(`Manifest imported into workspace: ${payload.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const workflowUploadSourcePanel = (
    <section
      style={{
        ...panelStyle,
        position: "relative",
        padding: 0,
        overflow: "hidden",
        borderColor: "#d5d7f2",
        background: "#f8f8ff",
      }}
    >
      <UploadLoadingMask visible={shouldShowLoadingMask} message={loadingMaskMessage} />
      <UploadToastStack toasts={toasts} />

      <div
        data-testid="guided-upload-layout"
        style={{
          display: "flex",
          flexWrap: "wrap",
          minHeight: "25rem",
        }}
      >
        <UploadStageSidebar
          items={stepNavItems}
          activeStep={focusedUploadStep}
          onSelectStep={(step) => {
            setStageGuidanceMessage(null);
            setFocusedStep(step);
          }}
          blockNavigation={shouldShowLoadingMask}
          onBlockedSelect={(_step, reason) => {
            setStageGuidanceMessage(reason);
            pushToast("info", reason);
          }}
        />

        <div
          style={{
            flex: "1 1 22rem",
            minWidth: "16rem",
            padding: "1rem 1.2rem",
            display: "grid",
            gap: "0.9rem",
            background: "#fcfcff",
          }}
        >
          <header>
            <h2 style={{ marginBottom: "0.3rem" }}>Guided Upload</h2>
            <p style={{ margin: 0, color: "#566099" }}>
              Workspace: <strong>{workspaceId || "(create one first)"}</strong>
            </p>
          </header>

          {uploadActionableError ? <ActionableErrorPanel error={uploadActionableError} /> : null}
          <UploadValidationNotice message={stageGuidanceMessage} />

          {focusedUploadStep === "workspace" ? (
            <section style={{ display: "grid", gap: "0.65rem", maxWidth: "30rem" }}>
              <label htmlFor="workspace-name" style={{ fontWeight: 600, color: "#252d5a" }}>
                Workspace name
              </label>
              <input
                id="workspace-name"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="Workspace name"
                style={{ padding: "0.55rem", borderRadius: "0.5rem", border: "1px solid #cbd2f9" }}
              />
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button onClick={onCreateWorkspace}>Create workspace</button>
                <button
                  type="button"
                  onClick={() => setFocusedStep("source")}
                  disabled={!canAccessSourceStep}
                >
                  Next: source
                </button>
              </div>
            </section>
          ) : null}

          {focusedUploadStep === "source" ? (
            <section style={{ display: "grid", gap: "0.7rem", maxWidth: "34rem" }}>
              <input
                type="file"
                accept=".csv,.xlsx,.xlsm,.xlsb,.xls"
                onChange={(event) => onSelectedFileChange(event.currentTarget.files?.[0] ?? null)}
              />
              <SourceTypeSelector value={selectedSourceType} onChange={setSelectedSourceType} disabled={!workspaceId} />
              <UploadValidationNotice message={sourceValidationMessage} />
              <p style={{ margin: 0, color: "#49548f" }}>
                {selectedFile ? `Selected file: ${selectedFile.name}` : "Select a CSV/Excel file to continue."}
              </p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setFocusedStep("workspace")}>Back</button>
                <button
                  type="button"
                  onClick={() => setFocusedStep(requiresSheetSelection ? "sheet" : "submit")}
                  disabled={!canAccessSubmitStep}
                >
                  Next
                </button>
              </div>
            </section>
          ) : null}

          {focusedUploadStep === "sheet" ? (
            <section style={{ display: "grid", gap: "0.7rem", maxWidth: "34rem" }}>
              <ExcelSheetPicker
                options={sheetOptions}
                value={selectedSheetName}
                onChange={setSelectedSheetName}
                disabled={isUploading}
              />
              {requiresSheetSelection ? null : (
                <p style={{ margin: 0, color: "#49548f" }}>
                  This file does not require sheet selection. Continue to submit.
                </p>
              )}
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setFocusedStep("source")}>Back</button>
                <button
                  type="button"
                  onClick={() => setFocusedStep("submit")}
                  disabled={requiresSheetSelection && !selectedSheetName}
                >
                  Next: submit
                </button>
              </div>
            </section>
          ) : null}

          {focusedUploadStep === "submit" ? (
            <section style={{ display: "grid", gap: "0.7rem", maxWidth: "34rem" }}>
              <button onClick={onUpload} disabled={!canUploadSelection} style={{ justifySelf: "start" }}>
                {isUploading ? "Uploading..." : "Upload and continue"}
              </button>
              {(progressState !== "idle" || uploadFlowErrorMessage) ? (
                <UploadProgressPanel state={progressState} message={uploadFlowErrorMessage ?? message} />
              ) : null}
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button type="button" onClick={() => setFocusedStep(requiresSheetSelection ? "sheet" : "source")}>
                  Back
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );

  const workflowSchemaSheetPanel = (
    <>
      <section style={panelStyle}>
        <h2>Sheet Override</h2>
        {profileActionableError && profileActionableError.stage !== "upload_source" ? (
          <ActionableErrorPanel error={profileActionableError} />
        ) : null}
        <div style={{ display: "grid", gap: "0.5rem", maxWidth: "400px" }}>
          <input
            value={headerRow}
            onChange={(event) => setHeaderRow(event.target.value)}
            placeholder="Header row"
          />
          <input
            value={dataRange}
            onChange={(event) => setDataRange(event.target.value)}
            placeholder="Data range (e.g. A1:C100)"
          />
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Override reason"
          />
          <button onClick={onOverride}>Apply override</button>
        </div>
      </section>

      <section style={panelStyle}>
        <h2>Profiles and Roles</h2>
        <button onClick={onLoadProfile} style={{ marginBottom: "0.75rem" }}>
          Load profile
        </button>
        <div style={{ display: "grid", gap: "0.5rem", maxWidth: "520px", marginBottom: "1rem" }}>
          <select
            value={selectedColumnId}
            onChange={(event) => setSelectedColumnId(event.target.value)}
          >
            <option value="">Select column</option>
            {(profile?.columns ?? []).map((column) => (
              <option key={column.column_id} value={column.column_id}>
                {column.column_name} ({column.column_id})
              </option>
            ))}
          </select>
          <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
            <option value="identity_key">identity_key</option>
            <option value="time_anchor">time_anchor</option>
            <option value="measure">measure</option>
            <option value="dimension">dimension</option>
            <option value="status">status</option>
            <option value="source_of_truth_outcome">source_of_truth_outcome</option>
          </select>
          <input
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            placeholder="Override reason (optional)"
          />
          <div>
            <button onClick={onAssignRole} style={{ marginRight: "0.5rem" }}>
              Assign role
            </button>
            <button onClick={onLoadReadiness}>Load readiness</button>
          </div>
        </div>
      </section>
    </>
  );

  return (
    <main
      style={{
        fontFamily: "'Cairo', 'Nunito Sans', 'Segoe UI', sans-serif",
        padding: "0",
        margin: 0,
        color: "#2f2d36",
        background: "#f5f4f8",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          minHeight: "100vh",
        }}
      >
        <aside
          style={{
            flex: isSidebarOpen ? "0 0 16rem" : "0 0 3.2rem",
            borderRight: "1px solid #e7e2f0",
            background: "#f0eef5",
            padding: isSidebarOpen ? "1rem 0.75rem" : "0.75rem 0.35rem",
            position: "sticky",
            top: "0",
            height: "100vh",
            transition: "all 180ms ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            {isSidebarOpen ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                <span
                  style={{
                    width: "2rem",
                    height: "2rem",
                    borderRadius: "0.65rem",
                    background: "#4f45b6",
                    color: "#fcfcfc",
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  M
                </span>
                <h1 style={{ margin: 0, fontSize: "1rem", color: "#4a4472" }}>Builder</h1>
              </div>
            ) : null}
            <button
              type="button"
              aria-label={isSidebarOpen ? "Hide sidebar menu" : "Show sidebar menu"}
              onClick={() => setSidebarOpen((current) => !current)}
              style={hamburgerButtonStyle}
            >
              <Menu size={18} strokeWidth={2.2} />
            </button>
          </div>

          {isSidebarOpen ? (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <button
                  type="button"
                  onClick={() => setQueryMenuExpanded((current) => !current)}
                  aria-expanded={isQueryMenuExpanded}
                  style={sidebarSectionToggleStyle}
                >
                  <h2 style={sidebarSectionTitleStyle}>Query Management</h2>
                  <span style={{ color: "#8f89ad", display: "grid", placeItems: "center" }}>
                    {isQueryMenuExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </button>
                {isQueryMenuExpanded ? (
                  <nav style={{ ...sidebarNavListStyle, marginBottom: 0 }} aria-label="query-management">
                    <NavLink to="/" end style={sidebarNavLinkStyle}>
                      <span style={menuIconStyle}>
                        <FilePlus2 size={16} strokeWidth={2} />
                      </span>
                      <span>Create Query</span>
                    </NavLink>
                    <NavLink to="/saved-queries" style={sidebarNavLinkStyle}>
                      <span style={menuIconStyle}>
                        <Library size={16} strokeWidth={2} />
                      </span>
                      <span>Queries Management</span>
                    </NavLink>
                  </nav>
                ) : null}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setWorkflowMenuExpanded((current) => !current)}
                  aria-expanded={isWorkflowMenuExpanded}
                  style={sidebarSectionToggleStyle}
                >
                  <h2 style={sidebarSectionTitleStyle}>Workflow Management</h2>
                  <span style={{ color: "#8f89ad", display: "grid", placeItems: "center" }}>
                    {isWorkflowMenuExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                </button>
                {isWorkflowMenuExpanded ? (
                  <nav style={{ ...sidebarNavListStyle, marginBottom: 0 }} aria-label="workflow-management">
                    <NavLink to="/workflow/upload-source" style={sidebarNavLinkStyle}>
                      <span style={menuIconStyle}>
                        <Workflow size={16} strokeWidth={2} />
                      </span>
                      <span>Workflow Builder</span>
                    </NavLink>
                    <NavLink to="/workflow/query" style={sidebarNavLinkStyle}>
                      <span style={menuIconStyle}>
                        <ListChecks size={16} strokeWidth={2} />
                      </span>
                      <span>Workflow Query Stage</span>
                    </NavLink>
                  </nav>
                ) : null}
              </div>
            </>
          ) : (
            <nav
              aria-label="Sidebar rail"
              style={{ display: "grid", gap: "0.5rem", justifyItems: "center", marginTop: "0.25rem" }}
            >
              <NavLink to="/" end title="Create Query" style={collapsedRailLinkStyle}>
                <FilePlus2 size={18} strokeWidth={2} />
              </NavLink>
              <NavLink to="/saved-queries" title="Queries Management" style={collapsedRailLinkStyle}>
                <Library size={18} strokeWidth={2} />
              </NavLink>
              <span style={{ height: 1, width: "70%", background: "#e2dcf2", margin: "0.25rem 0" }} />
              <NavLink to="/workflow/upload-source" title="Workflow Builder" style={collapsedRailLinkStyle}>
                <Workflow size={18} strokeWidth={2} />
              </NavLink>
              <NavLink to="/workflow/query" title="Workflow Query Stage" style={collapsedRailLinkStyle}>
                <ListChecks size={18} strokeWidth={2} />
              </NavLink>
            </nav>
          )}
        </aside>

        <section style={{ flex: "1 1 0", minWidth: 0, maxWidth: "none", padding: "1rem 1.1rem 1.5rem 1.1rem" }}>
          <div
            style={{
              borderRadius: "var(--radius-xl)",
              background: "var(--color-white)",
              minHeight: "4.6rem",
              padding: "0.75rem 1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.85rem",
              boxShadow: "0 6px 16px rgba(55, 49, 95, 0.04)",
            }}
          >
            <div
              style={{
                position: "relative",
                flex: "1 1 22rem",
                maxWidth: "26rem",
                display: "flex",
                alignItems: "center",
                background: "var(--color-gray-1)",
                borderRadius: "var(--radius-xl)",
                padding: "0.15rem 1rem 0.15rem 0.85rem",
              }}
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                style={{ color: "var(--color-blue)", flex: "none" }}
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                aria-label="Search"
                placeholder="Search here..."
                style={{
                  width: "100%",
                  padding: "0.65rem 0.5rem 0.65rem 0.65rem",
                  border: 0,
                  background: "transparent",
                  color: "var(--color-dark-blue)",
                  fontFamily: "'Cairo', sans-serif",
                  fontSize: "0.95rem",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.45rem 0.85rem",
                  border: "2px solid var(--color-gray-1)",
                  borderRadius: "var(--radius-xl)",
                  background: "var(--color-white)",
                }}
              >
                <svg aria-hidden="true" width="22" height="16" viewBox="0 0 22 16">
                  <rect width="22" height="16" rx="2" fill="#b22234" />
                  <g fill="#ffffff">
                    <rect y="2" width="22" height="1.3" />
                    <rect y="4.6" width="22" height="1.3" />
                    <rect y="7.2" width="22" height="1.3" />
                    <rect y="9.8" width="22" height="1.3" />
                    <rect y="12.4" width="22" height="1.3" />
                  </g>
                  <rect width="9" height="7" fill="#3c3b6e" />
                </svg>
                <span style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "var(--color-black)" }}>
                  English
                </span>
                <span style={{ color: "var(--color-gray-3)", fontSize: "0.7rem" }}>▾</span>
              </div>
              <button
                type="button"
                aria-label="Notifications"
                style={{
                  position: "relative",
                  width: "2.6rem",
                  height: "2.6rem",
                  padding: 0,
                  background: "var(--color-gray-2)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-blue)",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "none",
                }}
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3a6 6 0 0 0-6 6v3.4l-1.4 2.1A1 1 0 0 0 5.4 16h13.2a1 1 0 0 0 .8-1.5L18 12.4V9a6 6 0 0 0-6-6Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span
                  style={{
                    position: "absolute",
                    top: "-0.3rem",
                    right: "-0.3rem",
                    minWidth: "1.25rem",
                    height: "1.25rem",
                    padding: "0 0.3rem",
                    background: "var(--color-blue)",
                    color: "var(--color-white)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  0
                </span>
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", paddingLeft: "0.4rem" }}>
                <span
                  style={{
                    width: "2.6rem",
                    height: "2.6rem",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-gray-4)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--color-white)",
                    fontWeight: 700,
                  }}
                >
                  AD
                </span>
                <div style={{ display: "grid", lineHeight: 1.2 }}>
                  <span style={{ fontFamily: "'Cairo', sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "var(--color-black)" }}>
                    Hello There!
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "var(--color-gray-4)" }}>Admin</span>
                </div>
              </div>
            </div>
          </div>
          <header
            style={{
              border: "1px solid #e8e2f5",
              borderRadius: "1rem",
              padding: "0.9rem 1rem",
              background: "#ffffff",
              marginBottom: "0.9rem",
              marginTop: "0.85rem",
              boxShadow: "0 6px 16px rgba(55, 49, 95, 0.06)",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#8f88ab", fontWeight: 600 }}>
              Builder / {routeMeta.section} / {routeMeta.title}
            </p>
            <h1 style={{ margin: "0.25rem 0 0.2rem 0", fontSize: "1.55rem", color: "#2f2b3a" }}>{routeMeta.title}</h1>
            <p style={{ margin: 0, color: "#77718f" }}>{routeMeta.subtitle}</p>
          </header>
          <Routes>
        {/* Main builder page */}
        <Route
          path="/"
          element={
            <PageCard>
              <p>Upload, profile, role assignment, readiness, and manifest reproducibility flow.</p>

              {workflowUploadSourcePanel}

              <section style={panelStyle}>
                <h2>Sheet Override</h2>
                {profileActionableError && profileActionableError.stage !== "upload_source" ? (
                  <ActionableErrorPanel error={profileActionableError} />
                ) : null}
                <div style={{ display: "grid", gap: "0.5rem", maxWidth: "400px" }}>
                  <input
                    value={headerRow}
                    onChange={(event) => setHeaderRow(event.target.value)}
                    placeholder="Header row"
                  />
                  <input
                    value={dataRange}
                    onChange={(event) => setDataRange(event.target.value)}
                    placeholder="Data range (e.g. A1:C100)"
                  />
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Override reason"
                  />
                  <button onClick={onOverride}>Apply override</button>
                </div>
              </section>

              <section style={panelStyle}>
                <h2>Profiles and Roles</h2>
                {profileActionableError && profileActionableError.stage !== "upload_source" ? (
                  <div style={{ marginBottom: "0.75rem" }}>
                    <ActionableErrorPanel error={profileActionableError} />
                  </div>
                ) : null}
                <p>
                  <strong>Workspace:</strong> {workspaceId || "(none)"}
                </p>
                <button onClick={onLoadProfile} style={{ marginBottom: "0.75rem" }}>
                  Load profile
                </button>
                <div style={{ display: "grid", gap: "0.5rem", maxWidth: "520px", marginBottom: "1rem" }}>
                  <select
                    value={selectedColumnId}
                    onChange={(event) => setSelectedColumnId(event.target.value)}
                  >
                    <option value="">Select column</option>
                    {(profile?.columns ?? []).map((column) => (
                      <option key={column.column_id} value={column.column_id}>
                        {column.column_name} ({column.column_id})
                      </option>
                    ))}
                  </select>
                  <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
                    <option value="identity_key">identity_key</option>
                    <option value="time_anchor">time_anchor</option>
                    <option value="measure">measure</option>
                    <option value="dimension">dimension</option>
                    <option value="status">status</option>
                    <option value="source_of_truth_outcome">source_of_truth_outcome</option>
                  </select>
                  <input
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    placeholder="Override reason (optional)"
                  />
                  <div>
                    <button onClick={onAssignRole} style={{ marginRight: "0.5rem" }}>
                      Assign role
                    </button>
                    <button onClick={onLoadReadiness}>Load readiness</button>
                  </div>
                </div>
              </section>

              <section style={panelStyle}>
                <QueryBuilderPanel
                  workspaceId={workspaceId || undefined}
                  initialSnapshot={loadedSnapshot}
                  onSaveRequest={(snapshot) => {
                    setBuilderSnapshot(snapshot);
                    setShowSaveDialog(true);
                  }}
                />
              </section>

              <section style={panelStyle}>
                <h2>Manifest</h2>
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                  <button onClick={onExportManifest}>Export manifest</button>
                  <button onClick={onImportManifest}>Import manifest</button>
                </div>
                <textarea
                  value={manifestText}
                  onChange={(event) => setManifestText(event.target.value)}
                  placeholder="Exported manifest JSON appears here, or paste one to import."
                  rows={14}
                  style={{ width: "100%", padding: "0.75rem", fontFamily: "monospace" }}
                />
              </section>

              <section style={panelStyle}>
                <h2>State</h2>
                <pre style={{ ...preStyle, background: "#f4f4f4" }}>
                  {JSON.stringify(uploadResult, null, 2)}
                </pre>
                <pre style={{ ...preStyle, background: "#eef7ff" }}>
                  {JSON.stringify(profile, null, 2)}
                </pre>
                <pre style={{ ...preStyle, background: "#ecfff3" }}>
                  {JSON.stringify(readiness, null, 2)}
                </pre>
                <pre style={{ ...preStyle, background: "#fff4df" }}>
                  {JSON.stringify(manifestPreview, null, 2)}
                </pre>
                <p>{message}</p>
              </section>
            </PageCard>
          }
        />

        {/* Saved Queries Library */}
        <Route
          path="/saved-queries"
          element={
            <PageCard>
              <SavedQueryLibraryPage workspaceId={workspaceId || "default"} />
            </PageCard>
          }
        />

        {/* Saved Query Detail */}
        <Route
          path="/saved-queries/:queryId"
          element={
            <PageCard>
              <SavedQueryDetail
                workspaceId={workspaceId || "default"}
                onLoadInBuilder={(snapshot) => {
                  setLoadedSnapshot(snapshot);
                  navigate("/");
                }}
              />
            </PageCard>
          }
        />

        {/* Workflow shell */}
        <Route
          path="/workflow/*"
          element={
            <BuilderWorkflowPage
              uploadSourcePanel={workflowUploadSourcePanel}
              schemaSheetPanel={workflowSchemaSheetPanel}
              queryPanel={<QueryBuilderPanel workspaceId={workspaceId || undefined} initialSnapshot={loadedSnapshot} />}
              resultsSavedPanel={
                workspaceId ? (
                  <SavedQueryLibraryPage workspaceId={workspaceId} />
                ) : (
                  <p className="text-sm text-slate-700">Create/select a workspace to view saved queries.</p>
                )
              }
            />
          }
        />
      </Routes>
        </section>
      </div>

      {/* Save Query Dialog — rendered at app level so it can receive builder snapshot */}
      {showSaveDialog && builderSnapshot && (
        <SaveQueryDialog
          isOpen={showSaveDialog}
          workspaceId={workspaceId || "default"}
          builderSnapshot={builderSnapshot}
          onSave={(_response: SaveQueryResponse) => {
            setShowSaveDialog(false);
            setBuilderSnapshot(null);
          }}
          onClose={() => {
            setShowSaveDialog(false);
            setBuilderSnapshot(null);
          }}
        />
      )}
    </main>
  );
}

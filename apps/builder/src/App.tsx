import { useEffect, useMemo, useState } from "react";
import { App as AntApp, Avatar, Badge, Button, Dropdown, Input, Space } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { FilePlus2, Library, Workflow, ListChecks } from "lucide-react";
import { AppShell, PageHeader } from "./components/ui";
import type { AppShellNavGroup } from "./components/ui";

import {
  assignColumnRoles,
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
import { ProfilePanel } from "./components/profile";
import ExcelSheetPicker from "./components/upload-flow/ExcelSheetPicker";
import UploadProgressPanel from "./components/upload-flow/UploadProgressPanel";
import SourceTypeSelector from "./components/upload-flow/SourceTypeSelector";
import UploadValidationNotice from "./components/upload-flow/UploadValidationNotice";
import {
  UploadLoadingMask,
  UploadStageSidebar,
  buildUploadStepNavItems,
  deriveUploadStep,
} from "./components/upload-flow";
import {
  getSourceTypeMismatchMessage,
  isSourceTypeCompatibleWithFilename,
} from "./components/upload-flow/sourceTypeRules";
import QueryBuilderPanel from "./components/query-builder/QueryBuilderPanel";
import { SaveQueryDialog } from "./components/SavedQuery";
import { WorkspacePicker } from "./components/workspace";
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

const NAV_GROUPS: AppShellNavGroup[] = [
  {
    key: "data-management",
    title: "Data Management",
    items: [
      { key: "data-upload", to: "/", label: "Data Upload", icon: <FilePlus2 size={16} /> },
      { key: "saved-queries", to: "/saved-queries", label: "Saved Queries", icon: <Library size={16} /> },
    ],
  },
  {
    key: "workflow-management",
    title: "Workflow Management",
    items: [
      { key: "workflow-builder", to: "/workflow/upload-source", label: "Workflow Builder", icon: <Workflow size={16} /> },
      { key: "workflow-query", to: "/workflow/query", label: "Workflow Query Stage", icon: <ListChecks size={16} /> },
    ],
  },
];

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
  const [stageGuidanceMessage, setStageGuidanceMessage] = useState<string | null>(null);
  const [isWorkspacePickerOpen, setWorkspacePickerOpen] = useState<boolean>(false);

  const { message: messageApi } = AntApp.useApp();

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

  const pushToast = (tone: "success" | "info" | "error", text: string): void => {
    messageApi?.[tone]?.(text);
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
        section: "Data Management",
        title: "Saved Queries",
        subtitle: "Browse, review, and reuse saved queries.",
      };
    }
    return {
      section: "Data Management",
      title: "Data Upload",
      subtitle: "Select workspace context and prepare data sources for workflow stages.",
    };
  }, [location.pathname]);

  const onWorkspaceSelected = (workspace: { id: string; name: string }): void => {
    setWorkspaceId(workspace.id);
    setWorkspaceName(workspace.name);
    setUploadActionableError(null);
    setProfileActionableError(null);
    setProgressState("idle");
    setErrorMessage(null);
    setStageGuidanceMessage(null);
    setWorkspacePickerOpen(false);
    setMessage(`Active workspace: ${workspace.name}`);
    pushToast("success", `Workspace ${workspace.name} is active.`);
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
              <p style={{ margin: 0, color: "#49548f" }}>
                {workspaceId
                  ? `Active workspace: ${workspaceName || workspaceId}`
                  : "Select an existing workspace or create a new one before continuing."}
              </p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <Button type="primary" onClick={() => setWorkspacePickerOpen(true)}>
                  Select or create workspace
                </Button>
                <Button
                  onClick={() => setFocusedStep("source")}
                  disabled={!canAccessSourceStep}
                >
                  Next: source
                </Button>
              </div>
              <WorkspacePicker
                visible={isWorkspacePickerOpen}
                onWorkspaceSelected={onWorkspaceSelected}
                onClose={() => setWorkspacePickerOpen(false)}
              />
            </section>
          ) : null}

          {focusedUploadStep === "source" ? (
            <section style={{ display: "grid", gap: "0.7rem", maxWidth: "34rem" }}>
              <input
                className="upload-file-input"
                type="file"
                accept=".csv,.xlsx,.xlsm,.xlsb,.xls"
                onChange={(event) => onSelectedFileChange(event.currentTarget.files?.[0] ?? null)}
              />
              <SourceTypeSelector value={selectedSourceType} onChange={setSelectedSourceType} disabled={!workspaceId} />
              <UploadValidationNotice message={sourceValidationMessage} />
              <p style={{ margin: 0, color: "#49548f" }}>
                {selectedFile ? `Selected file: ${selectedFile.name}` : "Select a CSV/Excel file to continue."}
              </p>
              <p className="upload-control-help">
                Excel handling is single-sheet per upload: selected sheet is loaded, other sheets are ignored.
              </p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <Button onClick={() => setFocusedStep("workspace")}>Back</Button>
                <Button
                  onClick={() => setFocusedStep(requiresSheetSelection ? "sheet" : "submit")}
                  disabled={!canAccessSubmitStep}
                >
                  Next
                </Button>
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
              <p className="upload-control-help">
                For workbooks with multiple sheets, choose one sheet to ingest in this run.
              </p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <Button onClick={() => setFocusedStep("source")}>Back</Button>
                <Button
                  onClick={() => setFocusedStep("submit")}
                  disabled={requiresSheetSelection && !selectedSheetName}
                >
                  Next: submit
                </Button>
              </div>
            </section>
          ) : null}

          {focusedUploadStep === "submit" ? (
            <section style={{ display: "grid", gap: "0.7rem", maxWidth: "34rem" }}>
              <Button type="primary" onClick={onUpload} disabled={!canUploadSelection} style={{ justifySelf: "start" }}>
                {isUploading ? "Uploading..." : "Upload and continue"}
              </Button>
              {(progressState !== "idle" || uploadFlowErrorMessage) ? (
                <UploadProgressPanel state={progressState} message={uploadFlowErrorMessage ?? message} />
              ) : null}
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <Button onClick={() => setFocusedStep(requiresSheetSelection ? "sheet" : "source")}>
                  Back
                </Button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );

  const workflowSchemaSheetPanel = (
    <ProfilePanel
      profile={profile}
      profileError={profileActionableError}
      headerRow={headerRow}
      dataRange={dataRange}
      reason={reason}
      onHeaderRowChange={setHeaderRow}
      onDataRangeChange={setDataRange}
      onReasonChange={setReason}
      onApplyOverride={onOverride}
      onLoadProfile={onLoadProfile}
      selectedColumnId={selectedColumnId}
      onSelectColumn={setSelectedColumnId}
      selectedRole={selectedRole}
      onSelectRole={setSelectedRole}
      overrideReason={overrideReason}
      onOverrideReasonChange={setOverrideReason}
      onAssignRole={onAssignRole}
      onLoadReadiness={onLoadReadiness}
    />
  );

  return (
    <AppShell
      navGroups={NAV_GROUPS}
      header={
        <>
          <Input.Search
            placeholder="Search here..."
            allowClear
            style={{ flex: "1 1 280px", maxWidth: 360 }}
          />
          <Space size={12}>
            <Dropdown
              menu={{
                items: [
                  { key: "en", label: "English" },
                  { key: "vi", label: "Tiếng Việt" },
                ],
              }}
            >
              <Button>English</Button>
            </Dropdown>
            <Badge count={0} showZero={false}>
              <Button shape="circle" icon={<BellOutlined />} aria-label="Notifications" />
            </Badge>
            <Space size={8}>
              <Avatar style={{ background: "var(--color-gray-4)" }}>AD</Avatar>
              <div style={{ display: "grid", lineHeight: 1.2 }}>
                <span style={{ fontWeight: 700 }}>Hello There!</span>
                <span style={{ fontSize: 12, color: "var(--color-gray-4)" }}>Admin</span>
              </div>
            </Space>
          </Space>
        </>
      }
    >
      <PageHeader
        section={routeMeta.section}
        title={routeMeta.title}
        subtitle={routeMeta.subtitle}
      />
      <Routes>
        {/* Main builder page */}
        <Route
          path="/"
          element={
            <PageCard>
              <p>Upload, profile, role assignment, readiness, and manifest reproducibility flow.</p>

              {workflowUploadSourcePanel}

              {workflowSchemaSheetPanel}

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
                  <Button onClick={onExportManifest}>Export manifest</Button>
                  <Button onClick={onImportManifest}>Import manifest</Button>
                </div>
                <Input.TextArea
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
    </AppShell>
  );
}

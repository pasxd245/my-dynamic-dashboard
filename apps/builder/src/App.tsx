import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";

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
import ExcelSheetPicker from "./components/upload-flow/ExcelSheetPicker";
import UploadProgressPanel from "./components/upload-flow/UploadProgressPanel";
import SourceTypeSelector from "./components/upload-flow/SourceTypeSelector";
import UploadValidationNotice from "./components/upload-flow/UploadValidationNotice";
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
  border: "1px solid #d8d8d8",
  borderRadius: "0.75rem",
  background: "#ffffff",
};

const preStyle: React.CSSProperties = {
  padding: "0.75rem",
  overflowX: "auto",
  borderRadius: "0.5rem",
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
  const {
    selectedSourceType,
    selectedSheetName,
    sheetOptions,
    progressState,
    isUploading,
    errorMessage: uploadFlowErrorMessage,
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

  const onCreateWorkspace = async (): Promise<void> => {
    try {
      const payload = await createWorkspace(workspaceName);
      setWorkspaceId(payload.id);
      setUploadActionableError(null);
      setProfileActionableError(null);
      setProgressState("idle");
      setErrorMessage(null);
      setMessage(`Workspace created: ${payload.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unknown error");
    }
  };

  const onUpload = async (): Promise<void> => {
    if (!workspaceId || !selectedFile || !selectedSourceType) {
      setMessage("Create workspace, choose source type, and select a file first.");
      return;
    }

    if (!isSourceTypeCompatibleWithFilename(selectedSourceType, selectedFile.name)) {
      setMessage(getSourceTypeMismatchMessage(selectedSourceType, selectedFile.name) ?? "Invalid source/file combination.");
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
      navigate("/workflow/schema-sheet");
    } catch (error) {
      setUploadActionableError(getActionableError(error));
      setProgressState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      setMessage(error instanceof Error ? error.message : "Unknown error");
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
    <>
      <section style={panelStyle}>
        <h2>Create Workspace</h2>
        <input
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          placeholder="Workspace name"
          style={{ marginRight: "0.5rem", padding: "0.4rem", width: "18rem" }}
        />
        <button onClick={onCreateWorkspace}>Create</button>
      </section>

      <section style={panelStyle}>
        <h2>Upload Source</h2>
        <p style={{ marginTop: "0", marginBottom: "0.5rem", color: "#444" }}>
          Workspace: <strong>{workspaceId || "(create one first)"}</strong>
        </p>
        {uploadActionableError && <ActionableErrorPanel error={uploadActionableError} />}
        <input
          type="file"
          accept=".csv,.xlsx,.xlsm,.xlsb,.xls"
          onChange={(event) => onSelectedFileChange(event.currentTarget.files?.[0] ?? null)}
        />
        <SourceTypeSelector value={selectedSourceType} onChange={setSelectedSourceType} disabled={!workspaceId} />
        <ExcelSheetPicker
          options={sheetOptions}
          value={selectedSheetName}
          onChange={setSelectedSheetName}
          disabled={isUploading}
        />
        <button
          onClick={onUpload}
          disabled={!canUploadSelection}
          style={{ marginLeft: "0.5rem" }}
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>
        <UploadValidationNotice message={sourceValidationMessage} />
        {progressState !== "idle" || uploadFlowErrorMessage ? (
          <UploadProgressPanel state={progressState} message={uploadFlowErrorMessage ?? message} />
        ) : null}
      </section>
    </>
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
        fontFamily: "Georgia, 'Times New Roman', serif",
        padding: "2rem",
        maxWidth: "960px",
        margin: "0 auto",
        color: "#1b1b1b",
        background: "linear-gradient(180deg, #fffdf6 0%, #f6f0df 100%)",
        minHeight: "100vh",
      }}
    >
      <h1>My Dynamic Dashboard Builder</h1>

      {/* Navigation */}
      <nav style={{ marginBottom: "1.5rem", display: "flex", gap: "1rem" }}>
        <Link to="/" style={{ color: "#1b1b1b", textDecoration: "underline" }}>
          Query Builder
        </Link>
        <Link to="/saved-queries" style={{ color: "#1b1b1b", textDecoration: "underline" }}>
          Saved Queries Library
        </Link>
        <Link to="/workflow/upload-source" style={{ color: "#1b1b1b", textDecoration: "underline" }}>
          Workflow Shell
        </Link>
      </nav>

      <Routes>
        {/* Main builder page */}
        <Route
          path="/"
          element={
            <>
              <p>Upload, profile, role assignment, readiness, and manifest reproducibility flow.</p>

              <section style={panelStyle}>
                <h2>Create Workspace</h2>
                <input
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Workspace name"
                  style={{ marginRight: "0.5rem", padding: "0.4rem", width: "18rem" }}
                />
                <button onClick={onCreateWorkspace}>Create</button>
              </section>

              <section style={panelStyle}>
                <h2>Upload Source</h2>
                <p style={{ marginTop: "0", marginBottom: "0.5rem", color: "#444" }}>
                  Workspace: <strong>{workspaceId || "(create one first)"}</strong>
                </p>
                {uploadActionableError && <ActionableErrorPanel error={uploadActionableError} />}
                <input
                  type="file"
                  accept=".csv,.xlsx,.xlsm,.xlsb,.xls"
                  onChange={(event) => onSelectedFileChange(event.currentTarget.files?.[0] ?? null)}
                />
                <SourceTypeSelector
                  value={selectedSourceType}
                  onChange={setSelectedSourceType}
                  disabled={!workspaceId}
                />
                <ExcelSheetPicker
                  options={sheetOptions}
                  value={selectedSheetName}
                  onChange={setSelectedSheetName}
                  disabled={isUploading}
                />
                <button
                  onClick={onUpload}
                  disabled={!canUploadSelection}
                  style={{ marginLeft: "0.5rem" }}
                >
                  {isUploading ? "Uploading..." : "Upload"}
                </button>
                <UploadValidationNotice message={sourceValidationMessage} />
                {progressState !== "idle" || uploadFlowErrorMessage ? (
                  <UploadProgressPanel state={progressState} message={uploadFlowErrorMessage ?? message} />
                ) : null}
                <p style={{ marginTop: "0.5rem", marginBottom: "0", color: "#555" }}>
                  {selectedFile
                    ? `Selected file: ${selectedFile.name}`
                    : "Select a CSV/Excel file to upload."}
                </p>
              </section>

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
            </>
          }
        />

        {/* Saved Queries Library */}
        <Route
          path="/saved-queries"
          element={<SavedQueryLibraryPage workspaceId={workspaceId || "default"} />}
        />

        {/* Saved Query Detail */}
        <Route
          path="/saved-queries/:queryId"
          element={
            <SavedQueryDetail
              workspaceId={workspaceId || "default"}
              onLoadInBuilder={(snapshot) => {
                setLoadedSnapshot(snapshot);
                navigate("/");
              }}
            />
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
    </main>
  );
}

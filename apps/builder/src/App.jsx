import { useMemo, useState } from "react";

import { createWorkspace, overrideSheet, uploadSource } from "./api/workspaceApi";

function App() {
  const [workspaceName, setWorkspaceName] = useState("MVP1 Workspace");
  const [workspaceId, setWorkspaceId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [headerRow, setHeaderRow] = useState("1");
  const [dataRange, setDataRange] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  const currentSheet = useMemo(() => uploadResult?.sheets?.[0] ?? null, [uploadResult]);

  const onCreateWorkspace = async () => {
    try {
      const payload = await createWorkspace(workspaceName);
      setWorkspaceId(payload.id);
      setMessage(`Workspace created: ${payload.id}`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const onUpload = async () => {
    if (!workspaceId || !selectedFile) {
      setMessage("Create workspace and select a file first.");
      return;
    }

    try {
      const payload = await uploadSource(workspaceId, selectedFile);
      setUploadResult(payload);
      setDataRange(payload.sheets?.[0]?.data_range_effective ?? "");
      setHeaderRow(String(payload.sheets?.[0]?.header_row_effective ?? 1));
      setMessage("Upload complete.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const onOverride = async () => {
    if (!workspaceId || !currentSheet) {
      setMessage("Upload a source first.");
      return;
    }

    try {
      const payload = await overrideSheet(workspaceId, currentSheet.id, {
        header_row: Number(headerRow),
        data_range: dataRange,
        reason,
      });
      setUploadResult((previous) => ({
        ...previous,
        sheets: [payload],
      }));
      setMessage("Override applied.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: "860px" }}>
      <h1>My Dynamic Dashboard Builder</h1>
      <p>US1 flow: create workspace, upload source, override sheet settings.</p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Create Workspace</h2>
        <input
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          placeholder="Workspace name"
          style={{ marginRight: "0.5rem", padding: "0.4rem" }}
        />
        <button onClick={onCreateWorkspace}>Create</button>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Upload Source</h2>
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
        <button onClick={onUpload} style={{ marginLeft: "0.5rem" }}>
          Upload
        </button>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Sheet Override</h2>
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

      <section style={{ marginTop: "1.5rem" }}>
        <h2>State</h2>
        <p><strong>Workspace:</strong> {workspaceId || "(none)"}</p>
        <pre style={{ background: "#f4f4f4", padding: "0.75rem", overflowX: "auto" }}>
          {JSON.stringify(uploadResult, null, 2)}
        </pre>
        <p>{message}</p>
      </section>
    </main>
  );
}

export default App;

import type { UploadProgressState } from "../../api/types";

interface UploadProgressPanelProps {
  state: UploadProgressState;
  message: string | null;
}

const progressCopy: Record<UploadProgressState, string> = {
  idle: "Waiting for upload input.",
  validating: "Validating selected upload inputs.",
  discovering_sheets: "Checking workbook sheets.",
  uploading: "Uploading source and preparing workspace context.",
  success: "Upload finished successfully.",
  error: "Upload failed. Review the guidance below and retry.",
};

export default function UploadProgressPanel({
  state,
  message,
}: Readonly<UploadProgressPanelProps>): React.ReactElement {
  return (
    <section
      aria-live="polite"
      style={{
        marginTop: "0.75rem",
        padding: "0.75rem",
        borderRadius: "0.6rem",
        border: "1px solid #d8d8d8",
        background: state === "error" ? "#fff3f0" : "#faf7ef",
      }}
    >
      <strong>{progressCopy[state]}</strong>
      {message ? <p style={{ marginBottom: 0 }}>{message}</p> : null}
    </section>
  );
}

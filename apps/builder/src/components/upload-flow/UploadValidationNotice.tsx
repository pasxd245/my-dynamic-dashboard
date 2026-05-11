interface UploadValidationNoticeProps {
  readonly message: string | null;
  readonly title?: string;
  readonly nextSteps?: string[];
}

export default function UploadValidationNotice({
  message,
  title = "Action needed",
  nextSteps = [],
}: Readonly<UploadValidationNoticeProps>): React.ReactElement | null {
  if (!message) {
    return null;
  }

  return (
    <section
      role="alert"
      data-testid="upload-validation-notice"
      style={{
        marginTop: "0.6rem",
        marginBottom: 0,
        padding: "0.5rem 0.7rem",
        background: "#fff3f0",
        border: "1px solid #f1c9c2",
        borderRadius: "0.5rem",
        color: "#8d2b1f",
      }}
    >
      <strong style={{ display: "block", marginBottom: "0.2rem" }}>{title}</strong>
      <p style={{ marginTop: 0, marginBottom: nextSteps.length ? "0.35rem" : 0 }}>{message}</p>
      {nextSteps.length ? (
        <ul style={{ margin: 0, paddingLeft: "1rem" }}>
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

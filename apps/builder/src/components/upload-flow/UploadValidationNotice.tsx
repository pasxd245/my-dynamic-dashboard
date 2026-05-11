interface UploadValidationNoticeProps {
  message: string | null;
}

export default function UploadValidationNotice({ message }: UploadValidationNoticeProps): React.ReactElement | null {
  if (!message) {
    return null;
  }

  return (
    <p
      role="alert"
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
      {message}
    </p>
  );
}

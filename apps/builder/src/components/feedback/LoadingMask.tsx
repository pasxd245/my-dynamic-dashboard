export type LoadingMaskScope = "container" | "screen";

interface LoadingMaskProps {
  readonly visible: boolean;
  readonly message: string;
  readonly title?: string;
  readonly scope?: LoadingMaskScope;
  readonly zIndex?: number;
}

export default function LoadingMask({
  visible,
  message,
  title = "Working...",
  scope = "container",
  zIndex,
}: Readonly<LoadingMaskProps>): React.ReactElement | null {
  if (!visible) {
    return null;
  }

  const isScreen = scope === "screen";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: isScreen ? "fixed" : "absolute",
        inset: 0,
        background: "rgba(236, 239, 255, 0.78)",
        display: "grid",
        placeItems: "center",
        zIndex: zIndex ?? (isScreen ? 1000 : 20),
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "0.4rem",
          textAlign: "center",
          background: "#ffffff",
          border: "1px solid #ccd2f4",
          borderRadius: "0.8rem",
          padding: "0.9rem 1.2rem",
          minWidth: "15rem",
        }}
      >
        <strong>{title}</strong>
        <span style={{ color: "#46517a", fontSize: "0.95rem" }}>{message}</span>
      </div>
    </div>
  );
}

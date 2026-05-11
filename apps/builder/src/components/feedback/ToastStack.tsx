export type AppToastTone = "success" | "error" | "info";

export interface AppToast {
  readonly id: string;
  readonly tone: AppToastTone;
  readonly text: string;
}

interface ToastStackProps {
  readonly toasts: AppToast[];
  readonly top?: string;
  readonly right?: string;
  readonly zIndex?: number;
}

const tonePalette: Record<AppToastTone, { border: string; background: string; text: string }> = {
  error: { border: "#f4b6b8", background: "#fff1f1", text: "#7f1d1d" },
  success: { border: "#9cd8c5", background: "#edfdf7", text: "#0f5132" },
  info: { border: "#c9cff8", background: "#eef1ff", text: "#1f2a62" },
};

export default function ToastStack({
  toasts,
  top = "1rem",
  right = "1rem",
  zIndex = 30,
}: Readonly<ToastStackProps>): React.ReactElement | null {
  if (!toasts.length) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      style={{
        position: "absolute",
        top,
        right,
        zIndex,
        display: "grid",
        gap: "0.5rem",
        maxWidth: "20rem",
      }}
    >
      {toasts.map((toast) => {
        const palette = tonePalette[toast.tone];
        return (
          <output
            key={toast.id}
            aria-live="polite"
            style={{
              borderRadius: "0.8rem",
              border: `1px solid ${palette.border}`,
              background: palette.background,
              color: palette.text,
              padding: "0.65rem 0.8rem",
              boxShadow: "0 8px 30px rgba(26, 33, 75, 0.15)",
            }}
          >
            {toast.text}
          </output>
        );
      })}
    </div>
  );
}

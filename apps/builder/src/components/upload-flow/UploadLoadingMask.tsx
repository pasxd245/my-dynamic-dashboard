import { Spin, Typography } from "antd";

const { Text } = Typography;

interface UploadLoadingMaskProps {
  readonly visible: boolean;
  readonly message: string;
}

export default function UploadLoadingMask({
  visible,
  message,
}: UploadLoadingMaskProps): React.ReactElement | null {
  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(236, 239, 255, 0.78)",
        display: "grid",
        placeItems: "center",
        zIndex: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          background: "var(--color-white)",
          border: "1px solid var(--surface-line)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          minWidth: 240,
          boxShadow: "var(--shadow-card)",
        }}
      >
        <Spin size="large" />
        <Text strong>Working on your upload...</Text>
        <Text type="secondary">{message}</Text>
      </div>
    </div>
  );
}

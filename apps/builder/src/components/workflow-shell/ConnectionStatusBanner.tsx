import { Alert, Button, Flex, Tag, Typography } from "antd";
import type { ConnectionStatus } from "../../api/types";

const { Text, Paragraph } = Typography;

const STATUS_COLOR: Record<ConnectionStatus["status"], string> = {
  ready: "success",
  degraded: "warning",
  unavailable: "error",
};

export interface ConnectionStatusBannerProps {
  readonly connectionStatus?: ConnectionStatus;
  readonly isRefreshing?: boolean;
  readonly onRefresh?: () => void;
}

function formatLastChecked(timestamp?: string): string {
  if (!timestamp) {
    return "Not checked yet";
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return parsed.toLocaleString();
}

export default function ConnectionStatusBanner({
  connectionStatus,
  isRefreshing = false,
  onRefresh,
}: ConnectionStatusBannerProps): React.ReactElement {
  if (!connectionStatus) {
    return <Alert type="info" showIcon description="Connection status is loading." />;
  }

  return (
    <Flex
      align="flex-start"
      justify="space-between"
      gap={12}
      wrap="wrap"
      style={{
        border: "1px solid var(--surface-line)",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-white)",
        padding: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 240px" }}>
        <Flex align="center" gap={8} wrap="wrap">
          <Tag color={STATUS_COLOR[connectionStatus.status]} style={{ marginInlineEnd: 0 }}>
            {connectionStatus.status.toUpperCase()}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Last checked: {formatLastChecked(connectionStatus.last_checked_at_utc)}
          </Text>
        </Flex>
        <Paragraph strong style={{ marginTop: 8, marginBottom: 4 }}>
          {connectionStatus.summary}
        </Paragraph>
        <Paragraph style={{ margin: 0, color: "var(--color-gray-4)" }}>
          {connectionStatus.guidance}
        </Paragraph>
      </div>
      {onRefresh ? (
        <Button onClick={onRefresh} disabled={isRefreshing} loading={isRefreshing}>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      ) : null}
    </Flex>
  );
}

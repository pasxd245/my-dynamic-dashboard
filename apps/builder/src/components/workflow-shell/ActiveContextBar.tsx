import { Flex, Tag, Typography } from "antd";
import type { ActiveContextState } from "../../api/types";

const { Text } = Typography;

const STATE_COLOR: Record<ActiveContextState, string> = {
  resolved: "success",
  stale: "warning",
  unresolved: "default",
};

interface ContextBadgeProps {
  readonly label: string;
  readonly value: string;
  readonly state: ActiveContextState;
}

function ContextBadge({ label, value, state }: ContextBadgeProps): React.ReactElement {
  return (
    <Flex
      align="center"
      gap={8}
      style={{
        border: "1px solid var(--surface-line)",
        borderRadius: "var(--radius-sm)",
        padding: "8px 12px",
        background: "var(--color-white)",
      }}
    >
      <Text type="secondary" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </Text>
      <Text strong style={{ fontSize: 14 }}>
        {value}
      </Text>
      <Tag color={STATE_COLOR[state]} style={{ marginInlineEnd: 0 }}>
        {state}
      </Tag>
    </Flex>
  );
}

export interface ActiveContextBarProps {
  readonly workspaceName?: string;
  readonly sourceName?: string;
  readonly workspaceState: ActiveContextState;
  readonly sourceState: ActiveContextState;
}

export default function ActiveContextBar({
  workspaceName,
  sourceName,
  workspaceState,
  sourceState,
}: ActiveContextBarProps): React.ReactElement {
  return (
    <Flex gap={8} wrap="wrap">
      <ContextBadge
        label="Workspace"
        value={workspaceName || "Not selected"}
        state={workspaceState}
      />
      <ContextBadge label="Source" value={sourceName || "Not selected"} state={sourceState} />
    </Flex>
  );
}

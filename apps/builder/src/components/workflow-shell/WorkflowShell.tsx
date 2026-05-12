import type { ReactNode } from "react";
import { Alert, Button, Col, Flex, Row, Tag, Typography } from "antd";
import ActiveContextBar from "./ActiveContextBar";
import ConnectionStatusBanner from "./ConnectionStatusBanner";
import type {
  ActiveContextState,
  ConnectionStatus,
  WorkflowStage,
  WorkflowStageKey,
} from "../../api/types";

const { Title } = Typography;

const STATUS_COLOR: Record<WorkflowStage["status"], string> = {
  completed: "success",
  in_progress: "processing",
  ready: "default",
  locked: "error",
};

export interface WorkflowShellProps {
  readonly title?: string;
  readonly children?: ReactNode;
  readonly stageContent?: Partial<Record<WorkflowStageKey, ReactNode>>;
  readonly stages?: WorkflowStage[];
  readonly activeStage?: WorkflowStageKey;
  readonly onSelectStage?: (stage: WorkflowStageKey) => void;
  readonly workspaceName?: string;
  readonly sourceName?: string;
  readonly workspaceState?: ActiveContextState;
  readonly sourceState?: ActiveContextState;
  readonly connectionStatus?: ConnectionStatus;
  readonly isRefreshingConnectionStatus?: boolean;
  readonly onRefreshConnectionStatus?: () => void;
  readonly blockContextGuardedStages?: boolean;
  readonly onReselectContext?: () => void;
}

export default function WorkflowShell({
  title = "Builder Workflow",
  children,
  stageContent,
  stages = [],
  activeStage = "upload_source",
  onSelectStage,
  workspaceName,
  sourceName,
  workspaceState = "unresolved",
  sourceState = "unresolved",
  connectionStatus,
  isRefreshingConnectionStatus = false,
  onRefreshConnectionStatus,
  blockContextGuardedStages = false,
  onReselectContext,
}: WorkflowShellProps): React.ReactElement {
  const activeStageInfo = stages.find((stage) => stage.stage_key === activeStage);

  const renderStageButton = (stage: WorkflowStage): React.ReactElement => {
    const isActive = stage.stage_key === activeStage;
    const isLocked = stage.status === "locked";

    return (
      <Button
        key={stage.stage_key}
        onClick={() => {
          if (!isLocked) {
            onSelectStage?.(stage.stage_key);
          }
        }}
        disabled={isLocked}
        type={isActive ? "primary" : "default"}
        block
        style={{
          height: "auto",
          padding: "10px 12px",
          textAlign: "left",
          whiteSpace: "normal",
        }}
      >
        <Flex align="center" gap={8} justify="space-between">
          <span style={{ fontWeight: 600 }}>{stage.title}</span>
          <Tag color={STATUS_COLOR[stage.status]} style={{ marginInlineEnd: 0 }}>
            {stage.status}
          </Tag>
        </Flex>
      </Button>
    );
  };

  const renderPrerequisiteCallout = (): React.ReactElement | null => {
    if (activeStageInfo?.status !== "locked") {
      return null;
    }

    const missing = activeStageInfo.missing_prerequisites ?? activeStageInfo.prerequisites;
    const previousStageKey = activeStageInfo.previous_stage_key;
    const description = (
      <Flex vertical gap={8}>
        <strong>This stage is blocked by prerequisites.</strong>
        {missing.length > 0 ? (
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <Flex gap={8} wrap="wrap">
          {previousStageKey ? (
            <Button type="primary" onClick={() => onSelectStage?.(previousStageKey)}>
              Go to previous stage
            </Button>
          ) : null}
          {onReselectContext &&
          activeStageInfo.prerequisites.includes("active_context_resolved") ? (
            <Button danger type="primary" onClick={onReselectContext}>
              Resolve active context
            </Button>
          ) : null}
        </Flex>
      </Flex>
    );

    return <Alert type="warning" showIcon description={description} />;
  };

  return (
    <section
      aria-label="builder-workflow-shell"
      data-testid="builder-workflow-shell"
      className="page-card"
    >
      <Flex vertical gap={16}>
        <Flex vertical gap={12}>
          <Title level={3} style={{ margin: 0 }}>
            {title}
          </Title>
          <ActiveContextBar
            workspaceName={workspaceName}
            sourceName={sourceName}
            workspaceState={workspaceState}
            sourceState={sourceState}
          />
          <ConnectionStatusBanner
            connectionStatus={connectionStatus}
            isRefreshing={isRefreshingConnectionStatus}
            onRefresh={onRefreshConnectionStatus}
          />

          {stages.length > 0 ? (
            <Row gutter={[8, 8]} aria-label="workflow-stages" role="navigation">
              {stages.map((stage) => (
                <Col key={stage.stage_key} xs={24} sm={12} lg={6}>
                  {renderStageButton(stage)}
                </Col>
              ))}
            </Row>
          ) : null}

          {blockContextGuardedStages ? (
            <Alert
              type="warning"
              showIcon
              description="Query and saved-query stages are locked until workspace/source context is resolved."
              action={
                onReselectContext ? (
                  <Button danger type="primary" onClick={onReselectContext}>
                    Reselect Context
                  </Button>
                ) : null
              }
            />
          ) : null}

          {renderPrerequisiteCallout()}
        </Flex>
        <div>
          {stageContent && activeStage ? stageContent[activeStage] : null}
          {children}
        </div>
      </Flex>
    </section>
  );
}

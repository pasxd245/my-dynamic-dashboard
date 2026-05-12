import { useState } from "react";
import { Alert, Button, Collapse, Flex, Typography } from "antd";

import type { ActionableError } from "../../api/types";
import { humanizeActionableStage } from "../../api/httpErrors";
import { getErrorMetaForCode } from "../../api/errorKinds";

const { Text, Paragraph } = Typography;

export interface ActionableErrorPanelProps {
  readonly error: ActionableError;
}

const stageRecoveryCopy: Partial<Record<ActionableError["stage"], string>> = {
  upload_source:
    "Review the selected file, source type, and sheet choices before retrying this stage.",
  schema_sheet:
    "Resolve the upload-stage issue first, then return to schema and sheet adjustments.",
  query: "Keep the active context stable before retrying downstream query actions.",
  results_saved:
    "Retry after the upstream query and context stages are healthy again.",
  global: "Retry after the current builder context is stable.",
};

export default function ActionableErrorPanel({
  error,
}: ActionableErrorPanelProps): React.ReactElement {
  const [showTechnical, setShowTechnical] = useState<boolean>(
    Boolean(error.show_technical_by_default),
  );
  const meta = getErrorMetaForCode(error.error_code);
  const stageCopy = stageRecoveryCopy[error.stage];

  return (
    <Alert
      type={meta.severity}
      showIcon
      data-testid="actionable-error-panel"
      data-error-kind={meta.kind}
      description={
        <Flex vertical gap={8}>
          <Text strong style={{ fontSize: 15 }}>
            {meta.title}
          </Text>
          <Paragraph style={{ margin: 0 }}>{meta.guidance}</Paragraph>
          {error.user_message && error.user_message !== meta.title ? (
            <Paragraph style={{ margin: 0 }} type="secondary">
              Server message: {error.user_message}
            </Paragraph>
          ) : null}
          {error.next_steps.length > 0 ? (
            <div>
              <Text strong>Next steps:</Text>
              <ul style={{ margin: "4px 0 0", paddingInlineStart: 20 }}>
                {error.next_steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {stageCopy ? (
            <Text type="secondary" style={{ fontSize: 13 }}>
              {humanizeActionableStage(error.stage)} stage: {stageCopy}
            </Text>
          ) : null}
          <Flex gap={8} align="center" wrap="wrap">
            <Text type="secondary" style={{ fontSize: 12 }}>
              Correlation ID: <code>{error.correlation_id}</code>
            </Text>
            {error.technical_details ? (
              <Button
                size="small"
                type="link"
                onClick={() => setShowTechnical((value) => !value)}
              >
                {showTechnical ? "Hide technical details" : "Show technical details"}
              </Button>
            ) : null}
          </Flex>
          {showTechnical && error.technical_details ? (
            <Collapse
              size="small"
              defaultActiveKey={["technical"]}
              items={[
                {
                  key: "technical",
                  label: "Technical details",
                  children: (
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {JSON.stringify(error.technical_details, null, 2)}
                    </pre>
                  ),
                },
              ]}
            />
          ) : null}
        </Flex>
      }
    />
  );
}

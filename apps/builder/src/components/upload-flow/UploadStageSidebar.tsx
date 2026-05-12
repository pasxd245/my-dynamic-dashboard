import { Steps, Typography } from "antd";
import type { StepsProps } from "antd";
import type { UploadStepKey, UploadStepNavItem } from "./uploadStageModel";

const { Title } = Typography;

interface UploadStageSidebarProps {
  readonly items: UploadStepNavItem[];
  readonly activeStep: UploadStepKey;
  readonly onSelectStep: (step: UploadStepKey) => void;
  readonly blockNavigation?: boolean;
  readonly onBlockedSelect?: (step: UploadStepKey, reason: string) => void;
}

function deriveStatus(
  step: UploadStepNavItem,
  activeStep: UploadStepKey,
  index: number,
  activeIndex: number,
): NonNullable<NonNullable<StepsProps["items"]>[number]["status"]> {
  if (step.key === activeStep) return "process";
  if (step.blockedReason) return "wait";
  return index < activeIndex ? "finish" : "wait";
}

export default function UploadStageSidebar({
  items,
  activeStep,
  onSelectStep,
  blockNavigation = false,
  onBlockedSelect,
}: UploadStageSidebarProps): React.ReactElement {
  const activeIndex = items.findIndex((s) => s.key === activeStep);

  const stepsItems: StepsProps["items"] = items.map((step, index) => ({
    title: step.title,
    content: step.subtitle,
    status: deriveStatus(step, activeStep, index, activeIndex),
    disabled: blockNavigation,
  }));

  const handleChange = (index: number): void => {
    if (blockNavigation) return;
    const step = items[index];
    if (!step) return;
    if (step.blockedReason) {
      onBlockedSelect?.(step.key, step.blockedReason);
      return;
    }
    onSelectStep(step.key);
  };

  return (
    <aside
      data-testid="upload-stage-sidebar"
      aria-label="Upload steps"
      style={{
        flex: "0 0 14rem",
        borderRight: "1px solid var(--surface-line)",
        background: "var(--color-gray-1)",
        padding: 16,
      }}
    >
      <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
        Upload Steps
      </Title>
      <Steps
        orientation="vertical"
        current={Math.max(activeIndex, 0)}
        items={stepsItems}
        onChange={handleChange}
      />
    </aside>
  );
}

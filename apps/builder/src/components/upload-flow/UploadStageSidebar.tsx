import type { UploadStepKey, UploadStepNavItem } from "./uploadStageModel";

interface UploadStageSidebarProps {
  readonly items: UploadStepNavItem[];
  readonly activeStep: UploadStepKey;
  readonly onSelectStep: (step: UploadStepKey) => void;
  readonly blockNavigation?: boolean;
  readonly onBlockedSelect?: (step: UploadStepKey, reason: string) => void;
}

export default function UploadStageSidebar({
  items,
  activeStep,
  onSelectStep,
  blockNavigation = false,
  onBlockedSelect,
}: UploadStageSidebarProps): React.ReactElement {
  return (
    <aside
      style={{
        flex: "0 0 14rem",
        borderRight: "1px solid var(--color-gray-2)",
        background: "linear-gradient(180deg, var(--color-gray-1) 0%, var(--color-gray-2) 100%)",
        padding: "1rem",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "0.9rem", color: "var(--color-dark-blue)" }}>Upload Steps</h3>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        {items.map((step, index) => {
          const isActive = activeStep === step.key;
          const isDisabled = blockNavigation;
          let background = "var(--color-off-white)";
          if (step.blockedReason) {
            background = "var(--color-gray-1)";
          }
          if (isActive) {
            background = "var(--color-white)";
          }

          let opacity = 1;
          if (step.blockedReason) {
            opacity = 0.78;
          }
          if (isDisabled) {
            opacity = 0.55;
          }
          return (
            <button
              key={step.key}
              type="button"
              className="upload-step-button"
              disabled={isDisabled}
              aria-current={isActive ? "step" : undefined}
              data-testid={`upload-step-${step.key}`}
              onClick={() => {
                if (step.blockedReason) {
                  onBlockedSelect?.(step.key, step.blockedReason);
                  return;
                }
                onSelectStep(step.key);
              }}
              style={{
                textAlign: "left",
                borderRadius: "var(--radius-md)",
                border: isActive ? "1px solid var(--color-blue)" : "1px solid var(--color-gray-2)",
                background,
                color: isActive ? "var(--color-blue)" : "var(--color-dark-blue)",
                padding: "0.55rem 0.6rem",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity,
                transition: "background 120ms ease, border-color 120ms ease",
              }}
            >
              <strong style={{ display: "block", fontSize: "0.9rem" }}>{`${index + 1}. ${step.title}`}</strong>
              <small>{step.subtitle}</small>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

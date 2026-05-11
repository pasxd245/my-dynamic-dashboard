import { useState } from "react";

import type { ActionableError } from "../../api/types";
import { humanizeActionableStage } from "../../api/httpErrors";

export interface ActionableErrorPanelProps {
  error: ActionableError;
}

const stageRecoveryCopy: Partial<Record<ActionableError["stage"], string>> = {
  upload_source: "Review the selected file, source type, and sheet choices before retrying this stage.",
  schema_sheet: "Resolve the upload-stage issue first, then return to schema and sheet adjustments.",
  query: "Keep the active context stable before retrying downstream query actions.",
  results_saved: "Retry after the upstream query and context stages are healthy again.",
  global: "Retry after the current builder context is stable.",
};

export default function ActionableErrorPanel({ error }: Readonly<ActionableErrorPanelProps>): React.ReactElement {
  const [showTechnical, setShowTechnical] = useState<boolean>(
    Boolean(error.show_technical_by_default),
  );
  const recoveryCopy = stageRecoveryCopy[error.stage];

  return (
    <section aria-live="polite" data-testid="actionable-error-panel">
      <h3>{error.user_message}</h3>
      <p>
        <strong>Stage:</strong> {humanizeActionableStage(error.stage)}
      </p>
      {recoveryCopy ? <p>{recoveryCopy}</p> : null}
      <ul>
        {error.next_steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
      {error.technical_details ? (
        <div>
          <button type="button" onClick={() => setShowTechnical((value) => !value)}>
            {showTechnical ? "Hide technical details" : "Show technical details"}
          </button>
          {showTechnical ? (
            <pre>{JSON.stringify(error.technical_details, null, 2)}</pre>
          ) : null}
        </div>
      ) : null}
      <small>Correlation ID: {error.correlation_id}</small>
    </section>
  );
}

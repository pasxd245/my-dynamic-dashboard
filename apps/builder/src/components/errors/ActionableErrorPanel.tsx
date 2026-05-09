import { useState } from "react";

import type { ActionableError } from "../../api/types";

export interface ActionableErrorPanelProps {
  error: ActionableError;
}

export default function ActionableErrorPanel({ error }: ActionableErrorPanelProps): React.ReactElement {
  const [showTechnical, setShowTechnical] = useState<boolean>(
    Boolean(error.show_technical_by_default),
  );

  return (
    <section aria-live="polite" data-testid="actionable-error-panel">
      <h3>{error.user_message}</h3>
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

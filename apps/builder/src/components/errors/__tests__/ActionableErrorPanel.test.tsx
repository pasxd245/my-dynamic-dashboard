import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import ActionableErrorPanel from "../ActionableErrorPanel";
import type { ActionableError } from "../../../api/types";

function makeError(overrides: Partial<ActionableError> = {}): ActionableError {
  return {
    error_code: "parse_failed",
    stage: "upload_source",
    user_message: "Parse failed",
    next_steps: ["Open the file locally", "Re-save"],
    correlation_id: "abc-123",
    occurred_at_utc: "2026-05-12T17:30:00Z",
    ...overrides,
  };
}

describe("ActionableErrorPanel", () => {
  it("renders kind-specific title and guidance for encrypted_file", () => {
    render(<ActionableErrorPanel error={makeError({ error_code: "encrypted_file" })} />);
    expect(screen.getByText(/password-protected/i)).toBeTruthy();
    expect(screen.getByText(/Open the workbook in Excel/i)).toBeTruthy();
  });

  it("renders source_type_mismatch with warning guidance", () => {
    render(
      <ActionableErrorPanel
        error={makeError({ error_code: "source_type_mismatch" })}
      />,
    );
    expect(screen.getByText(/Source type doesn't match/i)).toBeTruthy();
  });

  it("falls back to unknown-kind copy for unrecognized error codes", () => {
    render(
      <ActionableErrorPanel error={makeError({ error_code: "brand_new_code" })} />,
    );
    expect(screen.getByText(/Something went wrong/i)).toBeTruthy();
  });

  it("renders next-step bullets", () => {
    render(
      <ActionableErrorPanel
        error={makeError({ next_steps: ["Try option A", "Try option B"] })}
      />,
    );
    expect(screen.getByText("Try option A")).toBeTruthy();
    expect(screen.getByText("Try option B")).toBeTruthy();
  });

  it("shows correlation id for support reference", () => {
    render(
      <ActionableErrorPanel error={makeError({ correlation_id: "trace-xyz" })} />,
    );
    expect(screen.getByText(/trace-xyz/)).toBeTruthy();
  });

  it("tags the panel with the resolved error kind for downstream styling/testing", () => {
    render(<ActionableErrorPanel error={makeError({ error_code: "encrypted_file" })} />);
    const panel = screen.getByTestId("actionable-error-panel");
    expect(panel.getAttribute("data-error-kind")).toBe("encrypted_file");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UploadValidationNotice from "../upload-flow/UploadValidationNotice";

describe("UploadValidationNotice", () => {
  it("renders inline guidance with follow-up steps", () => {
    render(
      <UploadValidationNotice
        message="Choose an Excel sheet before continuing to submit."
        title="Stage blocked"
        nextSteps={["Pick a workbook sheet", "Retry submit"]}
      />,
    );

    expect(screen.getByText("Stage blocked")).toBeTruthy();
    expect(screen.getByText("Choose an Excel sheet before continuing to submit.")).toBeTruthy();
    expect(screen.getByText("Pick a workbook sheet")).toBeTruthy();
  });

  it("renders nothing when no message is provided", () => {
    render(<UploadValidationNotice message={null} />);

    expect(screen.queryByTestId("upload-validation-notice")).toBeNull();
  });
});

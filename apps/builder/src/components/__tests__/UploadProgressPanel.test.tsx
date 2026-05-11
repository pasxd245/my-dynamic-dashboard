import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UploadProgressPanel from "../upload-flow/UploadProgressPanel";

describe("UploadProgressPanel", () => {
  it("renders uploading status copy", () => {
    render(<UploadProgressPanel state="uploading" message="Uploading workbook..." />);

    expect(screen.getByText("Uploading source and preparing workspace context.")).toBeTruthy();
    expect(screen.getByText("Uploading workbook...")).toBeTruthy();
  });

  it("shows retry-oriented failure guidance", () => {
    render(<UploadProgressPanel state="error" message="Upload failed. Retry after fixing the workbook." />);

    expect(screen.getByText("Upload failed. Review the guidance below and retry.")).toBeTruthy();
    expect(screen.getByText("Upload failed. Retry after fixing the workbook.")).toBeTruthy();
  });
});

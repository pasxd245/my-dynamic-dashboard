import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UploadLoadingMask from "../upload-flow/UploadLoadingMask";

describe("UploadLoadingMask", () => {
  it("renders blocking copy when visible", () => {
    render(<UploadLoadingMask visible message="Reading workbook sheets" />);

    expect(screen.getByText("Working on your upload...")).toBeTruthy();
    expect(screen.getByText("Reading workbook sheets")).toBeTruthy();
  });

  it("renders nothing when hidden", () => {
    render(<UploadLoadingMask visible={false} message="Hidden" />);

    expect(screen.queryByText("Working on your upload...")).toBeNull();
  });
});

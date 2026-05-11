import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UploadToastStack from "../upload-flow/UploadToastStack";

describe("UploadToastStack", () => {
  it("renders success, info, and error toasts", () => {
    render(
      <UploadToastStack
        toasts={[
          { id: "1", tone: "success", text: "Workspace ready" },
          { id: "2", tone: "info", text: "Choose a sheet" },
          { id: "3", tone: "error", text: "Upload failed" },
        ]}
      />,
    );

    expect(screen.getByText("Workspace ready")).toBeTruthy();
    expect(screen.getByText("Choose a sheet")).toBeTruthy();
    expect(screen.getByText("Upload failed")).toBeTruthy();
  });

  it("renders nothing when there are no toasts", () => {
    render(<UploadToastStack toasts={[]} />);

    expect(screen.queryByText("Workspace ready")).toBeNull();
  });
});

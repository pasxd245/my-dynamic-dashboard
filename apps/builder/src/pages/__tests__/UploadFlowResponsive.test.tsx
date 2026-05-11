import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../../api/workspaceApi", () => ({
  assignColumnRoles: vi.fn(),
  createWorkspace: vi.fn(),
  discoverExcelSheets: vi.fn(),
  exportManifest: vi.fn(),
  getReadiness: vi.fn(),
  getWorkspaceProfile: vi.fn(),
  importManifest: vi.fn(),
  overrideSheet: vi.fn(),
  uploadSource: vi.fn(),
}));

vi.mock("../../api/builderSessionApi", () => ({
  setActiveContext: vi.fn(),
}));

vi.mock("../../components/query-builder/QueryBuilderPanel", () => ({
  default: () => <div>Mock Query Builder</div>,
}));

vi.mock("../../components/SavedQuery", () => ({
  SaveQueryDialog: () => null,
}));

vi.mock("../../pages/SavedQueryLibrary", () => ({
  SavedQueryLibraryPage: () => <div>Saved Query Library</div>,
  SavedQueryDetail: () => <div>Saved Query Detail</div>,
}));

import App from "../../App";
import { useQueryBuilderStore, useUploadFlowStore } from "../../state";

beforeEach(() => {
  window.sessionStorage.clear();
  useQueryBuilderStore.getState().reset();
  useUploadFlowStore.getState().reset();
});

describe("Upload flow responsive layout", () => {
  it("keeps the guided upload layout in a wrapping flex container", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const layout = screen.getByTestId("guided-upload-layout");
    expect(layout).toBeTruthy();
    expect(layout.getAttribute("style")).toContain("flex-wrap: wrap");
  });

  it("renders the sidebar step list alongside the guided form shell", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Upload Steps")).toBeTruthy();
    expect(screen.getByText("Guided Upload")).toBeTruthy();
  });
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createWorkspace: vi.fn(),
  discoverExcelSheets: vi.fn(),
  uploadSource: vi.fn(),
  setActiveContext: vi.fn(),
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
  createWorkspace: mocks.createWorkspace,
  discoverExcelSheets: mocks.discoverExcelSheets,
  exportManifest: vi.fn(),
  getReadiness: vi.fn(),
  getWorkspaceProfile: vi.fn(),
  importManifest: vi.fn(),
  overrideSheet: vi.fn(),
  uploadSource: mocks.uploadSource,
}));

vi.mock("../../api/builderSessionApi", () => ({
  setActiveContext: mocks.setActiveContext,
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

function renderApp(): void {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );
}

async function createWorkspaceAndReachSubmit(): Promise<void> {
  fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Workspace 1" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
  });
  await screen.findByText("Workspace ws-1 is ready.");

  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, {
    target: { files: [new File(["a,b\n1,2"], "orders.csv", { type: "text/csv" })] },
  });
  await act(async () => {
    fireEvent.change(await screen.findByLabelText("Source type"), { target: { value: "csv" } });
  });
  await screen.findByRole("button", { name: "Upload and continue" });
}

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.createWorkspace.mockReset();
  mocks.discoverExcelSheets.mockReset();
  mocks.uploadSource.mockReset();
  mocks.setActiveContext.mockReset();
  window.sessionStorage.clear();
  useQueryBuilderStore.getState().reset();
  useUploadFlowStore.getState().reset();

  mocks.createWorkspace.mockResolvedValue({ id: "ws-1", name: "Workspace 1" });
  mocks.setActiveContext.mockResolvedValue(undefined);
});

afterEach(() => {
  useQueryBuilderStore.getState().reset();
  useUploadFlowStore.getState().reset();
});

describe("Upload flow feedback wiring", () => {
  it("shows success toast after a successful upload outcome", async () => {
    mocks.uploadSource.mockResolvedValue({
      source_id: "src-1",
      warnings: [],
      sheets: [
        { id: "sheet-1", name: "Orders", data_range_effective: "A1:B2", header_row_effective: 1 },
      ],
    });

    renderApp();
    await createWorkspaceAndReachSubmit();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    });

    await screen.findByText("Upload complete. Opening workflow stage.");
    await waitFor(() => expect(mocks.uploadSource).toHaveBeenCalledTimes(1));
    expect(mocks.navigate).toHaveBeenCalledWith("/workflow/schema-sheet");
  });

  it("shows error toast after a failed upload outcome", async () => {
    mocks.uploadSource.mockRejectedValue(new Error("Upload exploded"));

    renderApp();
    await createWorkspaceAndReachSubmit();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    });

    await screen.findAllByText("Upload exploded");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

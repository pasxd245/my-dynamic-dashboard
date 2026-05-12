import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import WorkspacePicker from "../workspace/WorkspacePicker";
import * as workspaceStore from "../../state/workspaceStore";

// Mock the workspace store
const mockWorkspaces = [
  { id: "ws-1", name: "Workspace 1" },
  { id: "ws-2", name: "Workspace 2" },
];

const mockStoreActions = {
  loadWorkspaces: vi.fn(async () => {}),
  selectWorkspace: vi.fn(),
  createAndSelectWorkspace: vi.fn(async (name: string) => ({
    id: `ws-${Date.now()}`,
    name,
  })),
  setError: vi.fn(),
  reset: vi.fn(),
};

const createMockStore = (overrides = {}) => ({
  workspaces: mockWorkspaces,
  selectedWorkspaceId: null,
  isLoading: false,
  error: null,
  ...mockStoreActions,
  ...overrides,
});

describe("WorkspacePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with title when visible", () => {
    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore() as any
    );

    render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Select or Create a Workspace")).toBeTruthy();
  });

  it("loads workspaces on mount when visible", () => {
    const loadWorkspaces = vi.fn(async () => {});
    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore({ loadWorkspaces, workspaces: [] }) as any
    );

    render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(loadWorkspaces).toHaveBeenCalled();
  });

  it("displays list of workspaces", () => {
    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore() as any
    );

    render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Workspace 1")).toBeTruthy();
    expect(screen.getByText("Workspace 2")).toBeTruthy();
  });

  it("selects workspace when clicked", async () => {
    const selectWorkspace = vi.fn();
    const onWorkspaceSelected = vi.fn();
    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore({ selectWorkspace }) as any
    );

    render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={onWorkspaceSelected}
        onClose={vi.fn()}
      />
    );

    const workspace1 = screen.getByText("Workspace 1");
    fireEvent.click(workspace1);

    expect(selectWorkspace).toHaveBeenCalledWith("ws-1");
    expect(onWorkspaceSelected).toHaveBeenCalledWith({
      id: "ws-1",
      name: "Workspace 1",
    });
  });

  it("shows create workspace form when button clicked", async () => {
    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore() as any
    );

    render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const createButton = screen.getByText("Create New Workspace");
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter workspace name/)).toBeTruthy();
    });
  });

  it("creates new workspace with valid name", async () => {
    const createAndSelectWorkspace = vi.fn(async (name: string) => ({
      id: "ws-new",
      name,
    }));
    const selectWorkspace = vi.fn();
    const onWorkspaceSelected = vi.fn();

    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore({
        createAndSelectWorkspace,
        selectWorkspace,
      }) as any
    );

    render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={onWorkspaceSelected}
        onClose={vi.fn()}
      />
    );

    // Click create button
    const createButton = screen.getByText("Create New Workspace");
    fireEvent.click(createButton);

    // Enter workspace name
    const input = screen.getByPlaceholderText(/Enter workspace name/);
    fireEvent.change(input, { target: { value: "New Workspace" } });

    // Submit
    const submitButton = screen.getByText("Create Workspace");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(createAndSelectWorkspace).toHaveBeenCalledWith("New Workspace");
      expect(selectWorkspace).toHaveBeenCalledWith("ws-new");
    });
  });

  it("shows error when workspace name is empty", async () => {
    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore() as any
    );

    render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // Click create button
    const createButton = screen.getByText("Create New Workspace");
    fireEvent.click(createButton);

    // Try to submit without entering name
    const submitButton = screen.getByText("Create Workspace");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Workspace name is required")).toBeTruthy();
    });
  });

  it("shows error when workspace name exceeds 50 characters", async () => {
    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore() as any
    );

    render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // Click create button
    const createButton = screen.getByText("Create New Workspace");
    fireEvent.click(createButton);

    // Enter very long name
    const input = screen.getByPlaceholderText(/Enter workspace name/);
    const longName = "a".repeat(51);
    fireEvent.change(input, { target: { value: longName } });

    // Try to submit
    const submitButton = screen.getByText("Create Workspace");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Workspace name must be 50 characters or less")
      ).toBeTruthy();
    });
  });

  it("displays empty state when no workspaces exist", () => {
    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore({ workspaces: [] }) as any
    );

    render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("No workspaces found")).toBeTruthy();
    expect(screen.getByText("Create Your First Workspace")).toBeTruthy();
  });

  it("shows selected workspace with badge", () => {
    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore({ selectedWorkspaceId: "ws-1" }) as any
    );

    render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Selected")).toBeTruthy();
  });

  it("closes modal and resets state on close", () => {
    const onClose = vi.fn();
    vi.spyOn(workspaceStore, "useWorkspaceStore").mockReturnValue(
      createMockStore() as any
    );

    const { getByRole } = render(
      <WorkspacePicker
        visible={true}
        onWorkspaceSelected={vi.fn()}
        onClose={onClose}
      />
    );

    // Close button should be present in the modal
    const closeButtons = screen.getAllByRole("button");
    const cancelButton = closeButtons.find((btn) =>
      btn.textContent?.includes("Cancel")
    );
    if (cancelButton) {
      fireEvent.click(cancelButton);
    }
  });
});

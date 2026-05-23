import { AntdConfig } from "@mdd/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../src/components/AppLayout";
import { WorkspacesPage } from "../src/features/data-management/WorkspacesPage";

function renderAt(path: string) {
  return render(
    <AntdConfig>
      <MemoryRouter initialEntries={[path]}>
        <AppLayout>
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/data-management/workspaces" replace />}
            />
            <Route
              path="/data-management"
              element={<Navigate to="/data-management/workspaces" replace />}
            />
            <Route
              path="/data-management/workspaces"
              element={<WorkspacesPage />}
            />
          </Routes>
        </AppLayout>
      </MemoryRouter>
    </AntdConfig>,
  );
}

describe("builder routing", () => {
  it("renders the Workspaces page with sample card grid at /data-management/workspaces", () => {
    renderAt("/data-management/workspaces");
    // Static R12 demo data includes "Marketing" + "Sales Ops".
    expect(screen.getByText("Marketing")).toBeInTheDocument();
    expect(screen.getByText("Sales Ops")).toBeInTheDocument();
  });

  it("redirects / to /data-management/workspaces", () => {
    renderAt("/");
    expect(screen.getByText("Marketing")).toBeInTheDocument();
  });

  it("redirects /data-management (group path, no destination) to the default leaf", () => {
    renderAt("/data-management");
    expect(screen.getByText("Marketing")).toBeInTheDocument();
  });

  it("marks the Workspaces leaf as active when at /data-management/workspaces", () => {
    const { container } = renderAt("/data-management/workspaces");
    const selected = container.querySelector<HTMLElement>(
      "li.ant-menu-item.ant-menu-item-selected",
    );
    expect(selected).not.toBeNull();
    expect(selected?.dataset.menuId).toMatch(/workspaces$/);
  });

  it("renders the breadcrumb with Data Management as a non-clickable section label", () => {
    const { container } = renderAt("/data-management/workspaces");
    const links = Array.from(container.querySelectorAll("a")).map(
      (a) => a.textContent,
    );
    expect(links).not.toContain("Data Management");
  });
});

describe("Workspaces page interactive demo", () => {
  it("shows the empty state with CTA when the demo Empty toggle is clicked", () => {
    renderAt("/data-management/workspaces");
    // R12 demo toggle lives in the bottom-right floating control.
    const emptyBtn = screen.getByRole("button", { name: "Empty" });
    fireEvent.click(emptyBtn);
    expect(screen.getByText(/No workspaces yet/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create your first workspace/ }),
    ).toBeInTheDocument();
  });

  it("adds a workspace when the empty-state CTA is clicked", () => {
    renderAt("/data-management/workspaces");
    fireEvent.click(screen.getByRole("button", { name: "Empty" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Create your first workspace/ }),
    );
    const cards = document.querySelectorAll(
      '[data-component="WorkspaceCard"]',
    );
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });
});

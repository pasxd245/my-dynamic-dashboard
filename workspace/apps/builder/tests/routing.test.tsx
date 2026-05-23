import { AntdConfig } from "@mdd/ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../src/components/AppLayout";
import { DataManagementPage } from "../src/features/data-management/DataManagementPage";

function renderAt(path: string) {
  return render(
    <AntdConfig>
      <MemoryRouter initialEntries={[path]}>
        <AppLayout>
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/data-management" replace />}
            />
            <Route path="/data-management" element={<DataManagementPage />} />
          </Routes>
        </AppLayout>
      </MemoryRouter>
    </AntdConfig>,
  );
}

describe("builder routing", () => {
  it("renders the Data Management placeholder at /data-management", () => {
    renderAt("/data-management");
    expect(
      screen.getByRole("heading", { level: 2, name: "Data Management" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/What will live here/)).toBeInTheDocument();
  });

  it("redirects / to /data-management", () => {
    renderAt("/");
    expect(
      screen.getByRole("heading", { level: 2, name: "Data Management" }),
    ).toBeInTheDocument();
  });

  it("marks the Data nav-item active when on /data-management", () => {
    const { container } = renderAt("/data-management");
    const dataBtn = container.querySelector<HTMLButtonElement>(
      'button[data-key="data-management"]',
    );
    expect(dataBtn).not.toBeNull();
    expect(dataBtn).toHaveAttribute("aria-current", "page");
  });
});

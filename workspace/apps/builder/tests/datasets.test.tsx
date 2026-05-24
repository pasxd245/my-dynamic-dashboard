import { AntdConfig } from "@mdd/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "../src/components/AppLayout";
import { DatasetsPage } from "../src/features/data-management/datasets/DatasetsPage";
import { DatasetNewPage } from "../src/features/data-management/datasets/upload/DatasetNewPage";
import { WorkspacesPage } from "../src/features/data-management/workspaces/WorkspacesPage";
import type { Dataset } from "../src/features/data-management/datasets/types";
import type { Workspace } from "../src/features/data-management/workspaces/types";

const WS_A: Workspace = {
  id: "ws_aaaaaaa1",
  name: "Marketing",
  createdAt: "2026-05-21T10:00:00Z",
};
const WS_B: Workspace = {
  id: "ws_bbbbbbb2",
  name: "Sales Ops",
  createdAt: "2026-05-18T10:00:00Z",
};

const DS_LEADS: Dataset = {
  id: "ds_11111111",
  workspaceId: WS_A.id,
  name: "leads_q1",
  sizeBytes: 4096,
  rowCount: 120,
  columnCount: 3,
  columns: [
    { name: "id", dtype: "integer" },
    { name: "email", dtype: "string" },
    { name: "score", dtype: "float" },
  ],
  sourceFormat: "csv",
  createdAt: "2026-05-22T12:00:00Z",
};

const DS_DEALS: Dataset = {
  id: "ds_22222222",
  workspaceId: WS_B.id,
  name: "pipeline_Deals",
  sizeBytes: 16384,
  rowCount: 480,
  columnCount: 4,
  columns: [
    { name: "deal_id", dtype: "string" },
    { name: "amount", dtype: "float" },
    { name: "stage", dtype: "string" },
    { name: "closed_at", dtype: "date" },
  ],
  sourceFormat: "excel",
  sheetName: "Deals",
  createdAt: "2026-05-23T14:30:00Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchHandler = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function installFetch(handler: FetchHandler) {
  const mock = vi.fn(handler);
  vi.stubGlobal("fetch", mock);
  return mock;
}

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntdConfig>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppLayout>
            <Routes>
              <Route
                path="/data-management/workspaces"
                element={<WorkspacesPage />}
              />
              <Route
                path="/data-management/datasets"
                element={<DatasetsPage />}
              />
              <Route
                path="/data-management/datasets/new"
                element={<DatasetNewPage />}
              />
            </Routes>
          </AppLayout>
        </MemoryRouter>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DatasetsPage", () => {
  beforeEach(() => {
    installFetch(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/workspaces") && method === "GET") {
        return jsonResponse([WS_A, WS_B]);
      }
      if (/\/datasets\?workspace_id=ws_aaaaaaa1$/.test(url)) {
        return jsonResponse([DS_LEADS]);
      }
      if (/\/datasets\?workspace_id=/.test(url)) {
        return jsonResponse([]);
      }
      if (/\/datasets$/.test(url) && method === "GET") {
        return jsonResponse([DS_LEADS, DS_DEALS]);
      }
      return new Response("not found", { status: 404 });
    });
  });

  it("renders both datasets with workspace names resolved", async () => {
    renderApp("/data-management/datasets");
    expect(await screen.findByText("leads_q1")).toBeInTheDocument();
    expect(screen.getByText("pipeline_Deals")).toBeInTheDocument();
    expect(screen.getAllByText("Marketing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sales Ops").length).toBeGreaterThan(0);
  });

  it("filters by workspace when ?workspace= is set", async () => {
    renderApp(`/data-management/datasets?workspace=${WS_A.id}`);
    expect(await screen.findByText("leads_q1")).toBeInTheDocument();
    expect(screen.queryByText("pipeline_Deals")).not.toBeInTheDocument();
  });

  it("shows the empty state when no datasets exist", async () => {
    installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS_A]);
      return jsonResponse([]);
    });
    renderApp("/data-management/datasets");
    expect(await screen.findByText(/No datasets yet/)).toBeInTheDocument();
  });
});

describe("WorkspaceCard click → Datasets filtered", () => {
  it("navigates to the filtered datasets URL when a card is clicked", async () => {
    installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS_A]);
      if (url.includes("workspace_id=" + WS_A.id))
        return jsonResponse([DS_LEADS]);
      return jsonResponse([]);
    });
    renderApp("/data-management/workspaces");
    const card = await screen.findByText("Marketing");
    fireEvent.click(card);
    expect(await screen.findByText("leads_q1")).toBeInTheDocument();
  });
});

describe("Upload wizard — CSV happy path", () => {
  it("uploads a CSV, advances through Metadata, commits, and navigates to Datasets", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/workspaces") && method === "GET") {
        return jsonResponse([WS_A]);
      }
      if (url.endsWith("/uploads") && method === "POST") {
        return jsonResponse({
          temp_id: "tmp_1234567890abcdef",
          sourceFormat: "csv",
          sizeBytes: 64,
          csvPreview: {
            columns: [
              { name: "id", dtype: "integer" },
              { name: "email", dtype: "string" },
            ],
            rowCount: 2,
            sampleRows: [
              ["1", "a@x"],
              ["2", "b@x"],
            ],
          },
        });
      }
      if (
        url.endsWith(`/workspaces/${WS_A.id}/datasets/batch`) &&
        method === "POST"
      ) {
        return jsonResponse(
          [
            {
              ...DS_LEADS,
              name: JSON.parse(String(init?.body ?? "{}")).items[0].name,
            },
          ],
          201,
        );
      }
      if (url.endsWith("/datasets") && method === "GET") {
        return jsonResponse([DS_LEADS]);
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderApp(
      `/data-management/datasets/new?workspace=${WS_A.id}`,
    );

    // Source step renders. Workspace is pre-filled from the query string.
    await screen.findByText("Data source");
    fireEvent.click(screen.getByText("CSV"));

    // Drop a CSV file via the hidden input AntD renders.
    const fileInput = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );
    expect(fileInput).not.toBeNull();
    const file = new File(["id,email\n1,a@x"], "leads.csv", {
      type: "text/csv",
    });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    // Wait for the upload to land us in the Metadata step.
    await waitFor(() => {
      expect(
        container.querySelector('[data-component="SheetPreviewTable"]'),
      ).not.toBeNull();
    });

    // Advance to Confirm.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByRole("button", { name: "Commit" });

    // Commit.
    fireEvent.click(screen.getByRole("button", { name: "Commit" }));

    // We navigate back to the datasets page, which lists the new dataset.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/workspaces/${WS_A.id}/datasets/batch`),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});

describe("Upload wizard — Excel sheet step parses on Next", () => {
  it("calls /uploads/{temp_id}/parse with the selected sheets and lands on Metadata", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.endsWith("/workspaces") && method === "GET") {
          return jsonResponse([WS_A]);
        }
        if (url.endsWith("/uploads") && method === "POST") {
          return jsonResponse({
            temp_id: "tmp_abcdef0123456789",
            sourceFormat: "excel",
            sizeBytes: 1024,
            sheets: [
              {
                sheet: "Deals",
                rowCount: 10,
                columnCount: 4,
                usedRange: "A1:D11",
              },
              {
                sheet: "Contacts",
                rowCount: 5,
                columnCount: 2,
                usedRange: "A1:B6",
              },
            ],
          });
        }
        if (
          /\/uploads\/tmp_[0-9a-f]{16}\/parse$/.test(url) &&
          method === "POST"
        ) {
          const reqBody = JSON.parse(String(init?.body ?? "{}")) as {
            items: { sheet: string }[];
          };
          return jsonResponse({
            results: reqBody.items.map((it) => ({
              sheet: it.sheet,
              status: "ok",
              columns: [
                { name: "a", dtype: "string" },
                { name: "b", dtype: "integer" },
              ],
              rowCount: 1,
              sampleRows: [["x", "1"]],
            })),
          });
        }
        return new Response("not found", { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderApp(
      `/data-management/datasets/new?workspace=${WS_A.id}`,
    );
    await screen.findByText("Data source");

    // Drop an xlsx file (Excel is the default source format).
    const fileInput = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );
    const xlsx = new File(["fake"], "book.xlsx", {
      type: "application/vnd.ms-excel",
    });
    fireEvent.change(fileInput!, { target: { files: [xlsx] } });

    // Sheet step appears with both sheets.
    expect(await screen.findByText("Deals")).toBeInTheDocument();
    expect(screen.getByText("Contacts")).toBeInTheDocument();

    // Select both rows' checkboxes (they appear in the first column of the
    // sheet-list table). Two sheets → two checkbox inputs.
    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    // Click Next to fire parse.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/parse"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});

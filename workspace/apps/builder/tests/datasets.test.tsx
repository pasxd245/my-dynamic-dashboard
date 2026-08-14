import { AntdConfig } from "@mdd/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { DatasetsPage } from "@/features/data-management/datasets/DatasetsPage";
import { DatasetNewPage } from "@/features/data-management/datasets/upload/DatasetNewPage";
import { WorkspacesPage } from "@/features/data-management/workspaces/WorkspacesPage";
import type { Dataset } from "@/features/data-management/datasets/types";
import type { Workspace } from "@/features/data-management/workspaces/types";

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
    expect(
      await screen.findByText(/Upload your first file to get started/),
    ).toBeInTheDocument();
  });

  it("filters by name when the search input is used", async () => {
    renderApp("/data-management/datasets");
    expect(await screen.findByText("leads_q1")).toBeInTheDocument();
    expect(screen.getByText("pipeline_Deals")).toBeInTheDocument();

    const search = screen.getByPlaceholderText("Search datasets…");
    fireEvent.change(search, { target: { value: "leads" } });

    await waitFor(() => {
      expect(screen.queryByText("pipeline_Deals")).not.toBeInTheDocument();
    });
    expect(screen.getByText("leads_q1")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzz_no_match" } });
    expect(await screen.findByText(/No datasets match/)).toBeInTheDocument();
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

    // Wait for the upload to land us in the Metadata step (override table).
    await waitFor(() => {
      expect(
        container.querySelector('[data-component="UploadMetadataStep"]'),
      ).not.toBeNull();
    });

    // Advance to Preview.
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => {
      expect(
        container.querySelector('[data-component="UploadPreviewStep"]'),
      ).not.toBeNull();
    });

    // Advance to Confirm.
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findByRole("button", { name: /Create datasets/ });

    // Commit.
    fireEvent.click(screen.getByRole("button", { name: /Create datasets/ }));

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
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/parse"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});

describe("Upload wizard — coercion_failed 422 renders the typed error (R143)", () => {
  // Walk the CSV wizard to Confirm against a batch endpoint that 422s with
  // the given body; returns after clicking [Create datasets].
  async function walkToBatch422(batchBody: unknown) {
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
              { name: "phone", dtype: "string" },
            ],
            rowCount: 2,
            sampleRows: [
              ["1", "0387353189"],
              ["2", "abc"],
            ],
          },
        });
      }
      if (url.endsWith(`/workspaces/${WS_A.id}/datasets/batch`) && method === "POST") {
        return jsonResponse(batchBody, 422);
      }
      if (url.endsWith("/datasets") && method === "GET") {
        return jsonResponse([]);
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderApp(`/data-management/datasets/new?workspace=${WS_A.id}`);
    await screen.findByText("Data source");
    fireEvent.click(screen.getByText("CSV"));
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["id,phone\n1,0387353189"], "calls.csv", { type: "text/csv" });
    fireEvent.change(fileInput!, { target: { files: [file] } });
    await waitFor(() => {
      expect(container.querySelector('[data-component="UploadMetadataStep"]')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => {
      expect(container.querySelector('[data-component="UploadPreviewStep"]')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findByRole("button", { name: /Create datasets/ });
    fireEvent.click(screen.getByRole("button", { name: /Create datasets/ }));
  }

  const walkToCoercionError = (cells: { row: number; value: string }[], totalFailed: number, dtype = "integer") =>
    walkToBatch422({ code: "coercion_failed", column: "phone", dtype, cells, totalFailed });

  it("R144: a FastAPI string-detail 422 renders its message, not a generic 'Request failed'", async () => {
    // The format_unsupported family: HTTPException(detail=<string>) — no `error`
    // key, no coded envelope. The client folds it into the legacy shape so the
    // wizard shows the actual guidance (finding #6's second half).
    await walkToBatch422({
      detail:
        "format_unsupported: column_overrides[phone] — dtype `date` accepts date tokens only (yyyy MM dd). " +
        "Values that carry a time part need dtype `datetime`; group by day/week later with a Date bucket step.",
    });
    expect(await screen.findByText(/date tokens only/)).toBeInTheDocument();
    expect(screen.queryByText(/Request failed: 422/)).toBeNull();
  });

  it("R144: a failing cell equal to the column name → the repeated-header-row hint", async () => {
    await walkToCoercionError([{ row: 2899, value: "phone" }], 1);
    const desc = await screen.findByText(/phone.*can't convert to.*integer/);
    expect(desc.textContent).toContain("repeated header row");
    expect(desc.textContent).not.toContain("adjust it on the Metadata step");
  });

  it("R144: other failing values → the two-branch wrong-format/wrong-data hint", async () => {
    await walkToCoercionError([{ row: 2, value: "abc" }], 7);
    const desc = await screen.findByText(/phone.*can't convert to.*integer/);
    expect(desc.textContent).toContain("adjust it on the Metadata step");
    expect(desc.textContent).toContain("fix those rows in the source file");
  });

  it("R144: a date target whose failing values carry a time part → the choose-datetime hint", async () => {
    await walkToCoercionError([{ row: 2, value: "07-02-2025 17:52:57" }], 6692, "date");
    const desc = await screen.findByText(/phone.*can't convert to.*date/);
    expect(desc.textContent).toContain("choose datetime instead");
    expect(desc.textContent).toContain("Date bucket step");
  });

  it("shows column, sample cells and count on the Confirm alert; wizard stays put", async () => {
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
              { name: "phone", dtype: "string" },
            ],
            rowCount: 2,
            sampleRows: [
              ["1", "0387353189"],
              ["2", "abc"],
            ],
          },
        });
      }
      if (url.endsWith(`/workspaces/${WS_A.id}/datasets/batch`) && method === "POST") {
        return jsonResponse(
          {
            code: "coercion_failed",
            column: "phone",
            dtype: "integer",
            cells: [{ row: 2, value: "abc" }],
            totalFailed: 7,
          },
          422,
        );
      }
      if (url.endsWith("/datasets") && method === "GET") {
        return jsonResponse([]);
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderApp(
      `/data-management/datasets/new?workspace=${WS_A.id}`,
    );

    await screen.findByText("Data source");
    fireEvent.click(screen.getByText("CSV"));
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["id,phone\n1,0387353189"], "calls.csv", { type: "text/csv" });
    fireEvent.change(fileInput!, { target: { files: [file] } });
    await waitFor(() => {
      expect(container.querySelector('[data-component="UploadMetadataStep"]')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => {
      expect(container.querySelector('[data-component="UploadPreviewStep"]')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findByRole("button", { name: /Create datasets/ });
    fireEvent.click(screen.getByRole("button", { name: /Create datasets/ }));

    // The typed alert renders: title + description naming column, dtype, cells, count.
    expect(
      await screen.findByText(/Some values don't fit the chosen column type/),
    ).toBeInTheDocument();
    const desc = await screen.findByText(/phone.*can't convert to.*integer/);
    expect(desc.textContent).toContain("7");
    expect(desc.textContent).toContain("abc");

    // Wizard stayed on Confirm (no navigation) so the user can adjust.
    expect(screen.getByRole("button", { name: /Create datasets/ })).toBeInTheDocument();
  });

  // R171 item 1 — [F-commit-error-opaque]. The uncoded arm carries two
  // different failures and used to render both raw. They are now told apart.
  it("R171: a pydantic body rejection names the FIELD and reads as an app bug", async () => {
    await walkToBatch422({
      detail: [
        { loc: ["body", "items", 0, "sheetName"], msg: "Extra inputs are not permitted", type: "extra_forbidden" },
      ],
    });
    // The `loc` path survives — without it the message names nothing at all.
    const desc = await screen.findByText(/items\.0\.sheetName/);
    expect(desc.textContent).toContain("Extra inputs are not permitted");
    // …and it is framed as OUR bug, not as advice the user can act on.
    expect(desc.textContent).toContain("a bug in the app, not something you did");
  });

  it("R171: the router's OWN string guidance is NOT reframed as a bug (R144 regression)", async () => {
    await walkToBatch422({
      detail: "format_unsupported: dtype `date` accepts date tokens only (yyyy MM dd).",
    });
    const desc = await screen.findByText(/date tokens only/);
    expect(desc.textContent).not.toContain("a bug in the app");
  });
});

// R171 item 2 — [F-metadata-reset]. A destructive, un-undoable action that
// used to fire on a single click, on a button whose enablement counted
// override ENTRIES rather than actual overrides.
describe("Upload wizard — [Reset all to detected] confirms before wiping (R171)", () => {
  async function walkToMetadata() {
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
              { name: "phone", dtype: "string" },
            ],
            rowCount: 2,
            sampleRows: [
              ["1", "0387353189"],
              ["2", "0912223344"],
            ],
          },
        });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderApp(`/data-management/datasets/new?workspace=${WS_A.id}`);
    await screen.findByText("Data source");
    fireEvent.click(screen.getByText("CSV"));
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["id,phone\n1,0387353189"], "calls.csv", { type: "text/csv" });
    fireEvent.change(fileInput!, { target: { files: [file] } });
    await waitFor(() => {
      expect(container.querySelector('[data-component="UploadMetadataStep"]')).not.toBeNull();
    });
    return container;
  }

  const resetButton = (container: HTMLElement) =>
    container.querySelector<HTMLButtonElement>('[data-component="ResetOverrides"]')!;

  it("is disabled until a real override exists, then confirms with the count before clearing", async () => {
    const container = await walkToMetadata();
    expect(resetButton(container).disabled).toBe(true);

    // Override `phone` (string → integer, a real change vs detected). AntD v6
    // forwards data-* to the `.ant-select` root; mousedown opens the dropdown.
    const select = container.querySelector<HTMLElement>('[data-component="ColumnDtypeSelect"][data-column="phone"]')!;
    fireEvent.mouseDown(select);
    const option = await screen.findByText("integer", {
      selector: ".ant-select-item-option-content,.ant-select-item-option-content *",
    });
    fireEvent.click(option);
    await waitFor(() => {
      expect(select.getAttribute("data-overridden")).toBe("true");
    });
    expect(resetButton(container).disabled).toBe(false);

    // The click asks first — and names how many columns it would revert.
    fireEvent.click(resetButton(container));
    expect(await screen.findByText(/reverts 1 column to its detected type/)).toBeInTheDocument();
    // Nothing cleared yet: the override survives an unconfirmed click.
    expect(select.getAttribute("data-overridden")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: /^Reset$/ }));
    await waitFor(() => {
      expect(select.getAttribute("data-overridden")).toBe("false");
    });
    expect(resetButton(container).disabled).toBe(true);
  });
});

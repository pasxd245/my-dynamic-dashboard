import { AntdConfig } from "@mdd/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { App } from "antd";
import { AppLayout } from "@/components/AppLayout";
import { DatasetDetailPage } from "@/features/data-management/datasets/DatasetDetailPage";
import { DatasetsPage } from "@/features/data-management/datasets/DatasetsPage";
import type { Dataset, RowsPage } from "@/features/data-management/datasets/types";
import type { Workspace } from "@/features/data-management/workspaces/types";

const WS: Workspace = {
  id: "ws_aaaaaaa1",
  name: "Marketing",
  createdAt: "2026-05-21T10:00:00Z",
};

const DS: Dataset = {
  id: "ds_11111111",
  workspaceId: WS.id,
  name: "leads_q1",
  sizeBytes: 4096,
  rowCount: 3,
  columnCount: 4,
  columns: [
    { name: "id", dtype: "integer" },
    { name: "email", dtype: "string" },
    { name: "amount", dtype: "float" },
    { name: "signed_up", dtype: "date" },
  ],
  sourceFormat: "csv",
  createdAt: "2026-05-22T12:00:00Z",
};

const FULL_PAGE: RowsPage = {
  rows: [
    ["1", "alice@example.com", "42.5", "2024-01-15"],
    ["2", "bob@example.com", "17.0", "2024-02-03"],
    ["3", null, "99.9", "2024-03-22"],
  ],
  page: 1,
  pageSize: 50,
  total: 3,
};

const ALICE_PAGE: RowsPage = {
  rows: [["1", "alice@example.com", "42.5", "2024-01-15"]],
  page: 1,
  pageSize: 50,
  total: 1,
};

const NO_MATCH_PAGE: RowsPage = {
  rows: [],
  page: 1,
  pageSize: 50,
  total: 0,
};

const NOT_FOUND_BODY = { code: "not_found" };

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
        <App>
          <MemoryRouter initialEntries={[initialPath]}>
            <AppLayout>
              <Routes>
                <Route
                  path="/data-management/datasets"
                  element={<DatasetsPage />}
                />
                <Route
                  path="/data-management/datasets/:id"
                  element={<DatasetDetailPage />}
                />
              </Routes>
            </AppLayout>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DatasetDetailPage", () => {
  it("renders dataset header, metadata strip, and rows", async () => {
    installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`)) return jsonResponse(DS);
      if (url.includes(`/datasets/${DS.id}/rows`)) return jsonResponse(FULL_PAGE);
      return new Response("not found", { status: 404 });
    });
    renderApp(`/data-management/datasets/${DS.id}`);
    expect((await screen.findAllByText("leads_q1")).length).toBeGreaterThan(0);
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    // Dtype badges are rendered.
    expect(screen.getAllByText("int").length).toBeGreaterThan(0);
    expect(screen.getAllByText("str").length).toBeGreaterThan(0);
    // Matched counter shows the unfiltered total.
    expect(screen.getByText(/Matched 3 \/ 3/)).toBeInTheDocument();
  });

  it("renders null cells as the muted em-dash glyph", async () => {
    installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`)) return jsonResponse(DS);
      if (url.includes(`/datasets/${DS.id}/rows`)) return jsonResponse(FULL_PAGE);
      return new Response("not found", { status: 404 });
    });
    renderApp(`/data-management/datasets/${DS.id}`);
    await screen.findAllByText("leads_q1");
    const nullCells = await screen.findAllByText("—");
    expect(nullCells.length).toBeGreaterThan(0);
  });

  it("debounces ?q= updates and renders the filtered subset", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`)) return jsonResponse(DS);
      if (url.includes(`q=Alice`)) return jsonResponse(ALICE_PAGE);
      if (url.includes(`/datasets/${DS.id}/rows`)) return jsonResponse(FULL_PAGE);
      return new Response("not found", { status: 404 });
    });

    try {
      renderApp(`/data-management/datasets/${DS.id}`);
      await screen.findAllByText("leads_q1");
      const search = await screen.findByPlaceholderText("Search rows…");
      fireEvent.change(search, { target: { value: "Alice" } });
      // Fast-forward past the 300ms debounce.
      vi.advanceTimersByTime(350);
      await waitFor(() => {
        const calls = fetchMock.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => u.includes("q=Alice"))).toBe(true);
      });
      // The matched counter reflects 1 / 3.
      await waitFor(() => {
        expect(screen.getByText(/Matched 1 \/ 3/)).toBeInTheDocument();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders the no-match state with a Clear affordance when total is 0 and q is set", async () => {
    installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`)) return jsonResponse(DS);
      if (url.includes(`/rows`)) return jsonResponse(NO_MATCH_PAGE);
      return new Response("not found", { status: 404 });
    });
    renderApp(`/data-management/datasets/${DS.id}?q=ZZZZZ`);
    await screen.findAllByText("leads_q1");
    expect(await screen.findByText(/No rows match/)).toBeInTheDocument();
    // Two Clear affordances render: the search bar link and the in-state Clear button.
    expect(screen.getAllByText("Clear").length).toBeGreaterThan(0);
  });

  it("renders the 404 'deleted' state when the dataset GET 404s", async () => {
    installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`))
        return jsonResponse(NOT_FOUND_BODY, 404);
      return new Response("not found", { status: 404 });
    });
    renderApp(`/data-management/datasets/${DS.id}`);
    const matches = await screen.findAllByText("This dataset no longer exists");
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText("Back to Datasets")).toBeInTheDocument();
  });
});

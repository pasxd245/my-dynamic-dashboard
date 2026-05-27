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

  // ─── R40: per-column f<N>_* filters ─────────────────────────────────

  it("parses f<N>_* URL params and sends them to the BE on initial render", async () => {
    const fetchMock = installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`)) return jsonResponse(DS);
      if (url.includes(`/rows`)) return jsonResponse(ALICE_PAGE);
      return new Response("not found", { status: 404 });
    });
    // Column 0 is `id` (integer). Pre-set `f0_op=equals&f0_val=1`.
    renderApp(`/data-management/datasets/${DS.id}?f0_op=equals&f0_val=1`);
    await screen.findAllByText("leads_q1");
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(
        calls.some((u) => u.includes(`/datasets/${DS.id}/rows`) && u.includes("f0_op=equals") && u.includes("f0_val=1")),
      ).toBe(true);
    });
  });

  it("renders the active filter chip with formatted value", async () => {
    installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`)) return jsonResponse(DS);
      if (url.includes(`/rows`)) return jsonResponse(ALICE_PAGE);
      return new Response("not found", { status: 404 });
    });
    renderApp(
      `/data-management/datasets/${DS.id}?f1_op=equals&f1_val=alice%40example.com`,
    );
    await screen.findAllByText("leads_q1");
    // Chip text format: "<col> <op> <value>"
    await waitFor(() => {
      expect(screen.getByText(/email equals alice@example.com/)).toBeInTheDocument();
    });
    // The chip row also shows the "Active filters" label and Clear all link.
    expect(screen.getByText("Active filters")).toBeInTheDocument();
    expect(screen.getByText("Clear all")).toBeInTheDocument();
  });

  it("AND-composes ?q= and f<N>_* in the rows-GET URL", async () => {
    const fetchMock = installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`)) return jsonResponse(DS);
      if (url.includes(`/rows`)) return jsonResponse(ALICE_PAGE);
      return new Response("not found", { status: 404 });
    });
    renderApp(
      `/data-management/datasets/${DS.id}?q=alice&f0_op=gt&f0_val=0`,
    );
    await screen.findAllByText("leads_q1");
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(
        calls.some(
          (u) =>
            u.includes(`/datasets/${DS.id}/rows`) &&
            u.includes("q=alice") &&
            u.includes("f0_op=gt") &&
            u.includes("f0_val=0"),
        ),
      ).toBe(true);
    });
  });

  it("renders the filter-only no-match state with a Clear all button", async () => {
    installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`)) return jsonResponse(DS);
      if (url.includes(`/rows`)) return jsonResponse(NO_MATCH_PAGE);
      return new Response("not found", { status: 404 });
    });
    renderApp(`/data-management/datasets/${DS.id}?f0_op=equals&f0_val=999`);
    await screen.findAllByText("leads_q1");
    expect(await screen.findByText("No rows match these filters")).toBeInTheDocument();
    // The in-state Clear all + the chip-row Clear all — both render.
    expect(screen.getAllByText("Clear all").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the combined ?q= + filters no-match state with both Clear affordances", async () => {
    installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`)) return jsonResponse(DS);
      if (url.includes(`/rows`)) return jsonResponse(NO_MATCH_PAGE);
      return new Response("not found", { status: 404 });
    });
    renderApp(
      `/data-management/datasets/${DS.id}?q=ZZZ&f0_op=equals&f0_val=999`,
    );
    await screen.findAllByText("leads_q1");
    expect(
      await screen.findByText(/No rows match.*with these filters/),
    ).toBeInTheDocument();
    // In-state "Clear" (for ?q=) + "Clear all" (for filters) + the chip-row "Clear all".
    expect(screen.getAllByText("Clear").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Clear all").length).toBeGreaterThanOrEqual(1);
  });

  it("removing a chip strips the f<N>_* params from the URL and re-fetches unfiltered", async () => {
    const fetchMock = installFetch(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/workspaces")) return jsonResponse([WS]);
      if (url.endsWith(`/datasets/${DS.id}`)) return jsonResponse(DS);
      if (url.includes("f0_op=")) return jsonResponse(ALICE_PAGE);
      if (url.includes(`/rows`)) return jsonResponse(FULL_PAGE);
      return new Response("not found", { status: 404 });
    });
    renderApp(`/data-management/datasets/${DS.id}?f0_op=equals&f0_val=1`);
    await screen.findAllByText("leads_q1");
    // The chip renders.
    const chip = await screen.findByText(/id equals 1/);
    expect(chip).toBeInTheDocument();
    // AntD <Tag closable> renders a close icon as `.ant-tag-close-icon`.
    const chipContainer = chip.closest('[data-component="ActiveFilterChip"]');
    expect(chipContainer).not.toBeNull();
    const closeBtn = chipContainer!.querySelector('.ant-tag-close-icon');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn!);
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      // After removal: a rows-GET should fire without any f0_* params.
      const lastRowsCall = [...calls].reverse().find((u) => u.includes(`/rows`));
      expect(lastRowsCall).toBeDefined();
      expect(lastRowsCall!.includes("f0_op=")).toBe(false);
    });
  });

  it("OPS_BY_DTYPE matches the R37/R39 vocabulary table verbatim", async () => {
    // Defensive: any amendment to the R37 vocabulary must update both
    // the FE OPS_BY_DTYPE and the BE OPS_BY_DTYPE together. The BE-side
    // R39 test asserts the BE half; this asserts the FE half.
    const { OPS_BY_DTYPE } = await import(
      "@/features/data-management/datasets/filters/types"
    );
    expect(OPS_BY_DTYPE.string).toEqual([
      "contains",
      "equals",
      "starts_with",
      "ends_with",
      "is_empty",
      "is_not_empty",
      "is_null",
      "is_not_null",
    ]);
    expect(OPS_BY_DTYPE.integer).toEqual([
      "equals",
      "ne",
      "gt",
      "lt",
      "gte",
      "lte",
      "between",
      "is_null",
      "is_not_null",
    ]);
    expect(OPS_BY_DTYPE.float).toEqual(OPS_BY_DTYPE.integer);
    expect(OPS_BY_DTYPE.date).toEqual([
      "equals",
      "ne",
      "before",
      "after",
      "between",
      "is_null",
      "is_not_null",
    ]);
    expect(OPS_BY_DTYPE.datetime).toEqual(OPS_BY_DTYPE.date);
    expect(OPS_BY_DTYPE.boolean).toEqual([
      "is_true",
      "is_false",
      "is_null",
      "is_not_null",
    ]);
  });
});

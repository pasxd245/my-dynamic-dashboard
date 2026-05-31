// R36 + R40 dataset-detail tests, R41-migrated to MSW.
//
// Default handlers from `src/mocks/handlers.ts` cover the happy paths;
// per-test `server.use(...)` overrides supply 404s and zero-match
// responses. Request inspection via MSW handlers replaces the prior
// `vi.stubGlobal('fetch')` URL-string assertions — the handler-
// returns-correct-body proves the FE built the right URL.

import { AntdConfig } from "@mdd/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "antd";
import { http, HttpResponse } from "msw";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppLayout } from "@/components/AppLayout";
import { DatasetDetailPage } from "@/features/data-management/datasets/DatasetDetailPage";
import { DatasetsPage } from "@/features/data-management/datasets/DatasetsPage";
import { MOCK_DATASET, MOCK_ROWS } from "@/mocks/fixtures";
import { server } from "@/mocks/server";

const DS_ID = MOCK_DATASET.id;

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

describe("DatasetDetailPage", () => {
  it("renders dataset header, metadata strip, and rows", async () => {
    renderApp(`/data-management/datasets/${DS_ID}`);
    expect((await screen.findAllByText(MOCK_DATASET.name)).length).toBeGreaterThan(0);
    // First row's `stage` cell from MOCK_ROWS.
    expect(await screen.findByText("D-0001")).toBeInTheDocument();
    // Dtype badges are rendered.
    expect(screen.getAllByText("int").length).toBeGreaterThan(0);
    expect(screen.getAllByText("str").length).toBeGreaterThan(0);
    // Matched counter shows the unfiltered total.
    const fullTotal = MOCK_ROWS.length;
    expect(screen.getByText(new RegExp(`Matched ${fullTotal} / ${fullTotal}`))).toBeInTheDocument();
  });

  it("renders null cells as the muted em-dash glyph", async () => {
    renderApp(`/data-management/datasets/${DS_ID}`);
    await screen.findAllByText(MOCK_DATASET.name);
    const nullCells = await screen.findAllByText("—");
    expect(nullCells.length).toBeGreaterThan(0);
  });

  it("debounces ?q= updates and renders the filtered subset", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // The default rows handler implements `?q=` itself, so no override
    // needed — `q=won` matches the rows with `stage=won`.
    try {
      renderApp(`/data-management/datasets/${DS_ID}`);
      await screen.findAllByText(MOCK_DATASET.name);
      const search = await screen.findByPlaceholderText("Search rows…");
      fireEvent.change(search, { target: { value: "won" } });
      // Fast-forward past the 300ms debounce.
      vi.advanceTimersByTime(350);
      // MOCK_ROWS contains 3 rows with stage=won (rows 1, 5, 7).
      await waitFor(() => {
        expect(screen.getByText(/Matched 3 \/ 8/)).toBeInTheDocument();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("pressing Escape in the search box clears ?q= (no stale/null value)", async () => {
    renderApp(`/data-management/datasets/${DS_ID}?q=won`);
    const search = await screen.findByDisplayValue("won");
    fireEvent.keyDown(search, { key: "Escape" });
    // Esc → onClearSearch → q removed → input clears (no stale value).
    await waitFor(() => expect(screen.queryByDisplayValue("won")).toBeNull());
    expect(screen.getByPlaceholderText("Search rows…")).toBeInTheDocument();
  });

  it("pressing Escape in an EMPTY search box inserts no stray value", async () => {
    renderApp(`/data-management/datasets/${DS_ID}`);
    const search = (await screen.findByPlaceholderText("Search rows…")) as HTMLInputElement;
    fireEvent.keyDown(search, { key: "Escape" });
    expect(search.value).toBe("");
    expect(screen.queryByDisplayValue("null")).toBeNull();
  });

  it("the in-field × clears the search box (consistent with advanced query)", async () => {
    const { container } = renderApp(`/data-management/datasets/${DS_ID}?q=won`);
    await screen.findByDisplayValue("won");
    const clear = container.querySelector('[data-component="DatasetRowSearchClear"]') as HTMLElement;
    expect(clear).not.toBeNull();
    expect(clear).toHaveAttribute("aria-label", "Clear");
    fireEvent.click(clear);
    await waitFor(() => expect(screen.queryByDisplayValue("won")).toBeNull());
  });

  it("renders the no-match state with a Clear affordance when total is 0 and q is set", async () => {
    renderApp(`/data-management/datasets/${DS_ID}?q=ZZZZZ`);
    await screen.findAllByText(MOCK_DATASET.name);
    expect(await screen.findByText(/No rows match/)).toBeInTheDocument();
    expect(screen.getAllByText("Clear").length).toBeGreaterThan(0);
  });

  it("renders the 404 'deleted' state when the dataset GET 404s", async () => {
    server.use(
      http.get("*/datasets/:id", () =>
        HttpResponse.json({ code: "not_found" }, { status: 404 }),
      ),
    );
    renderApp(`/data-management/datasets/${DS_ID}`);
    const matches = await screen.findAllByText("This dataset no longer exists");
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText("Back to Datasets")).toBeInTheDocument();
  });

  // ─── R40: per-column f<N>_* filters ─────────────────────────────────

  it("parses f<N>_* URL params and applies them server-side via MSW handler", async () => {
    // The default rows handler filters in JS — `f1_op=equals&f1_val=12400`
    // (amount column, integer) matches one row (D-0001).
    renderApp(`/data-management/datasets/${DS_ID}?f1_op=equals&f1_val=12400`);
    await screen.findAllByText(MOCK_DATASET.name);
    await waitFor(() => {
      expect(screen.getByText(/Matched 1 \/ 8/)).toBeInTheDocument();
    });
    expect(screen.getByText("D-0001")).toBeInTheDocument();
  });

  it("renders the active filter chip with formatted value", async () => {
    renderApp(`/data-management/datasets/${DS_ID}?f3_op=equals&f3_val=won`);
    await screen.findAllByText(MOCK_DATASET.name);
    // Chip text format: "<col> <op-label> <value>"
    await waitFor(() => {
      expect(screen.getByText(/stage equals won/)).toBeInTheDocument();
    });
    expect(screen.getByText("Active filters")).toBeInTheDocument();
    expect(screen.getByText("Clear all")).toBeInTheDocument();
  });

  it("AND-composes ?q= and f<N>_* server-side via MSW", async () => {
    // q=won AND f3_op=equals&f3_val=won — same as q alone here (all q-matched
    // rows have stage=won). Verifies the URL composition + total: 3.
    renderApp(`/data-management/datasets/${DS_ID}?q=won&f3_op=equals&f3_val=won`);
    await screen.findAllByText(MOCK_DATASET.name);
    await waitFor(() => {
      expect(screen.getByText(/Matched 3 \/ 8/)).toBeInTheDocument();
    });
  });

  it("renders the filter-only no-match state with a Clear all button", async () => {
    // f3 = stage (string), equals "nonexistent" → zero matches.
    renderApp(`/data-management/datasets/${DS_ID}?f3_op=equals&f3_val=nonexistent`);
    await screen.findAllByText(MOCK_DATASET.name);
    expect(await screen.findByText("No rows match these filters")).toBeInTheDocument();
    expect(screen.getAllByText("Clear all").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the combined ?q= + filters no-match state with both Clear affordances", async () => {
    renderApp(
      `/data-management/datasets/${DS_ID}?q=ZZZ&f3_op=equals&f3_val=nonexistent`,
    );
    await screen.findAllByText(MOCK_DATASET.name);
    expect(
      await screen.findByText(/No rows match.*with these filters/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Clear").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Clear all").length).toBeGreaterThanOrEqual(1);
  });

  it("removing a chip strips the f<N>_* params from the URL and re-fetches unfiltered", async () => {
    renderApp(`/data-management/datasets/${DS_ID}?f3_op=equals&f3_val=won`);
    await screen.findAllByText(MOCK_DATASET.name);
    // Filtered state: 3 matched.
    await waitFor(() => {
      expect(screen.getByText(/Matched 3 \/ 8/)).toBeInTheDocument();
    });
    const chip = await screen.findByText(/stage equals won/);
    const chipContainer = chip.closest('[data-component="ActiveFilterChip"]');
    expect(chipContainer).not.toBeNull();
    const closeBtn = chipContainer!.querySelector('.ant-tag-close-icon');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn!);
    // Unfiltered state: 8 matched.
    await waitFor(() => {
      expect(screen.getByText(/Matched 8 \/ 8/)).toBeInTheDocument();
    });
  });

  // Guards the chip text/close-icon structure: text in a title-bearing
  // span, close icon as a flex sibling. Regression source: overflow:
  // hidden on the Tag itself clipped AntD's close icon when value long.
  it("wraps chip text in a span with title=full-text and keeps the close icon a sibling", async () => {
    renderApp(`/data-management/datasets/${DS_ID}?f3_op=equals&f3_val=won`);
    await screen.findAllByText(MOCK_DATASET.name);
    const chipContent = await screen.findByText(/stage equals won/);
    // The text lives in an inner span with title=, not directly in the Tag.
    expect(chipContent.tagName).toBe("SPAN");
    expect(chipContent.getAttribute("title")).toContain("stage equals won");
    // The close icon is a SIBLING of that span (so overflow: hidden on
    // the text span can't clip the close icon).
    const chip = chipContent.closest('[data-component="ActiveFilterChip"]');
    expect(chip).not.toBeNull();
    if (!chip) return;
    const closeIcon = chip.querySelector(".ant-tag-close-icon");
    expect(closeIcon).not.toBeNull();
    if (!closeIcon) return;
    expect(closeIcon.parentElement).toBe(chip);
  });

  // Guards the popover-open click path — URL-state-only tests can't
  // catch a trigger that swallows AntD's injected onClick.
  it("clicking the FilterTrigger chevron opens the popover", async () => {
    renderApp(`/data-management/datasets/${DS_ID}`);
    await screen.findAllByText(MOCK_DATASET.name);
    const triggers = document.querySelectorAll('[data-component="FilterTrigger"]');
    expect(triggers.length).toBe(MOCK_DATASET.columns.length);
    // Second column = `name` (string). Click → popover should mount.
    fireEvent.click(triggers[1]);
    await waitFor(() => {
      expect(
        document.querySelector('[data-component="FilterPopoverContent"]'),
      ).not.toBeNull();
    });
    expect(
      document.querySelector('[data-component="FilterOperatorSelect"]'),
    ).not.toBeNull();
  });

  it("OPS_BY_DTYPE matches the R37/R39 vocabulary table verbatim", async () => {
    const { OPS_BY_DTYPE } = await import(
      "@/features/data-management/datasets/filters/types"
    );
    expect(OPS_BY_DTYPE.string).toEqual([
      "contains",
      "equals",
      "ne", // R55
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
      "gte", // R55: inclusive date bounds
      "lte", // R55
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

// R152 (F7) — column show/hide (frontend).
//
// Two layers: (1) PagedRowsView honors the `hidden` view-hint by default with
// correct cell alignment; (2) DatasetDetailPage wires the Columns manager, the
// session-local "show all" override, and the PATCH — while the row-preview is
// the only surface that honors the hint (Q1's load-bearing split).

import { AntdConfig } from "@mdd/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "antd";
import { http, HttpResponse } from "msw";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { AppLayout } from "@/components/AppLayout";
import { DatasetDetailPage } from "@/features/data-management/datasets/DatasetDetailPage";
import { PagedRowsView } from "@/features/data-management/_shared/PagedRowsView";
import type { Column } from "@/features/data-management/datasets/types";
import { MOCK_DATASET } from "@/mocks/fixtures";
import { server } from "@/mocks/server";

const DS_ID = MOCK_DATASET.id;
const HIDDEN_COL = "amount";

// Document-wide queries below assume one active render at a time — reset the
// DOM (incl. AntD portals) between cases.
afterEach(cleanup);

function datasetWithHidden() {
  return {
    ...MOCK_DATASET,
    columns: MOCK_DATASET.columns.map((c) =>
      c.name === HIDDEN_COL ? { ...c, hidden: true } : { name: c.name, dtype: c.dtype },
    ),
  };
}

function headerColumns(): (string | null)[] {
  return [...document.querySelectorAll('[data-component="PagedRowsHeaderCell"]')].map((h) =>
    h.getAttribute("data-column"),
  );
}

function renderDetail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntdConfig>
        <App>
          <MemoryRouter initialEntries={[`/data-management/datasets/${DS_ID}`]}>
            <AppLayout>
              <Routes>
                <Route path="/data-management/datasets/:id" element={<DatasetDetailPage />} />
              </Routes>
            </AppLayout>
          </MemoryRouter>
        </App>
      </AntdConfig>
    </QueryClientProvider>,
  );
}

describe("PagedRowsView — hidden view-hint (R152)", () => {
  const cols: Column[] = [
    { name: "deal_id", dtype: "string" },
    { name: "amount", dtype: "integer", hidden: true },
    { name: "stage", dtype: "string" },
  ];
  const rows = [["D-1", "12400", "won"]];

  function renderRows(showHiddenColumns: boolean) {
    return render(
      <AntdConfig>
        <App>
          <PagedRowsView
            columns={cols}
            showHiddenColumns={showHiddenColumns}
            rows={rows}
            loading={false}
            total={1}
            page={1}
            pageSize={50}
            onPageChange={() => {}}
          />
        </App>
      </AntdConfig>,
    );
  }

  // `amount` renders locale-formatted (e.g. "12,400"); match by digits.
  const amountCell = (content: string) => content.replace(/[^\d]/g, "") === "12400";

  it("default-hides `hidden` columns while keeping cell alignment intact", () => {
    renderRows(false);
    expect(headerColumns()).toEqual(["deal_id", "stage"]);
    // Alignment: the `stage` cell still shows "won" (original row index 2), not
    // the skipped `amount` value — proof the index wasn't shifted by filtering.
    expect(screen.getByText("won")).toBeInTheDocument();
    expect(screen.queryByText(amountCell)).not.toBeInTheDocument();
  });

  it("reveals hidden columns when showHiddenColumns is true", () => {
    renderRows(true);
    expect(headerColumns()).toEqual(["deal_id", "amount", "stage"]);
    expect(screen.getByText(amountCell)).toBeInTheDocument();
  });
});

describe("DatasetDetailPage — Properties drawer (R153)", () => {
  it("default-hides the hidden column, shows N/M, lists all, and reveals via show-all", async () => {
    server.use(http.get("*/datasets/:id", () => HttpResponse.json(datasetWithHidden())));
    renderDetail();

    await waitFor(() =>
      expect(document.querySelector('[data-component="PagedRowsTable"]')).toBeInTheDocument(),
    );
    // Row-preview default: the hidden `amount` header is absent; visible ones present.
    expect(headerColumns()).not.toContain("amount");
    expect(headerColumns()).toContain("deal_id");

    // The toolbar Columns button reads "6/7".
    const button = document.querySelector('[data-component="ColumnsToolbarButton"]') as HTMLElement;
    expect(button.textContent).toContain("6/7");

    // Open the Properties drawer — it lists ALL 7 columns (the only re-show surface).
    fireEvent.click(button);
    await waitFor(() =>
      expect(document.querySelector('[data-component="PropertiesDrawerList"]')).toBeInTheDocument(),
    );
    expect(document.querySelectorAll('[data-component="PropertiesDrawerItem"]')).toHaveLength(7);

    // Dataset section (breadth): the 6 dataset-level facts render above the columns.
    const datasetSection = document.querySelector('[data-component="PropertiesDrawerDataset"]') as HTMLElement;
    expect(datasetSection).toBeInTheDocument();
    expect(datasetSection.children).toHaveLength(6);

    // Flip the session-local "show all" — the hidden column now renders.
    fireEvent.click(document.querySelector('[data-component="PropertiesDrawerShowAll"]') as HTMLElement);
    await waitFor(() => expect(headerColumns()).toContain("amount"));
  });

  it("opens the same drawer from the Actions ▾ → Properties menu item", async () => {
    server.use(http.get("*/datasets/:id", () => HttpResponse.json(datasetWithHidden())));
    renderDetail();

    await waitFor(() =>
      expect(document.querySelector('[data-component="DatasetDetailActionsTrigger"]')).toBeInTheDocument(),
    );
    // Open the Actions menu, then click "Properties".
    fireEvent.click(document.querySelector('[data-component="DatasetDetailActionsTrigger"]') as HTMLElement);
    const item = await screen.findByText("Properties");
    fireEvent.click(item);

    await waitFor(() =>
      expect(document.querySelector('[data-component="PropertiesDrawerList"]')).toBeInTheDocument(),
    );
  });

  it("Apply sends the full hidden set via PATCH /datasets/:id/columns", async () => {
    let captured: { hidden: string[] } | null = null;
    server.use(
      http.get("*/datasets/:id", () => HttpResponse.json(datasetWithHidden())),
      http.patch("*/datasets/:id/columns", async ({ request }) => {
        captured = (await request.json()) as { hidden: string[] };
        return HttpResponse.json(datasetWithHidden());
      }),
    );
    renderDetail();

    await waitFor(() =>
      expect(document.querySelector('[data-component="ColumnsToolbarButton"]')).toBeInTheDocument(),
    );
    fireEvent.click(document.querySelector('[data-component="ColumnsToolbarButton"]') as HTMLElement);
    await waitFor(() =>
      expect(document.querySelector('[data-component="PropertiesDrawerList"]')).toBeInTheDocument(),
    );

    // `amount` starts hidden (unchecked). Also uncheck `stage` → hide it too.
    const stageItem = [...document.querySelectorAll('[data-component="PropertiesDrawerItem"]')].find(
      (el) => el.getAttribute("data-column") === "stage",
    ) as HTMLElement;
    // AntD Checkbox: clicking the wrapper label toggles the input.
    fireEvent.click(stageItem.querySelector('[data-component="PropertiesDrawerItemToggle"]') as HTMLElement);

    fireEvent.click(document.querySelector('[data-component="PropertiesDrawerApply"]') as HTMLElement);

    await waitFor(() => expect(captured).not.toBeNull());
    expect(new Set(captured!.hidden)).toEqual(new Set(["amount", "stage"]));
  });
});

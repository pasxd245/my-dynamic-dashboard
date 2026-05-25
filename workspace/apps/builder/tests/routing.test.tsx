import { AntdConfig } from "@mdd/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { WorkspacesPage } from "@/features/data-management/workspaces/WorkspacesPage";
import type { Workspace } from "@/features/data-management/workspaces/types";

const SAMPLE_WORKSPACES: Workspace[] = [
  { id: "ws_marketing", name: "Marketing", createdAt: "2026-05-21T10:00:00Z" },
  { id: "ws_sales", name: "Sales Ops", createdAt: "2026-05-18T10:00:00Z" },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type FetchMock = ReturnType<typeof vi.fn>;

function installFetchMock(initial: Workspace[]): FetchMock {
  const store = [...initial];
  const mock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/workspaces") && method === "GET") {
        return jsonResponse([...store]);
      }
      if (url.endsWith("/workspaces") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          name: string;
        };
        const created: Workspace = {
          id: `ws_${store.length + 1}`,
          name: body.name,
          createdAt: "2026-05-23T12:00:00Z",
        };
        store.unshift(created);
        return jsonResponse(created, 201);
      }
      return new Response("not found", { status: 404 });
    },
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

function renderAt(path: string) {
  // Per-test QueryClient so a previous test's cache never leaks
  // into the next render. Retries off keeps error-path tests fast.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
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
      </AntdConfig>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("builder routing", () => {
  beforeEach(() => {
    installFetchMock(SAMPLE_WORKSPACES);
  });

  it("renders the Workspaces card grid at /data-management/workspaces", async () => {
    renderAt("/data-management/workspaces");
    expect(await screen.findByText("Marketing")).toBeInTheDocument();
    expect(screen.getByText("Sales Ops")).toBeInTheDocument();
  });

  it("redirects / to /data-management/workspaces", async () => {
    renderAt("/");
    expect(await screen.findByText("Marketing")).toBeInTheDocument();
  });

  it("redirects /data-management (group path, no destination) to the default leaf", async () => {
    renderAt("/data-management");
    expect(await screen.findByText("Marketing")).toBeInTheDocument();
  });

  it("marks the Workspaces leaf as active when at /data-management/workspaces", async () => {
    const { container } = renderAt("/data-management/workspaces");
    await screen.findByText("Marketing");
    const selected = container.querySelector<HTMLElement>(
      "li.ant-menu-item.ant-menu-item-selected",
    );
    expect(selected).not.toBeNull();
    expect(selected?.dataset.menuId).toMatch(/workspaces$/);
  });

  it("renders the breadcrumb with Data Management as a non-clickable section label", async () => {
    const { container } = renderAt("/data-management/workspaces");
    await screen.findByText("Marketing");
    const links = Array.from(container.querySelectorAll("a")).map(
      (a) => a.textContent,
    );
    expect(links).not.toContain("Data Management");
  });
});

describe("Workspaces page data states", () => {
  it("shows the empty state with CTA when the backend returns no workspaces", async () => {
    installFetchMock([]);
    renderAt("/data-management/workspaces");
    expect(await screen.findByText(/No workspaces yet/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create your first workspace/ }),
    ).toBeInTheDocument();
  });

  it("renders an error alert when the GET request fails", async () => {
    const failingFetch = vi.fn(async () => {
      return new Response("boom", { status: 500 });
    });
    vi.stubGlobal("fetch", failingFetch);
    renderAt("/data-management/workspaces");
    expect(
      await screen.findByText(/Couldn't load workspaces/),
    ).toBeInTheDocument();
  });
});

describe("Create workspace flow", () => {
  it("opens the modal, POSTs to the backend, closes, and refetches", async () => {
    const mock = installFetchMock(SAMPLE_WORKSPACES);
    renderAt("/data-management/workspaces");

    // Wait for initial GET to land.
    await screen.findByText("Marketing");

    fireEvent.click(screen.getByRole("button", { name: /Create/ }));

    const dialog = await screen.findByRole("dialog");
    const input = dialog.querySelector("input");
    expect(input).not.toBeNull();
    await act(async () => {
      fireEvent.change(input!, { target: { value: "Finance" } });
    });

    // The OK button label is "Create" — disambiguate by selecting
    // the one inside the dialog footer.
    const okButton = Array.from(
      dialog.querySelectorAll("button"),
    ).find((b) => b.textContent?.trim() === "Create");
    expect(okButton).toBeDefined();

    await act(async () => {
      fireEvent.click(okButton!);
    });

    await waitFor(() => {
      const calls = mock.mock.calls;
      const post = calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST",
      );
      expect(post).toBeDefined();
      expect(String(post?.[1]?.body)).toContain("Finance");
    });

    // After mutation onSuccess invalidates the query, the list
    // refetches and the new workspace appears.
    expect(await screen.findByText("Finance")).toBeInTheDocument();
  });
});

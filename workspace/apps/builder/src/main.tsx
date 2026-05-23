import { AntdConfig } from "@mdd/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { WorkspacesPage } from "./features/data-management/workspaces/WorkspacesPage";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AntdConfig>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/data-management/workspaces" replace />}
              />
              {/*
                Data Management is a sidebar group, not a destination.
                Redirect direct visits (typed URL, bookmark) to the
                default leaf so users don't hit a 404. Default leaf
                decision will need updating if Workspaces stops being
                the first child of the group.
              */}
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
        </BrowserRouter>
      </AntdConfig>
    </QueryClientProvider>
  </StrictMode>,
);

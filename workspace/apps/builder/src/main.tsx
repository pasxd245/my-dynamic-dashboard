import { AntdConfig } from "@mdd/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { DataManagementPage } from "./features/data-management/DataManagementPage";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <AntdConfig>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/data-management" replace />}
            />
            <Route path="/data-management" element={<DataManagementPage />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </AntdConfig>
  </StrictMode>,
);

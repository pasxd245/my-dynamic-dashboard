import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp } from 'antd';
import enUS from 'antd/locale/en_US';
import viVN from 'antd/locale/vi_VN';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
// R89 — React Flow base styles (the query canvas). Imported at the entry so the
// pane's pointer/viewport CSS is always present app-wide (robust to HMR adding a
// side-effect CSS import inside a lazily-mounted component).
import '@xyflow/react/dist/style.css';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
// R32: i18n init must run before any component mounts so the
// initial render sees a populated locale.
import '@/i18n';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AppLayout } from '@/components/AppLayout';
import { NotFoundPage } from '@/components/NotFoundPage';
import { DashboardListPage } from '@/features/dashboard/DashboardListPage';
import { DashboardDetailPage } from '@/features/dashboard/DashboardDetailPage';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { DatasetsPage } from '@/features/data-management/datasets/DatasetsPage';
import { DatasetNewPage } from '@/features/data-management/datasets/upload/DatasetNewPage';
import { QueriesPage } from '@/features/data-management/queries/QueriesPage';
import { QueryDetailPage } from '@/features/data-management/queries/QueryDetailPage';
import { WorkflowsPage } from '@/features/data-management/workflows/WorkflowsPage';
import { WorkflowCreatePage } from '@/features/data-management/workflows/WorkflowCreatePage';
import { WorkflowDetailPage } from '@/features/data-management/workflows/WorkflowDetailPage';
import { WorkspaceRelationshipsPage } from '@/features/data-management/relationships/WorkspaceRelationshipsPage';
import { WorkspacesPage } from '@/features/data-management/workspaces/WorkspacesPage';

// R31: global AntD message defaults — every page that calls
// `App.useApp().message.success(...)` inherits these. Lifts the
// toast position consistently above AppLayout's header (~56px
// content padding + breathing room) and caps the queue so a
// burst of errors doesn't fill the viewport.
const MESSAGE_CONFIG = { top: 64, duration: 3, maxCount: 3 } as const;

// R32: pick the AntD locale pack matching i18next's active language.
// Static map keeps the bundle tree-shake-friendly (only the resolved
// pack ends up live in the bundle's reachable graph).
const ANTD_LOCALES = { en: enUS, vi: viVN } as const;
type AntdLocaleKey = keyof typeof ANTD_LOCALES;

/**
 * R32 add-on: subscribe AntD's `<ConfigProvider locale>` to i18next's
 * language. Without this, AntD's built-in strings (DatePicker, Pagination,
 * Empty) would stay frozen at boot-time locale even after the user flips
 * languages via `LocaleSwitcher`. `useTranslation()` re-renders whenever
 * `i18n.language` changes — that's the subscription mechanism.
 */
function LocaleAwareAntd({ children }: { readonly children: ReactNode }) {
  const { i18n } = useTranslation();
  const key: AntdLocaleKey =
    i18n.language in ANTD_LOCALES ? (i18n.language as AntdLocaleKey) : 'en';
  return (
    <AntdConfig locale={ANTD_LOCALES[key]}>
      <AntdApp message={MESSAGE_CONFIG}>{children}</AntdApp>
    </AntdConfig>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// R30: AppErrorBoundary inside the AntD providers so its <Result>
// inherits theme tokens. R32: i18n + AntD locale subscription.
const appTree = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleAwareAntd>
        <AppErrorBoundary>
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/data-management/workspaces" replace />} />
                {/* R101 — dashboard config/creation lives under /settings; viewing a
                    dashboard is /dashboards/<ws_id>/<slug> (the project is nested in the
                    path; slug is unique per-workspace). Bare /dashboard(s) is not a page →
                    it falls through to the catch-all 404 below. */}
                <Route path="/settings/dashboard" element={<DashboardListPage />} />
                <Route path="/dashboards/:workspaceId/:slug" element={<DashboardDetailPage />} />
                {/* /data-management is a sidebar group, not a leaf — redirect to default child. */}
                <Route path="/data-management" element={<Navigate to="/data-management/workspaces" replace />} />
                <Route path="/data-management/workspaces" element={<WorkspacesPage />} />
                <Route
                  path="/data-management/workspaces/:id/relationships"
                  element={<WorkspaceRelationshipsPage />}
                />
                <Route path="/data-management/datasets" element={<DatasetsPage />} />
                <Route path="/data-management/datasets/new" element={<DatasetNewPage />} />
                {/* R145 — refresh mode reuses DatasetNewPage against an existing dataset. */}
                <Route path="/data-management/datasets/:id/refresh" element={<DatasetNewPage />} />
                <Route path="/data-management/datasets/:id" element={<DatasetDetailPage />} />
                <Route path="/data-management/queries" element={<QueriesPage />} />
                <Route path="/data-management/queries/:id" element={<QueryDetailPage />} />
                <Route path="/data-management/workflows" element={<WorkflowsPage />} />
                <Route path="/data-management/workflows/new" element={<WorkflowCreatePage />} />
                <Route path="/data-management/workflows/:id" element={<WorkflowDetailPage />} />
                {/* Global catch-all — unknown routes (incl. a bare /dashboard) → 404. */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </AppErrorBoundary>
      </LocaleAwareAntd>
    </QueryClientProvider>
  </StrictMode>
);

function renderApp(): void {
  createRoot(rootElement!).render(appTree);
}

// R41/R45: dev-mode MSW opt-in. `builder.enable_mock: true` in
// workspace/config/values.yaml renders VITE_MOCKS=1 into .env;
// import.meta.env.DEV is false in `pnpm build`, so the dynamic
// import branch is statically unreachable in prod (tree-shaken).
// `appTree` MUST be initialized before this block — the `await`
// pauses module eval, and `renderApp` reads `appTree`.
if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === '1') {
  try {
    const { startMockWorker } = await import('@/mocks/start');
    await startMockWorker();
  } catch (error) {
    console.error('Failed to enable mocking:', error);
  } finally {
    renderApp();
  }
} else {
  renderApp();
}

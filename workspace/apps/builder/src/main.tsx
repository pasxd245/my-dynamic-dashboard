import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp } from 'antd';
import enUS from 'antd/locale/en_US';
import viVN from 'antd/locale/vi_VN';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
// R32: i18n init must run before any component mounts so the
// initial render sees a populated locale.
import '@/i18n';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AppLayout } from '@/components/AppLayout';
import { DatasetDetailPage } from '@/features/data-management/datasets/DatasetDetailPage';
import { DatasetsPage } from '@/features/data-management/datasets/DatasetsPage';
import { DatasetNewPage } from '@/features/data-management/datasets/upload/DatasetNewPage';
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

// R41: dev-mode MSW opt-in. `VITE_MOCKS=1 pnpm dev` starts the browser
// worker so the FE round-trips against in-memory fixtures without
// requiring a running BE. Dynamic import keeps MSW out of the
// production bundle (Vite tree-shakes the unreached branch). The
// async startup runs as a fire-and-forget Promise wrapped around
// `renderApp` — avoids top-level await (not available in the
// configured ES target).
function renderApp(): void {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  createRoot(rootElement!).render(appTree);
}

if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === '1') {
  import('@/mocks/start').then(({ startMockWorker }) => startMockWorker().then(renderApp));
} else {
  renderApp();
}

const appTree = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LocaleAwareAntd>
        {/*
          R30: AppErrorBoundary wraps the router so an uncaught render
          error in any feature shows a friendly Result page with a Reload
          button instead of a blank white screen. Placed *inside* the
          AntD providers so the boundary's <Result> picks up theme tokens.
        */}
        <AppErrorBoundary>
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/data-management/workspaces" replace />} />
                {/*
                Data Management is a sidebar group, not a destination.
                Redirect direct visits (typed URL, bookmark) to the
                default leaf so users don't hit a 404. Default leaf
                decision will need updating if Workspaces stops being
                the first child of the group.
              */}
                <Route path="/data-management" element={<Navigate to="/data-management/workspaces" replace />} />
                <Route path="/data-management/workspaces" element={<WorkspacesPage />} />
                <Route path="/data-management/datasets" element={<DatasetsPage />} />
                <Route path="/data-management/datasets/new" element={<DatasetNewPage />} />
                <Route path="/data-management/datasets/:id" element={<DatasetDetailPage />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </AppErrorBoundary>
      </LocaleAwareAntd>
    </QueryClientProvider>
  </StrictMode>
);

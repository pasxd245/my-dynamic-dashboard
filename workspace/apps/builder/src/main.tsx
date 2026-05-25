import { AntdConfig } from '@mdd/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp } from 'antd';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AppLayout } from './components/AppLayout';
import { DatasetsPage } from './features/data-management/datasets/DatasetsPage';
import { DatasetNewPage } from './features/data-management/datasets/upload/DatasetNewPage';
import { WorkspacesPage } from './features/data-management/workspaces/WorkspacesPage';

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

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AntdConfig>
        <AntdApp>
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
                </Routes>
              </AppLayout>
            </BrowserRouter>
          </AppErrorBoundary>
        </AntdApp>
      </AntdConfig>
    </QueryClientProvider>
  </StrictMode>,
);

// R101 F1 — in-memory dashboard store (FE state only, NOT persisted).
//
// F1 validates the builder UX + the Widget shape before the contract freezes,
// so dashboards live in React state here; they do NOT survive reload. The
// Contract + Backend gates (after F1) swap this provider's internals for the
// real `dashboards` API — the component tree above stays unchanged. Kept
// deliberately thin so that swap is a localized change.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Dashboard, Widget } from './types';

/** F1-only id generator (browser crypto). At Backend, ids are server-stamped. */
function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

type DashboardStore = {
  dashboards: readonly Dashboard[];
  get: (id: string) => Dashboard | undefined;
  /** Resolve by slug (the URL identifier). First match wins; slug uniqueness
   *  is enforced at the Contract/Backend gate. */
  getBySlug: (slug: string) => Dashboard | undefined;
  createDashboard: (workspaceId: string, name: string, slug: string) => Dashboard;
  renameDashboard: (id: string, name: string) => void;
  deleteDashboard: (id: string) => void;
  addWidget: (dashboardId: string, widget: Omit<Widget, 'id'>) => void;
  updateWidget: (dashboardId: string, widget: Widget) => void;
  removeWidget: (dashboardId: string, widgetId: string) => void;
};

const DashboardStoreContext = createContext<DashboardStore | null>(null);

export function DashboardStoreProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [dashboards, setDashboards] = useState<readonly Dashboard[]>([]);

  const get = useCallback((id: string) => dashboards.find((d) => d.id === id), [dashboards]);
  const getBySlug = useCallback((slug: string) => dashboards.find((d) => d.slug === slug), [dashboards]);

  const createDashboard = useCallback((workspaceId: string, name: string, slug: string) => {
    const dashboard: Dashboard = { id: newId('dsh'), workspaceId, name, slug, widgets: [] };
    setDashboards((prev) => [...prev, dashboard]);
    return dashboard;
  }, []);

  const renameDashboard = useCallback((id: string, name: string) => {
    setDashboards((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
  }, []);

  const deleteDashboard = useCallback((id: string) => {
    setDashboards((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const addWidget = useCallback((dashboardId: string, widget: Omit<Widget, 'id'>) => {
    setDashboards((prev) =>
      prev.map((d) =>
        d.id === dashboardId ? { ...d, widgets: [...d.widgets, { ...widget, id: newId('wdg') }] } : d,
      ),
    );
  }, []);

  const updateWidget = useCallback((dashboardId: string, widget: Widget) => {
    setDashboards((prev) =>
      prev.map((d) =>
        d.id === dashboardId
          ? { ...d, widgets: d.widgets.map((w) => (w.id === widget.id ? widget : w)) }
          : d,
      ),
    );
  }, []);

  const removeWidget = useCallback((dashboardId: string, widgetId: string) => {
    setDashboards((prev) =>
      prev.map((d) =>
        d.id === dashboardId ? { ...d, widgets: d.widgets.filter((w) => w.id !== widgetId) } : d,
      ),
    );
  }, []);

  const value = useMemo<DashboardStore>(
    () => ({
      dashboards,
      get,
      getBySlug,
      createDashboard,
      renameDashboard,
      deleteDashboard,
      addWidget,
      updateWidget,
      removeWidget,
    }),
    [dashboards, get, getBySlug, createDashboard, renameDashboard, deleteDashboard, addWidget, updateWidget, removeWidget],
  );

  return <DashboardStoreContext.Provider value={value}>{children}</DashboardStoreContext.Provider>;
}

export function useDashboardStore(): DashboardStore {
  const ctx = useContext(DashboardStoreContext);
  if (!ctx) throw new Error('useDashboardStore must be used within DashboardStoreProvider');
  return ctx;
}

/** Tolerant, read-only access to the dashboard list for the nav. Returns `[]`
 *  when rendered outside a provider (e.g. layout-only test harnesses) so the
 *  shell never requires the store just to render the menu. */
export function useDashboardsForNav(): readonly Dashboard[] {
  return useContext(DashboardStoreContext)?.dashboards ?? [];
}

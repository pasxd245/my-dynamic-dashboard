import { useLocation } from "react-router-dom";

export type RouteMeta = {
  /** The WorkspaceShell top-bar title for the active route. */
  title: string;
};

/**
 * R12 / R101: route → shell **title** resolver (pathname switch).
 *
 * Scope is deliberately narrow: this only feeds the WorkspaceShell top-bar
 * title. **Breadcrumbs and subtitles live in each page's own `PageHeader`** —
 * they often need per-page or dynamic data (e.g. the loaded dashboard's name,
 * a 404/edit state) that a static, pathname-keyed map cannot provide. A
 * registry/route-table can land later if more routes accumulate; centralized
 * breadcrumbs would need a richer (loader-data) mechanism than this.
 */
export function useRouteMeta(): RouteMeta {
  const { pathname } = useLocation();

  if (
    pathname === "/data-management/workspaces" ||
    pathname.startsWith("/data-management/workspaces/")
  ) {
    return { title: "Workspaces" };
  }
  if (pathname.startsWith("/dashboards/")) return { title: "Dashboards" };
  if (pathname === "/settings/dashboard") return { title: "Dashboards" };
  if (pathname === "/data-management/datasets/new") return { title: "New dataset" };
  if (
    pathname === "/data-management/datasets" ||
    pathname.startsWith("/data-management/datasets/")
  ) {
    return { title: "Datasets" };
  }
  if (
    pathname === "/data-management/queries" ||
    pathname.startsWith("/data-management/queries/")
  ) {
    return { title: "Queries" };
  }
  return { title: "Home" };
}

import type { BreadcrumbItem } from "@mdd/ui";
import { useLocation } from "react-router-dom";

export type RouteMeta = {
  breadcrumb: BreadcrumbItem[];
  title: string;
  subtitle?: string;
};

/**
 * R12: route → page-header metadata resolver. Switch-case on the
 * pathname for now; a registry/route-table can land later if more
 * routes accumulate.
 *
 * Note: sidebar **section** labels (e.g. "Data Management") have no
 * route — they are non-destination group headers. Only **leaf**
 * routes appear here.
 *
 * BIZ boundary: only the builder imports `react-router-dom`. The
 * `@mdd/ui` PageHeader primitive stays router-agnostic and
 * consumes the resolved `BreadcrumbItem[]`.
 */
export function useRouteMeta(): RouteMeta {
  const { pathname } = useLocation();

  if (
    pathname === "/data-management/workspaces" ||
    pathname.startsWith("/data-management/workspaces/")
  ) {
    return {
      breadcrumb: [
        { label: "Home", route: "/" },
        { label: "Data Management" },
        { label: "Workspaces" },
      ],
      title: "Workspaces",
      subtitle: "Manage logical containers for your data and reports.",
    };
  }

  if (pathname.startsWith("/dashboard/")) {
    return {
      breadcrumb: [
        { label: "Home", route: "/" },
        { label: "Dashboard", route: "/dashboard" },
      ],
      title: "Dashboard",
    };
  }

  if (pathname === "/dashboard") {
    return {
      breadcrumb: [{ label: "Home", route: "/" }, { label: "Dashboard" }],
      title: "Dashboards",
      subtitle: "Live dashboards over your data.",
    };
  }

  if (pathname === "/data-management/datasets/new") {
    return {
      breadcrumb: [
        { label: "Home", route: "/" },
        { label: "Data Management" },
        { label: "Datasets", route: "/data-management/datasets" },
        { label: "New" },
      ],
      title: "New dataset",
      subtitle: "Upload a file and turn it into a queryable dataset.",
    };
  }

  if (
    pathname === "/data-management/datasets" ||
    pathname.startsWith("/data-management/datasets/")
  ) {
    return {
      breadcrumb: [
        { label: "Home", route: "/" },
        { label: "Data Management" },
        { label: "Datasets" },
      ],
      title: "Datasets",
      subtitle: "All tables across your workspaces.",
    };
  }

  if (
    pathname === "/data-management/queries" ||
    pathname.startsWith("/data-management/queries/")
  ) {
    return {
      breadcrumb: [
        { label: "Home", route: "/" },
        { label: "Data Management" },
        { label: "Queries" },
      ],
      title: "Queries",
      subtitle: "Saved views across your workspaces.",
    };
  }

  return {
    breadcrumb: [{ label: "Home" }],
    title: "Home",
  };
}

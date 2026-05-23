// Look-and-feel primitives only. Components with domain knowledge
// (CRM, schema, query) belong in `apps/builder/src/features/`.
// See workspace/packages/ui/README.md for the boundary rule.
export { WorkspaceShell } from "./WorkspaceShell";
export type {
  NavItem,
  NavGroup,
  WorkspaceShellProps,
} from "./WorkspaceShell";
export { PageCard } from "./PageCard";
export type { PageCardProps } from "./PageCard";
export { PageHeader } from "./PageHeader";
export type { BreadcrumbItem, PageHeaderProps } from "./PageHeader";

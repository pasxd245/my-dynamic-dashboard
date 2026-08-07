---
type: UI package
title: Shared UI package
description: The @mdd/ui public export surface, theme and provider ownership, reusable layout components, consumer boundary, and validation.
tags: [ui, design-system, frontend]
---

# Shared UI package

`workspace/packages/ui` is the private `@mdd/ui` look-and-feel package consumed by the builder. It exposes source TypeScript directly through package export maps; it is not an independent built artifact.

## Public surface

The root entry `src/index.ts` exports `themeTokens`, `layoutTokens`, Ant Design configuration/provider components, and reusable layout primitives: `WorkspaceShell`, `PageCard`, `PageContainer`, and `PageHeader` plus their public prop types. Package subpath exports provide focused imports for `./themeTokens`, `./Providers`, `./Components`, `./Icons`, and `./Utils`.

`AntdConfig` is the builder’s app-wide provider boundary; `main.tsx` imports it as `@mdd/ui`. The package declares React, React DOM, Ant Design and icons as peer dependencies, so consumers—not this package—supply compatible instances. Avoid importing deep private implementation files from builder; use the package root or declared subpaths to preserve the boundary.

## WorkspaceShell navigation contract

`WorkspaceShell` owns the application chrome: a collapsible light `Layout.Sider`, selected-menu state through `activeKey`, a caller-owned `onSelect`, top-bar header/title and right `headerExtra` slots, optional home-action brand, optional build footer, and scrollable content. It accepts either a flat `items: NavItem[]` list or grouped `groups: NavGroup[]`, never both. A `NavGroup` becomes an Ant Design submenu; each `NavItem` may recursively contain one nested level of children, also rendered as a submenu. `defaultExpanded` opens that group and all nested submenu keys when the sidebar is expanded, so grouped workspace/dashboard navigation exposes its leaves initially. Leaf keys are the only selectable route keys; the builder maps selection to navigation.

A shell change therefore affects both responsive/collapse behavior and the builder’s `AppLayout` navigation model. Preserve the discriminated props shape, recursion-to-menu conversion, selected key forwarding, and accessible toggle/home labels; test the package component and builder routing/layout consumer together when changing those boundaries.

## Change recipe

For a new reusable primitive, implement it under the relevant source area, export it from that area’s barrel when it is a declared subpath surface, add its root export if intended for general consumption, and add a focused package test. Then update the builder consumer through `@mdd/ui`, not a relative package source path. Theme-token changes should be checked against the builder’s visual/provider usage and `pnpm design:tokens` where applicable.

Run `pnpm --filter @mdd/ui type-check` and `pnpm --filter @mdd/ui test`; add builder validation when changing an export currently consumed by `src/main.tsx` or layout components.

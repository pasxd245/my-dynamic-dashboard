# FE icons — use `@phosphor-icons/react`, not `@ant-design/icons`

**Date**: 2026-05-30
**Agent**: claude-opus-4-8
**Confidence**: High
**Status**: New

## Problem

The builder app is migrating its icon library from
`@ant-design/icons` to
[`@phosphor-icons/react`](https://github.com/phosphor-icons/react)
(`^2.1.10`, in `workspace/apps/builder/package.json`). New FE code
kept reaching for `@ant-design/icons` (e.g. R54's `AdvancedQueryHelp`
used `QuestionCircleOutlined`, `AdvancedQueryInput` used
`CloseCircleFilled`) — the user flagged it: _"we already migrated…
but you're still sticking with antd-icons."_

## Convention

- **New / touched FE code uses `@phosphor-icons/react`.** Import the
  **`*Icon`-suffixed** export, size with the `size` prop (px number),
  and set fill via `weight` — not antd's `fontSize` style or the
  `*Outlined`/`*Filled` name variants. Canonical example:
  [`FilterPopover.tsx`](../../workspace/apps/builder/src/features/data-management/datasets/filters/FilterPopover.tsx)
  → `<FunnelIcon size={18} weight={active ? 'fill' : 'regular'} />`.
- Phosphor icons spread extra props onto their `<svg>`, so
  `onClick` / `role` / `aria-label` / `data-*` / `style` (incl.
  `color`, which maps to `currentColor`) work directly.
- Rough name mapping: `QuestionCircleOutlined` → `QuestionIcon`;
  `CloseCircleFilled` → `<XCircleIcon weight="fill" />`;
  `FunnelOutlined` → `FunnelIcon`.

## Caveat — migration is incomplete

Despite "already migrated", **~10 files still import
`@ant-design/icons`** (e.g. `DatasetDetailPage`, `AppLayout`,
`WorkspacesPage`, `DatasetsPage`, the upload steps, `LocaleSwitcher`,
`BlockedDeleteModal`). Don't assume a file is phosphor-only. A
dedicated migration round to finish the sweep is a candidate
follow-up; until then, at least keep **new** icons on phosphor.

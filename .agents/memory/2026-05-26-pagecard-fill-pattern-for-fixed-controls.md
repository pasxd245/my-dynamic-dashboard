# Pages with fixed-position controls must use `PageCard variant="fill"`

**Date**: 2026-05-26
**Agent**: claude-opus-4-7
**Confidence**: High
**Status**: New

## Problem

R36's `DatasetDetailPage` shipped with three layout bugs I hit
sequentially:

1. **Pagination floating in mid-card** instead of pinned to the bottom.
2. **Sticky `<th>` bleed-through** — `var(--ant-color-fill-quaternary)`
   resolves to `rgba(0,0,0,0.02)`; rows showed through the header.
3. **`maxHeight: 60vh` on the table container** capping the table at
   an arbitrary viewport fraction, creating an internal scroll that
   didn't match the surrounding chrome.

Each looked like a small CSS bug; all three were symptoms of one
architectural choice — letting the page grow to content height instead
of bounding it to the viewport. The user finally pointed me at
`DatasetNewPage.tsx`, which already had the correct pattern. Three
false-start fixes could have been one.

## Finding

For **this codebase**, any feature page that needs _any_ of the
following must use the **fixed-viewport-height + `PageCard
variant="fill"`** pattern, **not** ad-hoc `maxHeight` / `sticky`
tricks:

- A control bar pinned to the bottom (wizard nav, pagination footer).
- A sticky table/list header that should pin while the body scrolls.
- A scrollable middle section bounded by fixed-height top and bottom
  sections.

Without this pattern, `position: sticky` has no scroll container to
stick within, and bottom bars float wherever the content ends.

## The recipe

```tsx
<div
  data-component="MyPage"
  style={{
    // WorkspaceShell math: Layout.Header (56) + Content padding (16×2)
    // = 88px. Both constants are owned by WorkspaceShell.
    height: 'calc(100vh - 88px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  }}
>
  <PageHeader ... />                    {/* sizes to content */}
  <PageCard variant="fill">             {/* flex: 1 1 auto; minHeight: 0 */}
    <div style={{ flex: '0 0 auto' }}>{/* top section */}</div>
    <div style={{ flex: '0 0 auto' }}>{/* more top sections */}</div>
    <div
      style={{
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'auto',             /* THIS is the scroll container */
      }}
    >
      {/* table, list, or other scrollable body.
          Sticky <th> works here because this div bounds it. */}
    </div>
    <div
      style={{
        flex: '0 0 auto',
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
      }}
    >
      {/* footer: pagination, wizard nav, save bar, etc. */}
    </div>
  </PageCard>
</div>
```

## Evidence

- Canonical consumer: [`DatasetNewPage.tsx`](../../workspace/apps/builder/src/features/data-management/datasets/upload/DatasetNewPage.tsx#L249-L322)
  (R17 wizard).
- Second consumer (this round): [`DatasetDetailPage.tsx`](../../workspace/apps/builder/src/features/data-management/datasets/DatasetDetailPage.tsx#L315-L433)
  (R36 detail page; landed after three false-start fixes).
- The `PageCard variant="fill"` API: [`PageCard.tsx`](../../workspace/packages/ui/src/Components/PageCard.tsx#L13-L19).

## Recommendation

**Do**:

- For any new page that needs a bottom-pinned control bar or a sticky
  scrollable region, start from the recipe above. Don't try
  `maxHeight: Xvh`, `position: sticky` without a scroll container, or
  `overflow: auto` on intermediate divs.
- For solid backgrounds inside a sticky header (or anywhere over a
  scroll body), use a **literal hex** (`#fafafa`, `#fff`) — not
  `var(--ant-color-fill-*)`. AntD's fill-\* tokens are all
  `rgba(0,0,0,0.0X)` and bleed through.
- When a design preview shows a fixed footer or sticky header, treat
  it as a signal to reach for this pattern, not as CSS to retrofit
  later.

**Don't**:

- Bound a page-internal scroll with `maxHeight: Xvh` — arbitrary,
  non-responsive, and orthogonal to WorkspaceShell's actual chrome
  math.
- Use `position: sticky` on a `<th>` without bounding it inside an
  `overflow: auto` ancestor — falls back to `static`, or worse,
  sticks to the page viewport and overlaps the page header.
- Reach for `--ant-color-fill-quaternary` (or any other fill token)
  for an element that overlays a scrolling region.

## Promotion Candidate?

- [x] `context/` — once a third consumer arrives (likely the
      future query-results or dashboard page), promote the recipe to
      `.agents/context/page-layouts.md` and consider extracting a
      `<PageCardFillTemplate>` helper. Per
      [ui-boundary-build-first](2026-05-22-ui-boundary-build-first.md),
      hold off until two consumers exist; we now have two — third is
      the trigger.
- [ ] `skills/` — not yet a procedure, just a pattern.
- [ ] Not yet.

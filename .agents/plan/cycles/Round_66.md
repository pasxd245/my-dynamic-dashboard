# Round 66: Doc↔source-of-truth token-map parity — reconcile the cited token surface

**Status**: Planning
**Date started**: 2026-06-12
**Date completed**:

## Goal

**Inherits from ← [R65](Round_65.md)** — a `data-management` design
corpus that fully conforms to the five doc-format conventions, with an
**empty** lint baseline. R64 enforced token-map **presence**; R65
enforced **citation form** (every map names `themeTokens.ts` or an AntD
seed token) and backfilled the 8 docs.

R66 closes the last thread: **value/identifier parity** — does each
token-map row cite a token that *actually exists in the source of
truth*, with a *correct* value? A presence + form check (R64/R65)
cannot see a stale or wrong cite; R66 is the linter that can.

_Track: 2 (agent-method / doc-format). Pulled by ← [R65](Round_65.md)
"Feeds into → Round_66"._

## Discovery at Plan time (2026-06-12) — the cited surface is stale corpus-wide

Grounding the plan in the real token infrastructure surfaced a finding
bigger than "a few values drifted":

- **Every** token map in the corpus (the R65-authored five **and** the
  pre-existing [`dataset-detail.md`](../../design/data-management/dataset-detail.md)
  / [`dataset-filters.md`](../../design/data-management/dataset-filters.md)
  maps they were modelled on) cites `--color-*` / `--radius-*` CSS
  variables and a "`tokens.css` mirror of themeTokens.ts".
- That `tokens.css` exists **only** under
  [`.agents/design/_archive/_css/tokens.css`](../../design/_archive/_css/tokens.css)
  — an **archived** preview convenience that fed the retired
  `.preview.html` HIxAI aids. It is not consumed by the app.
- **No live app code** defines or references those `--color-*` /
  `--radius-*` variables (`grep var(--color-` over `workspace/apps` +
  `workspace/packages` → 0 hits).
- The **actual** theme surface is
  [`themeTokens.ts`](../../../workspace/packages/ui/src/themeTokens.ts)
  — six seed tokens (`colorPrimary`, `colorBgBase`, `colorTextBase`,
  `borderRadius`, `fontFamily`, `fontSize`) handed to AntD
  `<ConfigProvider theme={themeTokens}>`
  ([`AntdConfig.tsx`](../../../workspace/packages/ui/src/Providers/AntdConfig.tsx)).
  AntD derives everything else internally (exposed at runtime as
  `--ant-*` tokens), so cited names like `--color-bg-layout` /
  `--color-fill-quaternary` map to AntD's `colorBgLayout` /
  `colorFillQuaternary`, **not** to a project-owned CSS layer.

So the corpus's token vocabulary points at an archived mirror, not the
live source of truth. This is exactly the drift R66 was conceived to
catch — and it means R66 is **reconcile the cited surface**, not merely
**spot-check a handful of values**. (It does *not* invalidate R65: L3
only ever checked presence + form, which still hold.)

## Judgment calls to ratify before any linter or re-cite is written

> **PAUSE here for ratification** (mirrors R64/R65's Plan-gate pause).
> J-1 is load-bearing — the linter's whole design and any corpus
> re-cite depend on it.

- **J-1 — What is the authoritative token surface the linter checks
  against?**
  - **(A) `themeTokens.ts` seed + AntD's derived token registry.** The
    true runtime surface. The linter resolves each cited concept to an
    AntD token name (`colorBgLayout`, `colorFillQuaternary`, …) and
    verifies it exists (and, per J-2, its value). Implies a **corpus
    re-cite** from the `--color-*` / `tokens.css` vocabulary to AntD
    token names — the docs stop citing an archived file.
  - **(B) Re-home a live design-token CSS layer.** Un-archive / promote
    `tokens.css` into the app (or `@mdd/ui`) as a real mirror the app
    actually consumes, making the existing `--color-*` cites valid
    going forward. Larger blast radius (touches app theming) but
    preserves the docs' current vocabulary.
  - **(C) `themeTokens.ts`-only, narrow.** The linter verifies only the
    six real seed tokens; `--color-*` / derived cites stay informational
    and unchecked. Smallest scope, but catches little — and leaves the
    archived-mirror citation in place.
- **J-2 — Does the linter verify the `Value` column, or only that the
  cited token identifier exists?** The template marks `Value
  (informational)`; a strict reading checks `colorPrimary == #1677ff`,
  a lenient one checks identifier-existence only.
- **J-3 — If J-1 = A, is the corpus re-cite in R66 or a follow-on?**
  The linter and the 8-doc re-cite are separable; decide whether R66
  ships both or lands the linter + re-cites incrementally.

## Plan (by step) — provisional, pending J-1

1. **Ratify J-1/J-2/J-3** and record in Do.
2. **Build the parity check** (extends
   [`scripts/design-doc-lint.mjs`](../../../scripts/design-doc-lint.mjs)
   as an `L6-token-parity` rule, or a sibling script) per J-1: parse
   each Token-map table, resolve each cited token against the chosen
   source of truth, and flag non-existent / mismatched cites.
3. **(if J-1 = A) re-cite the corpus** from `--color-*` / `tokens.css`
   to AntD token names; **(if J-1 = B)** promote a live `tokens.css`
   and wire it; **(if J-1 = C)** scope the check to the seed tokens.
4. **Baseline policy** — decide whether any unavoidable mismatch is
   grandfathered (with a named reason) or fixed in-round; target a
   clean parity run.
5. **Verify** — parity check green; `pnpm design:lint` still 0/0;
   `markdownlint-cli2` 0 errors; `check_links.py --changed` exit 0.

## Acceptance criteria

- [ ] **J-1 + J-2 (+ J-3)** ratified and recorded in Do.
- [ ] A token-map **parity check** exists and runs in the post-round
      audit, resolving cites against the ratified source of truth.
- [ ] The `data-management` token-map corpus **passes** the parity
      check (or any residual is grandfathered with a named reason).
- [ ] No regression: `design:lint` 0/0, `markdownlint` 0 errors,
      `check_links --changed` exit 0.

## What is OUT of scope

- Re-running the **presence/form** rules (R64/R65 own those; R66 only
  adds value/identifier parity).
- Token reconciliation **outside** `data-management` (no other domain
  has token maps yet).
- A visual/theme redesign — R66 reconciles *what the docs cite* with
  *what the app uses*; it does not change the app's actual palette.

## Risks / unknowns

- **J-1 = B is a real app-surface change**, not a docs-only round — it
  touches `@mdd/ui` theming and must not alter rendered output.
- **AntD derived-token enumeration** (for J-1 = A) — the linter needs a
  reliable list of valid AntD token names; pin it against the installed
  `antd` version rather than a hand-maintained allow-list that re-drifts.
- **Re-cite churn (J-1 = A)** edits all 8 maps again, one round after
  R65 authored five of them — additive/citation-only, but verify no
  acceptance-criteria or scope content is disturbed.

## Do

_(filled once J-1/J-2/J-3 are ratified and the work runs)_

## Check

- [ ] _(verification evidence — filled during the round)_

## Act

_(filled at round close)_

---

> **PAUSED at the Plan gate.** The Plan-time discovery (token maps cite
> an archived `tokens.css` / `--color-*` namespace, not the live
> `themeTokens.ts` + AntD surface) makes **J-1** the pivotal call.
> Ratify J-1/J-2/J-3 before any linter or corpus re-cite is written.

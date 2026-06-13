# Round 66: Doc↔source-of-truth token-map parity — reconcile the cited token surface

**Status**: Complete
**Date started**: 2026-06-12
**Date completed**: 2026-06-12

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
  pre-existing [`dataset-detail.md`](../../design/data-management/datasets/dataset-detail.md)
  / [`dataset-filters.md`](../../design/data-management/datasets/dataset-filters.md)
  maps they were modelled on) cites `--color-*` / `--radius-*` CSS
  variables and a "`tokens.css` mirror of themeTokens.ts".
- That `tokens.css` exists **only** under
  `../../design/_archive/_css/tokens.css`
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
   [`scripts/lint/design-doc-lint.mjs`](../../../scripts/lint/design-doc-lint.mjs)
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

- [x] **J-1 + J-2 + J-3** ratified and recorded in Do (A /
      identifier-existence / ship-together).
- [x] A token-map **parity check** exists
      ([`design-token-parity.mjs`](../../../scripts/lint/design-token-parity.mjs),
      `pnpm design:tokens`) and is wired into the PDCA post-round audit,
      resolving cites against the live AntD registry.
- [x] The `data-management` token-map corpus **passes** the parity
      check (8/8 maps, no grandfathered residual).
- [x] No regression: `design:lint` 0/0, `markdownlint` 0 errors (156
      files), `check_links --changed` exit 0.

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

### J-1 / J-2 / J-3 ratification (2026-06-12, at the Plan gate)

- **J-1 → (A) `themeTokens.ts` seed + AntD's derived token registry.**
  The authoritative surface is what the app actually renders: the six
  seeds in
  [`themeTokens.ts`](../../../workspace/packages/ui/src/themeTokens.ts)
  plus everything AntD derives from them. The linter resolves the live
  registry via `theme.getDesignToken()` from the installed `antd`
  (v6.4.3 → 534 tokens) and checks each cited identifier against it.
- **J-2 → identifier-existence.** The check asserts each cited token
  **name** resolves in the registry; the informational `Value` column
  is not asserted against the resolved value (robust across `antd`
  version bumps).
- **J-3 → ship the linter AND the corpus re-cite together.** Landing
  the linter alone would red-flag every token map on day one (they all
  cite the archived `--color-*` / `tokens.css` vocabulary). Re-citing in
  the same round keeps the parity run green and avoids re-introducing
  the warn-only grandfather pattern R65 just drained.

### Resolution mechanism (verified at Plan time)

`antd` is a `workspace/packages/ui` dependency, not resolvable from
repo-root. The script anchors resolution with
`createRequire(workspace/packages/ui/package.json)` →
`require.resolve('antd')` → dynamic import → `theme.getDesignToken()`.
Confirmed: all re-cited token names (`colorBgLayout`,
`colorFillQuaternary`, `boxShadowTertiary`, `borderRadius`,
`fontFamily`, …) resolve.

### `--var → AntD token` re-cite map (from the archived mirror)

| Archived `--color-*` cite | AntD token        |
| ------------------------- | ----------------- |
| `--color-primary`         | `colorPrimary`    |
| `--color-bg-base`         | `colorBgBase`     |
| `--color-bg-layout`       | `colorBgLayout`   |
| `--color-text-base`       | `colorText`       |
| `--color-text-secondary`  | `colorTextSecondary` |
| `--color-text-tertiary`   | `colorTextTertiary`  |
| `--color-border`          | `colorBorder`     |
| `--color-border-secondary`| `colorBorderSecondary` |
| `--color-fill-quaternary` | `colorFillQuaternary`  |
| `--color-primary-bg`      | `colorPrimaryBg`  |
| `--color-primary-bg-hover`| `colorPrimaryBgHover` |
| `--color-primary-hover`   | `colorPrimaryHover` |
| `--color-success`         | `colorSuccess`    |
| `--color-warning`         | `colorWarning`    |
| `--color-error`           | `colorError`      |
| `--shadow-card`           | `boxShadowTertiary` |
| `--radius-md`             | `borderRadius`    |
| `--radius-lg`             | `borderRadiusLG`  |
| `--font-family`           | `fontFamily`      |

### Execution

1. **Built the parity linter** —
   [`scripts/lint/design-token-parity.mjs`](../../../scripts/lint/design-token-parity.mjs):
   resolves the live AntD registry, extracts backticked camelCase token
   claims from each Token-map section, and emits `P1-stale-cite` (any
   `tokens.css` / `--css-var`) + `P2-unknown-token` (a cited id not in
   the registry). Wired as `pnpm design:tokens` and into the PDCA audit.
   First run flagged all 7 `--color-*`-citing maps; `workspace-shell.md`
   already passed (it cited AntD names).
2. **Re-cited the corpus** — rewrote the 7 token maps (advanced-query,
   crud-hygiene, datasets, upload, workspaces + the two pre-existing
   dataset-detail / dataset-filters maps) from the archived
   CSS-variable / `tokens.css` vocabulary to live AntD token names per
   the J-1 map above; informational `Value` column carries the resolved
   values. Each map still links `themeTokens.ts`, so L3 (form) stays
   green. (A self-inflicted false positive — the literal pattern in the
   "re-cited off the archived …" prose — was reworded.)
3. **No corpus content disturbed** beyond the token-map sections — the
   R65 acceptance-criteria + scope-boundary sections are untouched.

## Check

- [x] **`pnpm design:tokens`** → `0 parity error(s) across 8 token
      map(s)`. All cited identifiers resolve in the live AntD registry.
- [x] **`pnpm design:lint`** → `0 error(s), 0 grandfathered warning(s)
      across 9 doc(s)` — L3 (presence + form) still passes; every
      re-cited map still names `themeTokens.ts`.
- [x] **`markdownlint-cli2`** repo-wide → `0 error(s)` (156 files).
- [x] **`check_links.py --changed`** → exit 0 (9 `.md` files); the new
      `design-token-parity.mjs` cross-links resolve.

## Act

**Outcome: the doc-format thread is complete through both *form* and
*value*.** R64 added the lint; R65 made the corpus conform (presence +
form) and emptied the baseline; R66 adds **identifier parity** and
re-cites the corpus to the live source of truth.

**The finding that justified the round.** Plan-time grounding showed the
*entire* token-map corpus cited an **archived** `tokens.css` /
`--color-*` namespace that no live app code consumes — a systematic
source-of-truth drift a presence + form check (R64/R65) structurally
cannot see. This is the worked example for why value/identifier parity
is a distinct rule, not a stricter L3.

**Judgment calls.** J-1 = A (themeTokens.ts seed + AntD derived registry
as the authority) → the linter resolves the live `theme.getDesignToken()`
set rather than a hand-maintained allow-list that would re-drift on an
`antd` bump. J-2 = identifier-existence (the informational `Value`
column is not asserted). J-3 = ship linter + re-cite together (avoids
re-introducing the warn-only grandfather pattern R65 drained).

**Doctrine established.** Token maps cite **live AntD / themeTokens token
names**, never the archived `tokens.css` mirror. `pnpm design:tokens`
enforces it in the post-round audit. The archived mirror stays in
`_archive` as the historical preview aid it always was.

**Lifecycle.** All 8 docs amended in place (token-map sections only).
package.json + PDCA audit gained the `design:tokens` wiring. No
supersession, no fold.

**Track 2 (agent-method / doc-format) — thread closed.** Presence (R64),
form (R64/R65), and identifier parity (R66) now all hold and are
audit-enforced. No successor round is queued; the next doc-format work
is reactive (a new domain's first design doc, or an `antd` major bump
that renames tokens — `design:tokens` would catch the latter).

**Follow-up (not a promotion) — round-structure conventions are not
linted.** This round's review caught that R66 (and earlier R63) shipped
without the template's outbound `Feeds into →` section. The convention
is defined in [PDCA.md](../PDCA.md) three times (Cycle Template → Act;
the Round Template skeleton; the post-round audit's "Cross-links
present" item) — but the audit item is the only **manual** gate left in
a checklist whose siblings (`markdownlint`, `design:lint`,
`design:tokens`) are all scripts. Same lesson as the R56–R64 design
audit: defined + templated but unlinted ⇒ it recurs. Candidate next
round: a `scripts/lint/round-lint.mjs` (`pnpm plan:lint`) that mechanically
checks each round file for its required sections and replaces the manual
checkbox.

## Feeds into → (no successor queued)

R66 closes the Track-2 doc-format thread; nothing is handed to a
specific next round. When doc-format work is next pulled it inherits
from here:

- A **new domain's first design doc** — `_TEMPLATE.md` + `design:lint` +
  `design:tokens` apply unchanged.
- An **`antd` major bump** renaming tokens — `design:tokens` is the
  tripwire; this round's Do is the worked re-cite example.
- A **round-structure lint** — the gap noted in the follow-up above; the
  natural R67 if pulled.

---

> **CLOSED 2026-06-12.** J-1/J-2/J-3 ratified at the Plan gate (A /
> identifier-existence / ship-together); the parity linter
> ([`design-token-parity.mjs`](../../../scripts/lint/design-token-parity.mjs))
> was built and wired into the audit, and all 8 token maps were re-cited
> off the archived mirror onto live AntD token names. All gates green
> (see Check). The doc-format thread (presence + form + value parity) is
> complete and audit-enforced; no successor round queued.

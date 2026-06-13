# Round 59: Design-corpus audit — surface 4, `workspaces`

**Status**: Complete
**Date started**: 2026-06-01
**Date completed**: 2026-06-01

## Goal

**Inherits from ← [Round_58](Round_58.md)**: audit surface 4 of the
**design-corpus conformance audit**
([program plan](../programs/design-corpus-audit.plan.md)) —
[workspaces](../../design/data-management/workspaces/workspaces.md) — against the
**stable rubric** (A3 owns tokens; B6 defers). Straight conformance pass.

_Track: 2 (agent-method). Pulled by: design-corpus-audit program, surface
4 + R58 completion._

## Flow (audit reframe — see program plan)

Not a delivery chain — `workspaces` is already shipped. **D** = does the
doc conform to gate + README format; **C/F/B/I** = verify the shipped
FE/BE/test still match the doc. Depth = doc-conformance **+ one** §D
spot-verify (decision #2).

## Why `workspaces` fourth

It is the **container** the dataset cluster lives inside —
[datasets.md](../../design/data-management/datasets/datasets.md) names it "the
container datasets live inside," `Dataset.workspaceId` is a FK to
`Workspace.id`, and the **workspace-card → `/datasets?workspace=<id>`
handoff** is declared on both sides. Having audited the three dataset
surfaces (R56–R58), the container closes that cluster: §C stresses the
`Workspace` vocabulary + the card→list handoff from the *container* side.
It is also an **early doc** (R13-era) — a clean test of R58's
"conformance tracks doc age" signal.

## Plan (by gate)

1. **Design (audit)** — rubric §A (vertical) + §B (`ui-design`
   design-spec, hardened). Record per-item pass/gap.
2. **Contract/FE/BE (verify)** — §C (horizontal: `Workspace` vocabulary +
   the card→datasets handoff vs `datasets.md`; cross-links via
   `markdown-check-link`) + §D (spot-verify one highest-risk claim —
   candidate: the `Workspace` schema / `ws_` id pattern vs the shared
   contract, or the card→`?workspace=` handoff vs the live route).
3. **Integration** — fold findings into the gap-log; apply in-round
   **doc-conformance fixes only**; **log** UX/product gaps (firewall).
   **Confirm + bump** the systematic A1/A2/A3/A6 cluster if it recurs
   (expected, esp. on an early doc) — **don't re-analyze**.
4. **Method-gap watch** — record whether the doc↔source-of-truth mirror
   gap recurs (still at 2 instances after R58).

## Acceptance criteria (Design-gate exit for this round)

- [x] Rubric §A–§D run against `workspaces`; per-item pass/gap recorded.
- [x] `ui-design` design-spec facet report attached (hardened B6).
- [x] Horizontal check vs the dataset cluster + exemplar done; one §D
      spot-verify executed.
- [x] Findings appended to the [program gap-log](../programs/design-corpus-audit.plan.md);
      "Seen in" bumped on any recurring gap.
- [x] In-round doc fixes applied; UX/product gaps logged (not fixed).
- [x] Method-gap-watch verdict recorded; doc-age signal noted.

## What is OUT of scope

- Redesigning `workspaces` UX (firewall — defer to a feature round).
- Auditing any other surface (one per round).
- Re-auditing already-done surfaces (`advanced-query`, filters, detail,
  datasets).
- **Remediating the systematic A1/A2/A3/A6 cluster** — deferred to
  program close per the [Lifecycle](../programs/design-corpus-audit.plan.md#lifecycle)
  (2026-06-01 decision). This round only **confirms + bumps** frequency.
- Re-opening the rubric for calibration (settled R56; the absent-map
  residual is logged for close).

## Risks / unknowns

- **Early doc** — the systematic cluster (stale status, token map
  absent/mis-cited, Reusability vocab, no acceptance section) is *very
  likely* to recur, possibly in the stronger absent-section forms R58
  showed. Confirm + bump + fix A6 in-round; don't re-litigate.
- **Audit→redesign creep** — firewall is the mitigation.

---

> **PAUSED for review at the Design gate.** Per "one surface per round,
> pause at review to confirm/fix": confirm this plan before the audit
> Do-phase runs. Do / Check / Act below are filled once the round
> executes.

## Do

**Flow**: audit reframe. Stable rubric (A3 owns tokens; B6 defers).

### §A — Vertical conformance

- **A1** Surface-declaration table — **gap (recurs, 4/4)**: Reusability
  uses `feature`/`backend` (off README set) — *but also* `shared
  cross-domain` for `WorkspaceCard` (README-valid). Docs **extend** the
  enum, not ignore it → likely the README is the stale party.
- **A2** Design-gate exit — **partial gap (recurs, 4/4)**: no explicit
  journeys / acceptance-criteria section.
- **A3** Token map — **gap (recurs, absent form)**: no token map —
  `workspaces.md` (R11) is even older than `datasets.md`.
- **A4** ASCII + behavior — **pass** (2 states; low complexity).
- **A5** Scope boundary — **pass**: `workspaces.md` HAS an explicit
  "Out of scope (deferred with named triggers)" section. → R58's A5 gap
  was `datasets.md`-specific, **not** systematic.
- **A6** Status header — **gap → fixed in-round**: was "Draft (Round 11
  Plan-phase input)" though shipped R13; now "Accepted (R11 design;
  shipped R13; extended R23)".

### §B — UX-honeycomb (hardened) — GAP (3 facets)

Findability **pass** · Usability **pass** · Accessibility **gap**
(clickable `WorkspaceCard` declares no keyboard/role/accessible-name,
doc:87–88) · Credibility **gap** (no loading / fetch-error / create-fail
state declared) · Utility **pass** · Desirability **gap** (no token map —
same root as A3; absent-map calibration residual recurs).

### §C — Horizontal (Workspace vocab + card→datasets handoff)

- **C1** vocabulary — **GAP**: `Workspace.id` **drift** — `workspaces.md`
  declared "ULID or UUID" but the contract/BE/consumer all use
  `ws_<8 hex>` (see §D). The card→`/datasets?workspace=<id>` handoff
  itself is consistent across docs.
- **C2** tokens/naming — **pass** (token absence is A3's).
- **C3** cross-links — **pass** (`markdown-check-link` exit 0).
- **C4** surface-decl semantics — **gap (logged)**: the `WorkspaceCard`
  `@mdd/ui` naming open-question was left unresolved in-doc ("R13 commits
  the name") — verify the live primitive name at close.

### §D — Spot-verify (`Workspace.id` format) — GAP, fixed in-round

- ❌ **Confirmed drift**: doc said `id = "ULID or UUID"` (+ stub
  `ulid.new()`), but `workspace.yaml` = `^ws_[0-9a-f]{8}$`, live BE =
  `f"ws_{secrets.token_hex(4)}"` (`workspaces.py:60`), and `dataset.yaml`
  `workspaceId` FK agrees. **Fixed in-round** (type comment + stub id
  line).

### Fixes applied in-round (firewall)

1. A6 status header.
2. §D `Workspace.id` format (`ULID/UUID` → `ws_<8 hex>`) — type + stub.

### Logged, NOT fixed (firewall + defer-to-close)

- **Systematic cluster → 4/4**: A1, A2, A3 (absent), A6.
- **a11y → feature round**: clickable-card keyboard path.
- **Credibility** (no loading/error states) bumped to R58, R59.
- **C4**: `WorkspaceCard` naming open-question (verify live primitive).
- **Doc staleness**: backend-stub illustration shows in-memory array;
  live BE is DuckDB-backed (separate from the id-format fix).

### Method-gap-watch verdict

**RECURRED → 3 instances.** The §D `Workspace.id` drift is a
doc↔contract/BE mirror that no parity test guarded. Mechanism now
**confirmed**: drift appears exactly where no parity test exists — R58's
dtype mirror did NOT drift *because* `dataset-detail.test.tsx` asserts it.
Track-2 framing sharpened: add parity coverage for doc-declared
contract/identifier claims.

## Check

- Acceptance criteria: all six met (ticked above).
- §D verified against source-of-truth: `workspace.yaml` pattern + live BE
  `secrets.token_hex(4)` + `dataset.yaml` FK all agree on `ws_<8 hex>`.
- Links: `markdown-check-link` clean.
- **Firewall held**: A6 + id-format fixed in-round; UX/a11y + systematic
  cluster logged (defer-to-close).

## Act

**4/4 confirms systematic** (A1/A2/A3/A6) — defer-to-close decision holds,
now with 4-surface frequency.

**Doc-age signal strengthened**: `workspaces.md` (R11, the oldest audited)
carried the *most consequential* drift — a wrong load-bearing identifier
format (`ULID/UUID` vs `ws_<8 hex>`), not just a stale header. Older docs
both lack newer-convention sections (token map) *and* carry stale
substance. **Close-triage: oldest-first.**

**Method-gap promoted (3 instances) + mechanism nailed**: drift occurs
precisely where no parity test guards a doc-declared contract/identifier
claim; the one guarded mirror (dtype, R58) held. This is now the
strongest, best-specified Track-2 candidate — "parity-check doc-declared
contract claims."

**Rubric self-correction**: R58's A5 "systematic" call was **wrong** —
R59 shows `workspaces.md` has the explicit Out-of-scope section, so A5 is
`datasets.md`-specific. Good that a 2nd data point caught the
over-generalization.

**Disposition**: surface 4 audited; rubric stable.
**Feeds into → surface 5 (`workspace-shell` + `.target`)**.

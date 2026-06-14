# DFCFBI's F1 needs a human, and "Complete" means signed-off — not gates-green

**Date**: 2026-06-14
**Agent**: claude-opus-4-8
**Confidence**: High
**Status**: New

## Problem

R72 (query construction surface) ran the full **DFCFBI** chain (D → F1 → C → F2
→ B → I) to green on a single "go ahead", was marked **Complete** at the
Integration gate, and *only then* did a human run the app — surfacing a broken
builder layout, header-button clutter, an unclear label, a `PUT`-missing-from-CORS
bug (Save failed in-browser), and design-vs-build fidelity drift (preview not
debounced, no `[Preview]`). Every automated gate had passed. Two failures: the F1
human checkpoint was skipped, and "Complete" was claimed on gates-green.

## Finding

**The agent both performed F1 and certified it — the weakest kind of gate** (cf.
[gates-dont-survive-self-modification](2026-06-13-gates-dont-survive-self-modification.md)).
DFCFBI is *only* selected when the 2-of-5 flow-selector fires because UX is
**uncertain** ([hybrid-flow-governance](../decisions/2026-05-28-hybrid-flow-governance.md)),
so F1's entire purpose is a human checkpoint on that uncertainty. Running straight
through collapses DFCFBI into "DCFBI with extra commits." And **MSW (FE) +
TestClient (BE) structurally cannot see CORS, browser preflight, CSS
layout/overflow, or whether an interaction *feels* right** — exactly the class of
defect human review caught. Marking the round **Complete** at gate-green compounded
it: `Complete` must mean *human-signed-off*; `Review` is the lifecycle status that
exists for precisely this gap.

## Evidence

- Files: `workspace/apps/builder/src/features/data-management/queries/QueryBuilderPanel.tsx`,
  `useQueryBuilder.ts`, `workspace/apps/backend/app/main.py` (CORS `allow_methods`).
- Round: [Round_72 § Act — Post-completion](../plan/cycles/Round_72.md) (the gap +
  the fixes `6e9bdcf` / `208aa79` / `400489b`; status flipped Complete → Review `26f642c`).
- The build-first twin: [ui-boundary-build-first](2026-05-22-ui-boundary-build-first.md)
  (the running build is the source of truth — so someone must actually *run* it).

## Recommendation

**Do**:

- On a **DFCFBI** round, **hard-stop at the F1 gate** and have the human exercise
  the running FE-on-MSW before opening Contract. Treat "F1 frozen" as human
  sign-off, not an agent assertion.
- Run `ui-design` **fidelity** mode (design-doc + component) at F1/F2 — its
  declared backstop — to catch build-vs-design drift mechanically. (Design-gate
  `design-spec` mode only checks the *doc*.) Mechanical check + human review.
- Hold a round at **`Review`** after the Integration gate; flip to **`Complete`**
  only once the human has run it and confirmed.
- **Reconcile the Design doc to the as-built before Complete.** F1/human-review
  iteration changes the build; if you align only C → F → B (via the contract) and
  leave **D** stale, the design markdown — *the* spec / UX source of truth (O-rule)
  — drifts "alone." Same repair R71 did for `saved-query.md`
  ([purpose.md](../context/purpose.md) #7). Make it a blocking Review→Complete item.
- **"Reconcile D" means EVERY design doc the change touched, not just the round's
  own.** Cross-cutting changes — a relabel, an action moved between surfaces, a
  shared/centralized enum, a previously-deferred scope item now shipped — drift
  *sibling* docs too. In R72 the primary doc was reconciled but `dataset-detail.md`
  and `saved-query.md` stayed stale until a human asked "how about other design?"
  (the 4th "declared done, wasn't fully" of the round). Grep the design corpus for
  the specific things the change altered (old label, old enum literal, the
  "deferred" line that's now shipped) — don't trust that one doc covers it.
- **A relabel must sweep CODE references too, not just the label's own key.**
  Renaming the button (`queries.save.action` → "Save filters as Query") left
  `queries.list.emptyHint` still telling users to choose **"Save as Query"** — a
  *shipped* inconsistency (en + vi), caught only when the human asked "is
  saved-query.md stale fixed?" (5th instance). After any UI rename, grep all
  user-facing strings that *name* the old label, in every locale — not only its
  defining key.
- When adding an HTTP method/route, update the backend CORS `allow_methods` — the
  harnesses don't exercise browser preflight.

**Don't**:

- Self-certify F1 and run F1 → I unattended on a DFCFBI round.
- Mark a round `Complete` because tests are green (claiming-done-without-verifying,
  the [dynamic-equilibrium](../context/purpose.md#dynamic-equilibrium) failure mode).

## Promotion Candidate?

- [ ] `context/` – Stable pattern, broadly applicable
- [x] Not yet – Fired once (R72); promote to `context/governance.md` or amend
  [hybrid-flow-governance](../decisions/2026-05-28-hybrid-flow-governance.md) (the
  Hard-Gates "who closes it" column) if a second DFCFBI round re-applies it.

---

> Filename convention: `YYYY-MM-DD-short-topic.md`.
> See [.agents/AGENTS.md](../AGENTS.md) for the write policy.

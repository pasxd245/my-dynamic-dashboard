# Don't lock a model in early — specious coherence is the trap (discovered vs imposed)

**Date**: 2026-06-13
**Agent**: claude-opus-4-8
**Confidence**: High
**Status**: New

## Problem

R69 (Saved Query) was built D→C→F→B→I and then **discarded wholesale**.
The defect was not in the build — the build faithfully implemented the
spec. The defect was a **modeling error at the Design gate**: `queries.md`
modeled Query as a **new top-level noun** with parallel surfaces
(`QueriesPage`, `QueryDetailPage`) when purpose.md says a Query *"produces
a (virtual) dataset"* — i.e. Query is a **mode/lens over the existing
readable-table surfaces, not a new noun**.

The error survived the Design gate precisely because it was **internally
consistent**. A wrong-but-coherent model looks like a right one: it passes
review, organizes the work cleanly, and every layer built on it "fits."

## Finding

**Speciousness is coherence around a wrong center.** A premature model is
dangerous not when it is obviously broken, but when it is plausible enough
to organize everything around. Two compounding mechanisms make it stick:

1. **A premature model manufactures its own evidence.** Once you adopt
   "Query is a noun," you build `QueryDetailPage` — and that page is then
   cited as *evidence that Query is a noun*. The model generates the facts
   that confirm it. The confirmation is **circular**, not real.

2. **Execution confidence ≠ model confidence.** "Can the agent build/refactor
   this cleanly?" (often >90%) tells you nothing about "is this the right
   model?" A confident, elegant build on a wrong model just produces a
   *tidier* mistake. R69's two near-identical surfaces could have been merged
   into a shared component at high execution confidence — and that merge would
   only have cemented the wrong model.

**The discriminator — one question:** is this model **discovered** or
**imposed**?

- **Discovered (true):** reality keeps insisting on it. Two *independent*
  consumers you did **not** create both genuinely need the same shape; you
  couldn't avoid it. Truth survives you trying to delete it.
- **Imposed (specious):** its supporting evidence is what you *produced by
  adopting it* (the phantom `QueryDetailPage`). Strip away everything your own
  decision created and little remains. It survives only because you keep
  feeding it.

**Corollary — cheap-to-do-later is permission to defer, not a reason to
rush.** If an abstraction/extraction is mechanically easy whenever you want
it, waiting costs nothing and *buys* the real second consumer's true shape.
Guess now → derive the shared shape from one example (plus a phantom); wait →
derive it from two genuine ones. Same easy refactor, better result. (This is
the build-first boundary rule's twin —
[2026-05-22-ui-boundary-build-first.md](2026-05-22-ui-boundary-build-first.md)
says build the boundary *early when the late-extraction failure has been
observed*; this says do **not** mint a *new abstraction/noun* early when its
only evidence is self-made. The unifying test is the same: real independent
pull vs. self-generated pull.)

**Calibration (user, 2026-06-13):** *"we should not too easy to
make/conclude a modeling/patterning too early, it could trap us into another
drift (specious, still not the truth)"* — and this need not fire on every
case; **catching even 60–70% of them is a large win.** This is a discipline,
not an absolute law: over-applied it becomes analysis paralysis (the opposite
failure — never committing to any model). The posture is *hold the model as a
hypothesis with a named kill-condition*, not *forbid models*.

## Evidence

- R69 root-cause record + salvage: [`tmp/queries/README.md`](../../tmp/queries/README.md)
  (parked patch/snapshot; backend/contract half was sound, the surface model
  was the defect).
- Surfaces the redo folds Query into (no new pages needed):
  [dataset-detail.md](../design/data-management/dataset-detail.md),
  [advanced-query.md](../design/data-management/advanced-query.md) (already
  pre-declared "Saved queries" as a deferred bullet),
  [datasets.md](../design/data-management/datasets.md).
- Twin/related lessons:
  [2026-05-22-ui-boundary-build-first.md](2026-05-22-ui-boundary-build-first.md),
  [2026-05-24-design-first-reframe-absorption.md](2026-05-24-design-first-reframe-absorption.md),
  [2026-05-23-drifted-shell-distillation.md](2026-05-23-drifted-shell-distillation.md).

## Recommendation

**Do**:

- At the **Design gate**, ask the noun-vs-mode question explicitly: *"is this
  a new noun, or a mode of an existing surface?"* Default to **mode/reuse**;
  a new noun must justify itself against an existing surface.
- Before adopting a model/abstraction, run the **discovered-vs-imposed test**:
  *"what evidence for this did I find vs. generate by deciding it?"* If the
  support is self-made (a surface you created), treat the model as unproven.
- When **model confidence is low (e.g. <80%)**, do **not** force Design to
  conclude in one round on a plausible-looking spec. Legitimate moves:
  a **discardable spike** (prototype just the risky model, throwaway by
  design), or a **D-only committed round** (gate = "model validated"; CFBI
  follows later). A committed design doc is the cheapest revert seam for the
  most expensive class of error.
- **Commit per gate** so an altitude error is cheap to revert (R69 was only
  cheap to discard because *nothing* was committed — don't rely on that;
  see [2026-05-28-dcbf-to-dcfbi-pivot.md](2026-05-28-dcbf-to-dcfbi-pivot.md)
  for the chain).
- State a model's **kill-condition** when adopting it (e.g. *"if dashboards
  never need a shared read source, `TableSource` was never real"*).

**Don't**:

- Conclude a model/pattern/abstraction early because it's *coherent* or
  because the build/refactor would be *easy*. Coherence and execution-ease are
  not evidence of correctness.
- Treat **self-manufactured duplication** as the "two consumers" that earn an
  abstraction. A duplicate you created by mis-modeling is `1 real + 1 mistake`,
  not `2`. Delete the mistake; don't abstract over it.
- Bundle an abstraction/refactor *into* a feature's DCFBI chain. A genuinely
  needed abstraction is a **preparatory refactor round** (its own commit)
  before the feature — never smuggled into a phase (that re-creates the R69
  one-blob, no-revert-seam failure).
- Force a low-confidence Design to "finish" — a confident-looking wrong design
  is worse than an openly-unfinished one.

## Promotion Candidate?

- [x] `context/` — broadly-applicable anti-drift doctrine; promote the
      discovered-vs-imposed test + noun-vs-mode gate question into
      `.agents/context/` once a second round validates it in practice
      (the R69 redo is the first such validation).
- [ ] `skills/` — possible later: a Design-gate checklist item
      ("discovered vs imposed?") could fold into the `gate-walker` skill.
- [ ] Not yet

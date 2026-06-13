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
(`QueriesPage`, `QueryDetailPage`) when purpose.md says a Query _"produces
a (virtual) dataset"_ — i.e. Query is a **mode/lens over the existing
readable-table surfaces, not a new noun**.

The error survived the Design gate precisely because it was **internally
consistent**. A wrong-but-coherent model looks like a right one: it passes
review, organizes the work cleanly, and every layer built on it "fits."

## Finding

**Speciousness is coherence around a wrong center.** A premature model is
dangerous not when it is obviously broken, but when it is plausible enough
to organize everything around.

**A half-truth is still not the truth** — and it is _more_ dangerous than an
outright falsehood, because the true fraction is exactly what carries the false
one past review. That is what _specious_ means: wearing the face of truth
without being true — a **fallacy** and a **half-truth** are both specious. R69's
model was half-true: a Query genuinely _does_ earn its own `qr_` identity + URL +
catalog (**true**) — bundled with _"…so it must be a new top-level noun with
parallel duplicated pages"_ (**false**). The true half smuggled the false half
through the gate. The cure is to **split the half**: keep the true fraction, drop
the false one. R70 named the seam that does it — **doc-home and UI-duplication
are independent axes**: a Query keeps its own home/identity (true) _without_
duplicating the dataset surfaces (false). When a model feels right, ask which
_part_ is the truth and whether the rest is just riding on it.

Three compounding mechanisms make it stick:

1. **A premature model manufactures its own evidence.** Once you adopt
   "Query is a noun," you build `QueryDetailPage` — and that page is then
   cited as _evidence that Query is a noun_. The model generates the facts
   that confirm it. The confirmation is **circular**, not real.

2. **Execution confidence ≠ model confidence.** "Can the agent build/refactor
   this cleanly?" (often >90%) tells you nothing about "is this the right
   model?" A confident, elegant build on a wrong model just produces a
   _tidier_ mistake. R69's two near-identical surfaces could have been merged
   into a shared component at high execution confidence — and that merge would
   only have cemented the wrong model.

3. **Verification confirms conformance, not truth (user, 2026-06-13).** Tests
   are this trap automated: a green suite proves _what we built matches what we
   specified_ — and the spec is itself _generated from our intent_, so the whole
   loop (intent → spec → build → test-against-spec) is **self-referential**. The
   BIZ truth — _is this the right model?_ — sits **outside** that loop. R70's
   22/22 contracts + 132/132 FE + 159/159 BE + dual conformance all answer "does
   what we have match what we said we wanted?"; **none** asks "is a relationship
   really a workspace-scoped edge?" So **test-green ≠ model-true** — the suite
   cheerfully confirms a specious model. This is why
   [accelerate ⇌ brake](../context/purpose.md#dynamic-equilibrium) run **in
   sync**, not in tension: _accelerate_ (build + tests) proves **conformance**
   and is fast/automatable; _brake_ (BIZ-truth validation — the
   discovered-vs-imposed question, the human) proves **truth** — the one thing
   the accelerate layer _structurally cannot_ reach, because it tests the
   generated, not the real. The brake is not ceremony; it covers exactly the gap
   tests leave open. Neither substitutes for the other.

**The discriminator — one question:** is this model **discovered** or
**imposed**?

- **Discovered (true):** reality keeps insisting on it. Two _independent_
  consumers you did **not** create both genuinely need the same shape; you
  couldn't avoid it. Truth survives you trying to delete it.
- **Imposed (specious):** its supporting evidence is what you _produced by
  adopting it_ (the phantom `QueryDetailPage`). Strip away everything your own
  decision created and little remains. It survives only because you keep
  feeding it.

**Corollary — cheap-to-do-later is permission to defer, not a reason to
rush.** If an abstraction/extraction is mechanically easy whenever you want
it, waiting costs nothing and _buys_ the real second consumer's true shape.
Guess now → derive the shared shape from one example (plus a phantom); wait →
derive it from two genuine ones. Same easy refactor, better result. (This is
the build-first boundary rule's twin —
[2026-05-22-ui-boundary-build-first.md](2026-05-22-ui-boundary-build-first.md)
says build the boundary _early when the late-extraction failure has been
observed_; this says do **not** mint a _new abstraction/noun_ early when its
only evidence is self-made. The unifying test is the same: real independent
pull vs. self-generated pull.)

**Calibration (user, 2026-06-13):** _"we should not too easy to
make/conclude a modeling/patterning too early, it could trap us into another
drift (specious, still not the truth)"_ — and this need not fire on every
case; **catching even 60–70% of them is a large win.** This is a discipline,
not an absolute law: over-applied it becomes analysis paralysis (the opposite
failure — never committing to any model). The posture is _hold the model as a
hypothesis with a named kill-condition_, not _forbid models_.

**Re-emphasis (user, 2026-06-13):** _specious_ is the load-bearing word — _"even
a half of truth is still not the truth; a fallacy is specious, a half-truth is
specious."_ The danger is never the obviously-wrong model (review catches it);
it is the **partly-right** one, whose true fraction launders the false fraction
past the gate. See the **half-truth** note in Finding: the discipline is to
_split the half_ — name which part is true, then test whether the rest only
survives by riding on it.

## Evidence

- R69 root-cause record + salvage: [`tmp/queries/README.md`](../../tmp/queries/README.md)
  (parked patch/snapshot; backend/contract half was sound, the surface model
  was the defect).
- Surfaces the redo folds Query into (no new pages needed):
  [dataset-detail.md](../design/data-management/datasets/dataset-detail.md),
  [advanced-query.md](../design/data-management/datasets/advanced-query.md) (already
  pre-declared "Saved queries" as a deferred bullet),
  [datasets.md](../design/data-management/datasets/datasets.md).
- Twin/related lessons:
  [2026-05-22-ui-boundary-build-first.md](2026-05-22-ui-boundary-build-first.md),
  [2026-05-24-design-first-reframe-absorption.md](2026-05-24-design-first-reframe-absorption.md),
  [2026-05-23-drifted-shell-distillation.md](2026-05-23-drifted-shell-distillation.md).

## Recommendation

**Do**:

- At the **Design gate**, ask the noun-vs-mode question explicitly: _"is this
  a new noun, or a mode of an existing surface?"_ Default to **mode/reuse**;
  a new noun must justify itself against an existing surface.
- Before adopting a model/abstraction, run the **discovered-vs-imposed test**:
  _"what evidence for this did I find vs. generate by deciding it?"_ If the
  support is self-made (a surface you created), treat the model as unproven.
- When **model confidence is low (e.g. <80%)**, do **not** force Design to
  conclude in one round on a plausible-looking spec. Legitimate moves:
  a **discardable spike** (prototype just the risky model, throwaway by
  design), or a **D-only committed round** (gate = "model validated"; CFBI
  follows later). A committed design doc is the cheapest revert seam for the
  most expensive class of error.
- **Commit per gate** so an altitude error is cheap to revert (R69 was only
  cheap to discard because _nothing_ was committed — don't rely on that;
  see [2026-05-28-dcbf-to-dcfbi-pivot.md](2026-05-28-dcbf-to-dcfbi-pivot.md)
  for the chain).
- State a model's **kill-condition** when adopting it (e.g. _"if dashboards
  never need a shared read source, `TableSource` was never real"_).

**Don't**:

- Conclude a model/pattern/abstraction early because it's _coherent_ or
  because the build/refactor would be _easy_. Coherence and execution-ease are
  not evidence of correctness.
- Treat **self-manufactured duplication** as the "two consumers" that earn an
  abstraction. A duplicate you created by mis-modeling is `1 real + 1 mistake`,
  not `2`. Delete the mistake; don't abstract over it.
- Bundle an abstraction/refactor _into_ a feature's DCFBI chain. A genuinely
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

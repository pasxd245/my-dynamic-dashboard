# Round 21: Spec 007 - Builder Experience Hardening + Workflow Shell

**Status**: Planning
**Date started**: 2026-05-09
**Date completed**: —

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

## Goal

Deliver Spec 007 for builder experience hardening and workflow-shell redesign so analysts can run upload -> profile -> query -> save -> visualize flows with explicit workspace/source state, actionable errors, and stable connectivity.

## Plan

- [ ] Confirm Round 21 scope and Spec 007 slug (for specs/007-<slug>/)
- [ ] Run Spec-Kit bootstrap as needed (`/speckit.specify` -> `/speckit.plan` -> `/speckit.tasks`)
- [ ] Validate Round 20 carry-over constraints are represented in Spec 007:
      connectivity preflight, error UX, workflow shell IA, E2E smoke, no hidden workspace fallbacks
- [ ] Create a durable handoff note before compaction that captures:
      Round 22 candidate scope, deferred ideas, and explicit acceptance intent from Round 20
- [ ] Curate compaction decision at trigger point (Round 21 start):
      choose whether to compact now or defer until deferred/superseded rounds are resolved
- [ ] Confirm implementation readiness criteria for Do phase

**Decision Gates**:

- Gate A (spec identity): Spec 007 slug/scope must be confirmed before `/speckit.specify`.
- Gate B (compaction policy): Because `21 > (last_compaction_point + 20)`, compaction review is required.
  Current blocker: rounds 03-15 include `Deferred`/`Superseded` statuses.
  Human choice required: compact anyway with curation, or defer compaction until those rounds are resolved.
- Gate C (idea continuity): Do not compact rounds 01-20 until Round 20 next-round ideas are copied into
  a durable Round 21/22 handoff artifact and linked from this round.

## Do

Pending Plan completion.

Handoff artifact for idea continuity: `docs/agents/plan/round-20-to-22-handoff.md`.

## Check

- [ ] `speckit.analyze` run without CRITICAL findings
- [ ] `specs/007-<slug>/tasks.md` reaches 100% checked
- [ ] Repo verification commands pass for all touched surfaces

## Act

**Learnings**:

- TBD

**Promotions**:

- [ ] -> context/ : TBD
- [ ] -> skills/ : TBD

# Meta 02: Crystallize principles + wire `--autopilot` / `--cold` flags

**Status**: Complete
**Date started**: 2026-05-19
**Date completed**: 2026-05-19

## Goal

Two coordinated edits to close the gap between [docs/agents/workflows/agent-architecture.workflow.md](../../../../docs/agents/workflows/agent-architecture.workflow.md) (the design spec) and [.claude/commands/autoagent.md](../../../../.claude/commands/autoagent.md) (the command spec):

1. **Add [.agents/context/principles.md](../../../context/principles.md)** — a 1-page reference holding the 8 load-bearing invariants the workflow doc currently embeds inside its 335-line prose. Crystallizes "what must never change" so future workflow edits can self-check.
2. **Update [.claude/commands/autoagent.md](../../../../.claude/commands/autoagent.md)** — wire two existing-but-implicit concepts to explicit flags:
   - `--autopilot` → turns on smart-autopilot policy as defined in workflow.md § Smart-autopilot. Previously implicit on every `/autoagent` invocation; promoting it to an explicit flag makes the attended-vs-unattended distinction first-class.
   - `--cold` → master-agent discipline: read disk state aggressively, dump decisions to disk eagerly, treat conversation context as scratchpad only. The discipline that makes the workflow doc's lesson-learn loop honest about restart.

## Product-velocity justification

Meta rounds must shorten or de-risk ≥3 product rounds to justify themselves. This one does:

- Last 7 product rounds (R01–R05 + R02-revision + AppShell swap) all interacted with `/autoagent`'s policy in ways that cost ~10–20 min of back-and-forth per round (clarifying what `--autopilot` meant; confirming merges; manually verifying decisions). Making the flags explicit reduces that surface.
- `--cold` is the discipline that lets a future `/autoagent` actually run unattended — which is the workflow doc's whole premise but tonight's session never tested.
- principles.md gives every future doc edit a vocabulary to self-check against, instead of re-deriving design intent from prose.

## Scope (immutable)

- New file: `.agents/context/principles.md` — 8 principles, 1 page.
- Edited file: `.claude/commands/autoagent.md` — add `--autopilot` + `--cold` to the flags table; add two short subsections explaining each (with references to workflow.md and principles.md); update Examples.
- **Not in scope** for this round:
  - Programmatic enforcement of `--cold` (it's a discipline, not infra).
  - The earlier classifier-blocked "Known noise" lockfile note (separate edit).
  - Aligning autoagent.md's "self-evo as default executor" with workflow.md's "self-evo is opt-in support" — that's a separate Meta round once we decide.
  - Adding `--executor` or `--no-autopilot` flags.

## Decisions baked in

1. **`/autoagent` default behavior CHANGES.** Today `/autoagent` implicitly enables smart-autopilot ("user is asleep / away"). After this round, `/autoagent` without `--autopilot` defaults to **attended/babysit** mode (master-agent confirms decisions per workflow.md's escalation rules). Cron-fired runs and `/autoagent --autopilot` get the autonomous policy. This is a **breaking change**, intentionally — it makes the attended-vs-unattended axis explicit.
2. **`--cold` is master-agent discipline, not framework infra.** No subprocess re-spawn, no cache invalidation. Just: read disk state at iter start, write decisions to disk before iter end, never rely on conversation context for load-bearing facts.
3. **`--autopilot` and `--cold` are orthogonal.** The four combinations cover the real use-cases (per the table in my last brainstorm reply).
4. **principles.md owns invariants; workflow.md owns mechanics.** Principles entries should be defensible as "violating this would break the system." Implementation details belong elsewhere.

## Validation

- `pnpm md:lint` clean on both new/edited files.
- principles.md reads in ≤2 minutes; covers all 8 numbered principles.
- autoagent.md examples include `--autopilot` and `--cold` usage; flag table cells filled.
- No code patches — markdown only. No type-check or test changes expected.

## Open follow-ups (deferred — not in this round)

- **Bundle the classifier-blocked lockfile-noise note into the next autoagent.md edit** (separate Meta round; user explicitly authorizes per edit per principle P3).
- **Resolve autoagent.md ↔ workflow.md "self-evo default" contradiction** (next Meta round, requires a decision: keep self-evo as default for code rounds, or make it opt-in per round file).
- **Add `--executor` flag** to override the framework default (matches workflow.md line 156 "master-agent does NOT use self-evo for anything master-agent is faster at doing directly").

## State of the world after this round

- `state.json.openObservations.autoagentMdVsWorkflowMdSelfEvoDefault` — new observation, not blocking, queued for next Meta round.
- Future `/autoagent` invocations have explicit semantics for the four (warm/cold) × (autopilot/no) combinations.
- principles.md exists as a 1-page reference master-agent loads early in any session.

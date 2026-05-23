# Round 05: Codify PDCA round process + memory placement rule

**Status**: Complete
**Date started**: 2026-05-22
**Date completed**: 2026-05-23

## Goal

**Inherits from ← [Round_04](Round_04.md)** — four rounds (R01-R04)
banked, zero outstanding `@mdd/ui` shape gaps, and a clear queue of
process patterns we've used 4× without codifying. The deliberate
sequencing was: build first, codify after the patterns proved
themselves. The codification round is now genuinely pulled by
evidence, not by speculation.

Promote three round-process patterns validated across R01-R04 from
ad-hoc-each-round into the canonical operating manual:

1. **PDCA cycle linking** — `Inherits from ← Round_NN` in Goal,
   `Feeds into → Round_NN+1` in Act. Used in all 4 rounds.
2. **Memory placement rule** — `.agents/memory/` for project
   knowledge (committed, shared); user/Claude-local auto-memory for
   user-personal habits and tool quirks. Worked out mid-session,
   applied 4×.
3. **Post-round audit habit** — Plan/Check checkboxes flipped,
   Promotions reformatted from `[ ]` to plain decisions, Status
   moved Review → Complete only after human approval, all cross-
   links present. Hand-fixed in every round; should be a written
   checklist.

_Track: 2 (agent-method). Pulled by: 4 rounds of validated patterns
named explicitly in R01-R04 Act → Follow-ups sections. Per
[Evolution Rule](../../../AGENTS.md), track-2 additions require a
documented track-1 pull — that condition is met._

## What is IN scope

- Update [.agents/plan/PDCA.md](../PDCA.md):
  - Add `Inherits from ←` and `Feeds into →` to the Round Template,
    placed in the Goal and Act sections respectively (matching where
    R01-R04 settled).
  - Add a **Post-round audit** subsection to the Act phase
    description listing the checklist items.
  - Add a **Status lifecycle** note clarifying:
    `Planning → In Progress → Review (work done, awaiting human) →
Complete (human-approved)`.
- Create [.agents/context/memory-placement.md](../../context/memory-placement.md)
  with the two-location rule + decision criteria + cross-references
  to existing memories.
- Append three promotion log entries to
  [.agents/plan/promotions.md](../promotions.md) per
  [.agents/context/governance.md](../../context/governance.md)
  ("Explicit Human Instructions" section).

## What is OUT of scope (explicit deferrals)

- **Items 1 & 2 from the codification queue** (per-package script
  convention, shared `vitest.config.ts` shape) — those are
  tooling/code-adjacent and warrant their own R06. Single-feature
  discipline holds.
- **No new skills** — none of the three patterns are reusable
  _procedures_; they're conventions and rules.
- **No `.agents/skills/` writes.**
- **No code changes** anywhere in `workspace/`.

## Governance flag (required by [governance.md](../../context/governance.md))

This round modifies authoritative knowledge in:

- `.agents/plan/PDCA.md` (authoritative round template)
- `.agents/context/` (new file added — authoritative knowledge)
- `.agents/plan/promotions.md` (append-only log)

Per the **Explicit Human Instructions** clause of
[governance.md](../../context/governance.md), the agent MUST:

1. Warn the human that authoritative or governance knowledge will
   be modified. **Done in this Plan section.**
2. Wait for explicit confirmation before Do.
   **Granted 2026-05-22 ("yes, please go. I'll review").**
3. Log the change in `plan/promotions.md`. **Done — 3 entries
   appended in Do.**

## Plan

- [x] Update `.agents/plan/PDCA.md` Round Template:
  - Add `**Inherits from ← [Round_NN](Round_NN.md)** — …` line
    inside Goal description (with one-line guidance on what it
    should cite).
  - Add `## Feeds into → Round_NN+1 (TBD)` as the canonical last
    section after Act (with guidance on what to capture).
  - Add **Post-round audit** subsection to the Act phase description
    listing: flip Plan/Check checkboxes; reformat Promotions from
    `[ ]` into plain decisions when nothing promotes; flip Status
    metadata; verify cross-links to neighbor rounds.
  - Add a **Status lifecycle** note (Planning → In Progress →
    Review → Complete) matching how R01-R04 actually used the
    field.
- [x] Create `.agents/context/memory-placement.md` documenting:
  - The two locations (`.agents/memory/` vs auto-memory) and what
    each is for.
  - The decision rule ("would another agent / contributor benefit
    from seeing this?" → `.agents/memory/`).
  - Filename + template conventions for each.
  - Cross-references to the existing memories that established
    the rule.
- [x] Append 3 promotion log entries to `.agents/plan/promotions.md`
      (one per item — cycle linking, memory placement, audit checklist).
- [x] Verify by **dry-running the new template mentally against R04**:
      the section headers and checklist items should all already exist
      in R04. If anything in the template is _not_ present in R04,
      that's a sign the template is over-specifying — reduce.

## Risks / unknowns

- **Over-specification.** It's tempting to add every nicety we
  invented (e.g., the `[ ]` → plain-decision reformat for "decided
  not to promote"). Some are stylistic and don't need to be in the
  template. Discipline: only put in PDCA.md what each round _must_
  do; leave style suggestions as Audit hints, not template
  requirements.
- **Drift between template and live rounds.** Once codified,
  future rounds inherit the shape. If we later want to change it
  (e.g., add a Risks/Mitigations split), we need to do that via
  another R-level cycle, not silent template edits.
- **Memory-placement rule is project-specific.** Other repos may
  have different mem layouts. The context file should be clear that
  it documents _this repo's_ convention, not a universal rule.
- **No code, no automated test.** Verification is a manual reading-
  check: does the new template, when applied, reproduce the shape
  R01-R04 used? Acceptable for a documentation round.

## Do

- Updated [.agents/plan/PDCA.md](../PDCA.md):
  - Expanded the **Act** phase description to mention
    `Feeds into → Round_NN+1`, the post-round audit, and the
    `Review → Complete` status flip.
  - Added a **Status lifecycle** section explaining
    `Planning → In Progress → Review → Complete` and that only
    humans flip to `Complete`.
  - Added a **Post-round audit** checklist section (Plan/Check
    checkboxes, Promotion reformat, Status, cross-links, memory
    capture, markdownlint).
  - Updated the **Round Template** code block to bake in
    `Inherits from ←` (in Goal), Track citation, `Risks / unknowns`
    section, Promotions guidance ("if none: write as plain text,
    not checkboxes"), `Follow-ups` subsection, and a
    `## Feeds into → Round_NN+1 (TBD)` final section.
- Created [.agents/context/memory-placement.md](../../context/memory-placement.md):
  the two-location rule (project `.agents/memory/` vs auto-memory),
  the _"would another agent/contributor benefit from seeing this?"_
  decision rule, conflict-handling note, promotion pathway, and
  cross-references to the three R01-R02-era memories that
  established it.
- Appended three entries to [.agents/plan/promotions.md](../promotions.md):
  - Memory placement rule → `context/memory-placement.md`
  - PDCA cycle linking convention → `plan/PDCA.md`
  - Post-round audit checklist + status lifecycle → `plan/PDCA.md`
- **Dry-run check against Round_04**: every section in the new
  template is already present in R04 — `Inherits from ←` (line 9),
  Track citation (line 20), Risks/unknowns, Promotions as plain
  text (R04 reformatted), Follow-ups, `Feeds into → Round_05`.
  The template is descriptive of what we actually do, not
  aspirational. Good signal.
- **Mid-Review amendment #1 (2026-05-23, while R05 was in `Review`):**
  human review surfaced two ambiguities in the Governance block:
  (a) "rounds are append-only" didn't say _Complete_ rounds — it
  could be read as forbidding the live-edit pattern this session
  used throughout R01-R05; (b) "only humans flip `Complete`" didn't
  name itself as _current policy_ leaving room for future
  autopilot/autoagent modes. Both were amended in place (R05 was
  still in `Review`, so editing is allowed — by the very rule we
  were clarifying). Also added a one-liner at the top of PDCA.md
  declaring the file as policy, not constitution. Appended a 4th
  entry to `promotions.md` logging the amendment.
- **Mid-Review amendment #2 (2026-05-23):** human review of the
  previous amendment noted that "do not delete or rewrite" left the
  _how to add post-Complete information_ question open (e.g.
  resolving stale `Feeds into → (TBD)`, recording supersedes,
  maturing outcomes). After two iterations of proposal + counter,
  the human-authored final shape is a single rule under the
  append-only bullet pointing at one section name
  (`## Appending to Complete rounds`) using a literal code-block
  showing the file layout. No per-case rules (no separate Addenda/
  Superseded/TBD-resolution sections) — one section absorbs all
  post-Complete entries. Appended a 5th entry to `promotions.md`
  logging this amendment.

## Check

- [x] `.agents/plan/PDCA.md` updated — Round Template now includes
      `Inherits from ←`, Track citation, Risks/unknowns,
      Promotions-as-plain-text guidance, Follow-ups subsection, and
      `Feeds into → Round_NN+1`. Plus new top-level **Status
      lifecycle** + **Post-round audit** sections.
- [x] `.agents/context/memory-placement.md` exists and states the
      two-location rule, the decision criterion, conflict-handling,
      promotion pathway, and cross-references the three established
      memories.
- [x] `.agents/plan/promotions.md` has 5 new entries with dates,
      source/rationale, and Promoted by (3 original + 2 mid-Review
      amendments).
- [x] Dry-run mental check: every section in the new Round Template
      is already present in R04 — the template is descriptive of
      what we actually do, not aspirational.
- [x] `npx markdownlint-cli2` repo-wide → 36 files, 0 errors.

## Act

**Status**: Complete (human-approved 2026-05-23). Per
[governance.md](../../context/governance.md), only humans move a
round to Complete.

**Learnings**:

- **The dry-run-against-R04 check was the key discipline.** Every
  section we added to the Round Template already appears in R04
  organically. That means the template is _descriptive of practice_,
  not _aspirational future state_. Codification works best when the
  pattern has already settled — over-specifying ahead of practice
  is exactly the speculative-scaffolding failure mode the
  constitution warns against, just at the process level.
- **"Promotions as plain text when nothing promoted"** is a small
  but meaningful UX choice. `[ ]` looks like a TODO and creates
  visual debt across reviews. Documenting it in the template
  removes a hand-fix that happened in every round.
- **`Review` status was real but unnamed in the old template.**
  Every round this session went through a Review phase between
  agent-finishing-Do and human-flipping-Complete. Naming it makes
  the "agent waits for human" handoff explicit.
- **Memory-placement codification was overdue.** The mistake
  (writing project memories to auto-memory in R01-R02) was
  preventable; the new context file should stop the next agent
  from repeating it.
- **In-Review amendment worked as designed, twice.** The PDCA.md
  Governance block had ambiguities that only became visible when a
  human read the codified text. R05 was still in `Review`, so
  editing was allowed — and the very edits clarified that rule.
  The rule-being-clarified validated itself by enabling its own
  clarification. Good signal that the "active rounds are editable"
  framing is correct.
- **Human-authored final edits are part of the round.** Both
  mid-Review amendments ended in human-written prose/code-block
  (the appending-rule code example came from the user directly,
  after I had over-proposed alternative formats). The round's
  authorship is mixed and that is fine — what matters is that the
  artifact ships as the team intends.

**Memories captured**: no new project memories this round — the
content _is_ the codification (PDCA.md + memory-placement.md). The
existing R01-R04 memories cross-link from `memory-placement.md`.

**Promotions**:

- `→ context/`: yes — created
  [.agents/context/memory-placement.md](../../context/memory-placement.md).
- `→ plan/`: yes — modified
  [.agents/plan/PDCA.md](../PDCA.md) (authoritative template) and
  appended [.agents/plan/promotions.md](../promotions.md). Both
  were warned-and-confirmed per governance.

**Follow-ups (not promotions, just notes):**

- R06 candidate: per-package script convention + shared
  `vitest.config.ts` (the other two items from the codification
  queue) — tooling-side, deserves its own round.
- R07+ candidate: actual track-1 work resumes — backend integration
  or first BIZ feature.

## Feeds into → Round 06 (TBD)

What R05 hands forward:

- **Canonical Round Template** in
  [.agents/plan/PDCA.md](../PDCA.md). Round_06 should be drafted
  using the new template directly (no manual additions for
  cycle-linking or audit).
- **Memory placement decision criterion** in
  [.agents/context/memory-placement.md](../../context/memory-placement.md).
  Future memories should follow it without needing this conversation
  re-discovered.
- **Two open codification candidates** for R06 (per-package script
  convention, shared `vitest.config.ts`). Evidence already
  collected; just needs the same kind of dry-run-and-document
  pass R05 did.
- **Track-1 backlog still warm**: backend integration and first
  BIZ feature (`CRMSourceUpload`) remain queued from R03/R04
  follow-ups.

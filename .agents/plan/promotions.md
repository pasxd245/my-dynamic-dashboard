# Promotion Log

> Append-only log of memory entries promoted to `context/` or `skills/`.
> See [PDCA.md](PDCA.md) for methodology and [AGENTS.md](../AGENTS.md) for promotion criteria.

---

<!-- Append new entries below this line using the format:

## YYYY-MM-DD: [Topic] → [Destination]

**Source**: memory/[filename]
**Rationale**: [1-2 sentences]
**Promoted by**: [Human name]

-->

## 2026-05-22: Memory placement rule → `context/memory-placement.md`

**Source**: workflow pattern established mid-conversation on
2026-05-22 and applied across Round_01-04 (migration of three
project memories from auto-memory to `.agents/memory/`).
**Rationale**: Project knowledge needs to be visible to all agents
and contributors on this repo, not local to one Claude Code install.
The two-location rule (project vs personal/tool) was hand-applied 4
times; codifying it prevents the next agent from making the same
initial misplacement.
**Promoted by**: pasxd245 (Round_05).

## 2026-05-22: PDCA cycle linking convention → `plan/PDCA.md`

**Source**: pattern invented during Round_01 → Round_02 handoff and
applied identically across Round_02 → Round_03 → Round_04 (`Inherits
from ← Round_NN` in Goal, `Feeds into → Round_NN+1` in Act).
**Rationale**: Four rounds of consistent ad-hoc use show this is the
working shape of PDCA continuity in this repo. Putting it in the
template means future rounds inherit it by default instead of
re-inventing it.
**Promoted by**: pasxd245 (Round_05).

## 2026-05-22: Post-round audit checklist + status lifecycle → `plan/PDCA.md`

**Source**: hand-fixed in every round (R01-R04) — Plan/Check
checkbox flip, Promotions reformat from `[ ]` to plain decisions,
Status flip Review → Complete, cross-link verification.
**Rationale**: An audit that was always done implicitly should be
explicit. Also codifies the `Review` intermediate status (which
R01-R04 used but the previous template didn't name), clarifying
that agents may flip to `Review` but only humans flip to `Complete`.
**Promoted by**: pasxd245 (Round_05).

## 2026-05-23: Governance clarification — append-only scope + revisability → `plan/PDCA.md`

**Source**: in-round amendment surfaced by human review during
Round_05 — the original "rounds are append-only" line was ambiguous
about whether ongoing (Planning/In Progress/Review) rounds could be
edited, and the "only humans flip Complete" line did not name itself
as policy-not-constitution.
**Rationale**: This session edited active rounds throughout (R1-R5)
— the rule needed to say so explicitly. Naming the human-only flip
as _current policy revisable via a future round_ also leaves a clean
path for autopilot/autoagent modes to relax it via PDCA later, rather
than forcing a constitutional break.
**Promoted by**: pasxd245 (Round_05 mid-Review amendment).

## 2026-05-23: Appending-to-Complete-rounds rule → `plan/PDCA.md`

**Source**: human-edited directly into PDCA.md Governance during
Round_05 Review — surfaced by reviewing the previous amendment and
recognizing that "do not delete or rewrite" left the _how to add
post-Complete information_ question open (TBD-resolution, supersede
notes, outcome maturation).
**Rationale**: Defines exactly one place for post-Complete additions
(`## Appending to Complete rounds` section at end of file) using a
literal code-block example, so there is no ambiguity about position
or shape. Avoids per-case rules (separate sections for Addenda /
Superseded / TBD-resolution) in favor of one section that absorbs
all post-Complete entries. Final-edit shape is the user's own —
preserves intent of minimum viable rule.
**Promoted by**: pasxd245 (Round_05 mid-Review amendment, human-
authored edit).

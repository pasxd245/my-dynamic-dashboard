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
Round*05 — the original "rounds are append-only" line was ambiguous
about whether ongoing (Planning/In Progress/Review) rounds could be
edited, and the "only humans flip Complete" line did not name itself
as policy-not-constitution.
**Rationale**: This session edited active rounds throughout (R1-R5)
— the rule needed to say so explicitly. Naming the human-only flip
as \_current policy revisable via a future round* also leaves a clean
path for autopilot/autoagent modes to relax it via PDCA later, rather
than forcing a constitutional break.
**Promoted by**: pasxd245 (Round_05 mid-Review amendment).

## 2026-05-23: Appending-to-Complete-rounds rule → `plan/PDCA.md`

**Source**: human-edited directly into PDCA.md Governance during
Round*05 Review — surfaced by reviewing the previous amendment and
recognizing that "do not delete or rewrite" left the \_how to add
post-Complete information* question open (TBD-resolution, supersede
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

## 2026-05-23: Drifted iteration reference hub → `context/drifted-iteration.md`

**Source**: Round_10 HIxAI review and the extracted drifted-iteration
lessons in `.agents/memory/`.
**Rationale**: The old drifted checkout is local-only and gitignored,
so direct links to it create context rot. Promoting a hub gives future
rounds a durable summary, lesson index, citation discipline, and
retirement procedure.
**Promoted by**: pasxd245 (Round_10, explicit human authorization).

## 2026-05-24: DCBF feature methodology + conformance discipline → `context/contract-driven-feature.md`

**Source**: three memory files capturing the methodology and its
per-layer conformance discipline as they were built up across the
first complete DCBF cycle —
[contract-round-methodology](../memory/2026-05-24-contract-round-methodology.md)
(R15),
[be-round-conformance-pattern](../memory/2026-05-24-be-round-conformance-pattern.md)
(R16),
[fe-round-typecheck-pattern](../memory/2026-05-24-fe-round-typecheck-pattern.md)
(R17).
**Rationale**: Three concrete instances across Design → Contract → BE
→ FE, with consistent vocabulary (locked YAML, hand-aligned types,
per-endpoint conformance, fetch-mock tests) and zero shape mismatches
escaping the conformance net. Meets the `context/` bar in
[governance.md](../context/governance.md) ("stable pattern, validated
3+ times, broadly applicable"). The context file captures principles,
when/why, and the "default = don't add" guards; the source memos stay
in `.agents/memory/` (Status: Promoted) as the operational how-to.
**Promoted by**: pasxd245 (Round_18, explicit human authorization
via "go with R18 (consider this will a heavy round), the lesson-learn
is important").

## 2026-05-25: D-step-picks-the-chain framing → `context/contract-driven-feature.md`

**Source**: two-instance evidence from the upload chain
([Round_14](cycles/Round_14.md) → [Round_17](cycles/Round_17.md), all
four phases) and the parse-options chain
([Round_19](cycles/Round_19.md) → [Round_21](cycles/Round_21.md),
D + B + F only — C collapsed because R15 had already landed the
schema). The "D-step picks the chain" framing was named in R19's
mid-round self-correction and confirmed when R20 + R21 shipped on
that partial chain.
**Rationale**: The original `context/` doc had a "When not to use
DCBF" negative-framing section but no affirmative complement.
Future rounds that read the doc would learn when to refuse the
chain entirely, but not how to scope the chain to fewer than four
phases when one phase is genuinely unnecessary. The amendment adds
"What the D-step decides" between the don't-add guards and the
when-not-to-use section, citing both instances by name. Additive,
~22 lines, principles 1–5 unchanged.
**Promoted by**: pasxd245 (Round_22, "let's go with R22" — read as
authorization under the [governance.md § Explicit Human
Instructions](../context/governance.md) precedent set by R18).

## 2026-05-25: Behavior-conformance sub-rule amendment → `memory/2026-05-24-be-round-conformance-pattern.md`

**Source**: R20's three BE behavior tests (CSV `parse_options`
end-to-end — the gap R16's shape conformance missed) and R21's
four FE reducer behavior tests (dispatch-then-assert-next-state,
not just dispatch-was-accepted). Two instances; same sub-rule;
both sides of the wire.
**Rationale**: Memo-level amendment, not `context/` promotion.
Two instances meets the threshold for capturing the pattern in
the memo (where future agents will find it next to the rest of
the conformance discipline) but is one instance short of the
Evolution Rule's 3-instance `context/` bar. A third instance in a
different feature would justify lifting the sub-rule into the
`context/` doc's principle 5. Memo `Status: Promoted` unchanged —
the amendment extends what's already in `context/`, doesn't
replace it.
**Promoted by**: pasxd245 (Round_22, same authorization basis).

## 2026-05-28: Brainstorm-housing convention → `plan/PDCA.md` + `plan/brainstorms/`

**Source**: [Round_46](cycles/Round_46.md) (brainstorm-housing
convention). Added a new doc area at
`.agents/plan/brainstorms/<YYYY-MM-DD>-<slug>/` and a
`## Brainstorm lifecycle (optional)` section to `PDCA.md` between
Naming Convention and Round Template, naming the
brainstorm → decision → round flow. First instance:
[`brainstorms/2026-05-28-hybrid-flow/`](brainstorms/2026-05-28-hybrid-flow/)
(4 docs + README), consumed by R47.
**Rationale**: Multi-doc pre-decision brainstorm chains need a
durable home with a discoverable convention. The pattern is
**optional**, not mandatory: most rounds keep rationale inline in
`## Why`; the chain shape exists for the cases where pre-decision
analysis is multi-doc and worth preserving as historical record.
Track-1 anchor (per Evolution Rule): DCBF chain experiment
(R14→R21) yielded fair-only results for over-effort, D-phase
overwhelmed as design-corpus scope grew — pulled the DCFBI/DFCFBI
pivot that R47 codifies, which pulled R46 as enabling plumbing.
**Promoted by**: pasxd245 (Round_46, explicit AskUserQuestion
approval 2026-05-28: "Yes — short section in PDCA.md").

## 2026-05-28: Hybrid flow governance → `decisions/2026-05-28-hybrid-flow-governance.md` + `AGENTS.md` horizons

**Source**: [Round_47](cycles/Round_47.md) (DCFBI/DFCFBI governance
codification). Written a new decision artifact at
[`decisions/2026-05-28-hybrid-flow-governance.md`](../decisions/2026-05-28-hybrid-flow-governance.md)
binding **DCFBI default**, **DFCFBI conditional** (2-of-5 flow
selector), **O-rule cross-cutting invariant** (three truths: UX /
data behavior / execution), and **F1 timebox** (≤2 working days,
1 FE, no contract-shape changes, no silent overrun). One new
bullet appended to [`AGENTS.md § Operative horizons`](../AGENTS.md)
making the decision discoverable at session load.
**Rationale**: Process governance was previously implicit in
PDCA.md + the DCBF context promotion. As design-corpus scope grew,
implicit governance stopped scaling — D-phase overwhelm + over-
effort-for-fair-results surfaced via R47's brainstorm chain (see
the 2026-05-28 entry below). Decision artifact makes the
operating-model pivot binding from R48 onward; AGENTS.md horizons
bullet makes it loadable. Track-1 anchor: DCBF chain experience
(R14→R21, `../context/_archive/contract-driven-feature.md`).
**Promoted by**: pasxd245 (Round_47, explicit authorization
2026-05-28: "go with R47").

## 2026-05-28: Skills bootstrap → `.agents/skills/` + `.claude/skills/` + AGENTS.md horizons

**Source**: [Round_49](cycles/Round_49.md) (DCFBI/DFCFBI skill set
bootstrap). Established `.agents/skills/` as the durable home for
project skills (alongside `.agents/context/` and `.agents/memory/`)
and `.claude/skills/` as the runtime-discovery location via thin
`skill-ref` pointer stubs (the `a2scaffold` convention staged with
the `research` skill). Three skills landed:

- **`flow-selector`** (primary) — runs R47's 2-of-5 selector at
  Design exit; records `Flow: DCFBI` or `Flow: DFCFBI (triggers N,M)`
  in the round's Do log.
- **`gate-walker`** (primary) — verifies a named Hard Gate's exit
  criterion is documented as met before phase advance; blocks
  with remediation pointer if open. DCFBI/DFCFBI branching reads
  the round's `Flow:` line.
- **`research`** (dependent) — generic research procedure (frame
  question → choose sources → collect evidence → evaluate →
  synthesize → report). Authored externally by `a2scaffold`;
  R49 enhanced its frontmatter (`when_to_use`, `allowed-tools`)
  and indexed it under the dependent-skill class. Bundles
  `crawl4ai.md` reference + Python recursive-crawler script.

[`AGENTS.md § Operative horizons`](../AGENTS.md) gained one new
bullet pointing at [`.agents/skills/README.md`](../skills/README.md)
so the skills index is discoverable at session load.

**Rationale**: R48's archive of `context/contract-driven-feature.md`
proved that doctrine without operational tooling leaks back as
contradictory state. R47 codified DCFBI/DFCFBI as prose; R49
builds the minimum executable tooling so the first DCFBI/DFCFBI
trial (R50) runs against mechanism, not just memory. Primary
skills enforce the doctrine on round files; the dependent
`research` skill is shipped now as the first non-workflow utility
because flow-selector condition #2 (prior-art check for "new
interaction pattern") needs it. Four other DCFBI skills sketched
(`f1-timeboxer`, `o-rule-checker`, `round-scaffolder`,
`contract-v2-router`) are deferred until R50+'s trial surfaces
which one earns the next slot — per the "narrow until reversible"
discipline R48 codified in
[`memory/2026-05-28-dcbf-to-dcfbi-pivot.md`](../memory/2026-05-28-dcbf-to-dcfbi-pivot.md).
Track-1 anchor: same DCBF→DCFBI break-point that pulled R46→R48.

**Promoted by**: pasxd245 (Round_49, explicit authorization
2026-05-28: "proceed" after planning review).

## 2026-05-29: `markdown-check-link` skill → `.agents/skills/markdown-check-link/` + PDCA bullet

**Source**: [Round_50](cycles/Round_50.md) (pre-trial link
integrity tooling). Authored a new **dependent** skill at
[`.agents/skills/markdown-check-link/SKILL.md`](../skills/markdown-check-link/SKILL.md)
with a bundled stdlib-only Python script
[`scripts/check_links.py`](../skills/markdown-check-link/scripts/check_links.py)
that verifies markdown links resolve to existing files +
headings. Default scope reads
[`.markdownlint-cli2.jsonc`](../../.markdownlint-cli2.jsonc)
`globs` + `ignores` as the single source of truth for "what
markdown the repo cares about"; falls back to
`.agents/**/*.md` if the config is missing; raises an error
if the config is present but unparseable (don't silently
shadow a broken source of truth). Every run writes
`links.json` (full inventory) + `broken.md` (grouped
human-readable report) under
`.agents/tmp/markdown-check-link/` (gitignored). Opt-in
auto-correct via `--fix` / `--dry-run` applies only three
conservative candidates (case-only path, case-only
fragment, single unambiguous basename); anything else
stays as a suggestion in the report. Skill indexed in
[`.agents/skills/README.md`](../skills/README.md) under
`## Dependent skills`. One new **optional** bullet in
[`PDCA.md § Post-round audit`](PDCA.md) names the skill
as a companion to `markdownlint-cli2` — not mandatory, to
avoid gate-theater per the Hybrid Flow doctrine.

**Rationale**: R49 Risks named the load-bearing failure
mode (AGENTS.md horizons bullet pointing at a non-existent
README → every session-load hits a broken link); R48's
archive operation surfaced the same drift shape across the
corpus. The DCFBI/DFCFBI chain (R47) expands cross-link
surface dramatically — round files cite decisions,
decisions cite design, gate-walker output cites round
files. R50 ships the structural fix before R51's first
trial reaches the surface. Skill is intentionally
_dependent_ (generic, no round-file coupling) — peer to
`research`, callable from any task. Track-1 anchor: same
DCBF→DCFBI break-point that pulled R46→R49; R50 closes the
pre-trial tooling gap.

**Follow-up gated at Review**: 192 broken links surfaced
on R50's own self-test run, mostly R48-archive trail +
contract-file `../` depth bug. The decision whether to
invoke `--fix` (and against which subset) is user-gated
at Review per R50 plan direction.

**Promoted by**: pasxd245 (Round_50, explicit authorization
2026-05-28: "go ahead" after iterative planning review).

## 2026-06-14: Heart held in dynamic equilibrium — `AGENTS.md` Evolution Rule + new sections

**Source**: R72 retrospective (this session). The constitution
presented only the brake ("Default = don't add") on first load,
risking the heart being read as a locked cage (lock-in risk).
Logged per [governance § Explicit Human Instructions](../context/governance.md).
**Change**: (1) new `### Dynamic equilibrium` section — names the
Rule as the **brake** half of accelerate⇌brake and asserts the heart
itself **evolves** (add when a round pulls it, prune when stale), with
a Track-2 / artifact-only justification citing the
[R99 evo-horizon](../decisions/2026-05-27-r99-evo-horizon.md); (2)
Evolution Rule generalized to a **catch-all** ("or any new agent-OS
addition") so the cite-track+pull discipline covers future addition
kinds, not just the closed list; (3) human-added **Telos Check** + an
explicit **Pruning discipline**, with the 4×-redundant prune/value
idea consolidated to one statement; (4) compacted 109→87 lines
(prettier / markdownlint clean) via lossless rewrap + that one
consolidation (verified by mechanical word-diff against the reviewed
version, not an LLM self-check).
**Rationale**: Surfacing the existing
[purpose.md § Dynamic equilibrium](../context/purpose.md#dynamic-equilibrium)
principle into the first-load heart prevents the brake-only misread;
the catch-all and pruning discipline tighten governance at least
mechanism. Track 2 (agent-method governance-doc clarification,
artifact-only — within the R99 evo-horizon, not Track-3 system-building).
**Promoted by**: pasxd245 (2026-06-14, "I reviewed. Please commit
changes" — after iterative review incl. a code-review pass that
reclassified Track 3→2 and restored two review-caught drops).

## 2026-08-15: The acceptance walk artifact → `plan/PDCA.md` § Round Template + `.agents/memory/`

**Source**: [Round_173](cycles/Round_173.md), executing the graduation
pre-authorized with the human at [Round_171 § Feeds into](cycles/Round_171.md).
The artifact had been hand-used for five rounds (R165–R171) with **no repo
definition and no lint**, so it travelled round to round by imitation —
which transmitted its accidents as faithfully as its intent. Two of those
accidents were caught by the human, not by any gate: the **five-question
count** was an unexamined anchor (it cost R171's item 3 a walk question),
and the artifact's whole spec lived in an agent-private memory file while
four round files cited a slug the repo could not resolve.
Logged per [governance § Explicit Human Instructions](../context/governance.md).
**Change**: (1) `plan/PDCA.md` § Round Template `## Check` gains a **6-line**
acceptance-walk item — it **applies to rounds that change something a human can
exercise** (a UI surface or observable product behaviour) and otherwise requires
an explicit **skip + reason**, mirroring the phrasing the visual-verification
gate in the same file already uses; when it applies, always record questions +
⬜ + `coverage: N of M`, spec exact steps only on ask, **count follows the
surfaces** (no prescribed number), relocate from acceptance criteria / Risks,
drop what a test closes. _The trigger condition was added mid-round, after the
human read the unconditional first draft and challenged it; R173 itself then
became the first logged skip._ (2) new
`.agents/memory/2026-08-15-walk-record-always-spec-on-ask.md` carrying the why
and the four-instance dogfood ledger (R165 · R166 · R167 · R171, four domains,
**none refuted**; R168's skip kept as the counter-example), plus R171's two
late findings — the count anchor, and that a verdict can arrive globally and
has a third state ("fixed, UNWALKED" is neither PASS nor FAIL). The file's
name resolves the 16 dangling `[[walk-record-always-spec-on-ask]]` citations
in R166/R167/R168/R171.
**Rationale**: the trigger the memory file set for itself had fired — five
rounds of hand-use, and the human corrected the artifact's *method* (R167) and
its *count* (R171), which is stronger evidence of "read" than the criterion
asked for. **Deliberately no lint** and deliberately **not** a skill: a check
can verify a walk was *recorded* but not that its *return* was read, and that
return is the entire value (per `adopt-artifact-defer-enforcement`; same call
as the R159 ⟢ At a glance block). Track 2 (agent-method), artifact-only.
**Promoted by**: pasxd245 (2026-08-15, "Sign-off, please proceed" — after
scoping the round to "ship as specced, record the 42", then **reading the
shipped rule and refusing its first draft**: they asked whether an acceptance
walk is always required, which added the trigger condition above. Graduation
pre-approved 2026-08-15 at R171, sequenced at R172 § Feeds into).

## 2026-10-18: Four lessons of R191–R197 → `.agents/memory/` + `skills/review-*` checklists

**Source**: the `## Act` candidate lessons of
[Round_192](cycles/Round_192.md), [Round_194](cycles/Round_194.md),
[Round_196](cycles/Round_196.md) and [Round_197](cycles/Round_197.md), each
written "memory, if it recurs" — and each had already recurred by the
2026-10-18 audit of R191–R197 (8 P0 / ~27 P1 raised across seven rounds,
recurring in six finding types; nothing promoted since R173). Four memory
files, in the template's format, each carrying its instance table:

- [`2026-10-18-missing-side-matrix.md`](../memory/2026-10-18-missing-side-matrix.md)
  — a comparison label needs a test per absent input (R197; recurred from
  R192 and R195) → `review-ba` § Contract-exit item 3.
- [`2026-10-18-error-code-ships-with-client-union.md`](../memory/2026-10-18-error-code-ships-with-client-union.md)
  — a new error code ships with its client union, MSW and types in the same
  commit (R192; R193 `oneOf`; R196 `export_too_large`) → `review-cr` item 4.
- [`2026-10-18-bind-time-validation-vs-drift.md`](../memory/2026-10-18-bind-time-validation-vs-drift.md)
  — a bad late-bound value is `param_invalid`, never `query_stale` / 500
  (R194 ×3; R191 P0) → `review-cr` item 5.
- [`2026-10-18-file-outlives-its-headers.md`](../memory/2026-10-18-file-outlives-its-headers.md)
  — anything a saved export must say goes in the file (R196; R194) →
  `review-ba` item 7, `review-qa` item 8.

Shipped with them, same commit (milestone M1.1–M1.2): the four roles of the
loop as Claude Code agent definitions (`.claude/agents/{coder,ba,code-reviewer,qa}.md`),
the three reviewer checklists as skills
([`review-ba`](../skills/review-ba/SKILL.md), [`review-cr`](../skills/review-cr/SKILL.md),
[`review-qa`](../skills/review-qa/SKILL.md), indexed in
[`skills/README.md`](../skills/README.md)), the per-round counts in
[`.agents/metrics/agents.csv`](../metrics/agents.csv), and two lines in
[rc3.md § Execution](programs/release-rc2-rc5/rc3.md#execution--the-four-role-loop-from-2026-10-18):
the per-role prune rule (no P0/P1 for two consecutive rounds → dropped,
re-added when a P0 escapes) and "a candidate lesson that recurs a second time
is promoted in that round, not deferred".
**Rationale**: the loop ran seven rounds from a hand-written brief, and the
brief did not carry what the rounds learned — the same finding types came back
(R195 and R196 ran without the contract-exit pass; R195 shipped the P0 that
pass asks about). Each lesson has two or more instances in different domains,
which meets the memory bar; the checklist item is the smallest mechanism that
makes the next reviewer ask the question. No lint, on purpose — the dogfood
first (per `2026-08-15-walk-record-always-spec-on-ask`). Track 2
(agent-method), artifact-only.
**Promoted by**: Vien Pham Quang (2026-10-18, the M1.1–M1.2 brief: "the lessons
of R191–R197 get promoted to memory"; files drafted by the coding agent, human
review on merge to `main`).

## 2026-10-19: Explicit order, not an engine default → `.agents/memory/` + `skills/review-cr` item 13

**What**: (1) new
[`2026-10-19-explicit-order-not-engine-default.md`](../memory/2026-10-19-explicit-order-not-engine-default.md)
— a paged read or a row listing needs an explicit `ORDER BY`; three measured incidents on three
read paths (R165 W-7 stepped, R172 joined, R199 CR-1 filtered single-source), the third named in
advance by R171. (2) item 13 of [`review-cr`](../skills/review-cr/SKILL.md): every paged read /
listing the diff touches has an `ORDER BY` on a stable key or a written reason + guard test; a
test that `sorted()` its rows is a finding; probe at ≥ 130k rows.
**Rationale**: the in-round rule of
[rc3.md § Execution](programs/release-rc2-rc5/rc3.md#execution--the-four-role-loop-from-2026-10-18)
— a lesson that recurs a second time is promoted in that round. R199's own coder logged the
symptom as an order quirk and its first test sorted the rows; the code reviewer's large-scale
probe found the P1. The checklist item is the smallest mechanism that makes the next reviewer ask
before the probe. No lint. Track 2 (agent-method), artifact-only.
**Promoted by**: drafted by the coding agent in Round_199 under the standing rc3 § Execution rule
(human, 2026-10-18); human review on merge to `main`.

## 2026-10-19: After a write, check the after-state with the app's cache → `.agents/memory/` + `skills/review-qa` item 10

**What**: (1) new
[`2026-10-19-stale-cache-after-a-write.md`](../memory/2026-10-19-stale-cache-after-a-write.md)
— a mutation must invalidate every read whose answer it changes; test the after-state with the
app's `QueryClient` defaults and read every after-screenshot for leftover state. (2) item 10 of
[`review-qa`](../skills/review-qa/SKILL.md).
**Rationale**: the in-round rule of
[rc3.md § Execution](programs/release-rc2-rc5/rc3.md#execution--the-four-role-loop-from-2026-10-18)
— the class recurred twice in Round_200 (QA-1: a history read cached past a dataset refresh;
BA-F1: the Metadata panel cached past a restore), both behind green tests that used a bare
`QueryClient`, the second visible in the coder's own screenshot. `review-cr` item 6 already asks
the code-side question; the QA item makes the live after-state the check. No lint. Track 2
(agent-method), artifact-only.
**Promoted by**: drafted by the coding agent in Round_200 under the standing rc3 § Execution rule
(human, 2026-10-18); human review on merge to `main`.

## 2026-10-19: Loop an equality gate before trusting it → `skills/review-qa` item 11 (+ the explicit-order memory)

**What**: (1) item 11 of [`review-qa`](../skills/review-qa/SKILL.md): a parity / byte-equality
test is re-run at least 5× in a loop before its green is trusted, and the count is recorded; a
red run in the loop is a P1 until its cause is named. (2)
[`2026-10-19-explicit-order-not-engine-default.md`](../memory/2026-10-19-explicit-order-not-engine-default.md)
gains the R201 row (grouped `/aggregate` with no `ORDER BY`).
**Rationale**: the in-round rule of
[rc3.md § Execution](programs/release-rc2-rc5/rc3.md#execution--the-four-role-loop-from-2026-10-18)
— the explicit-order class recurred a fourth time in Round_201 (QA-4 = BA-F1)
although `review-cr` item 13 already asked the code-side question: the coder's parity test passed
in every gate run and QA's 40-read probe found two orders. The code-side item did not catch a
few-row `GROUP BY`; repetition did, so the QA checklist makes repetition the check. No lint.
Track 2 (agent-method), artifact-only.
**Promoted by**: drafted by the coding agent in Round_201 under the standing rc3 § Execution rule
(human, 2026-10-18); human review on merge to `main`.

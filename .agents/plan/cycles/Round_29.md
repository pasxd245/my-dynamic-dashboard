# Round 29: Foundation Chain Evaluation & Round 30 Direction Setting

**Status**: Planning (drafted ahead of Round 28 close — review-only until Round 28 completes)
**Date started**:
**Date completed**:

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Round type**: Evaluation / synthesis — mirrors Round 20.
> No new features. The deliverable is a decision, not code.

## Goal

Pause feature work. Evaluate the seven-round foundation chain (Rounds
22-28: SQLModel, structural audit, Source/Provider, tooling, tests,
builder UI, dashboard UI) end-to-end against the **MVP-1 acceptance
criteria** in `docs/analysis/09-mvp-plan.md`. Surface regressions, prove
that the foundation actually pays off (not just on paper), and set the
direction for Round 30+ — the first round that delivers user-visible
MVP-1 value. This is the analysis/09 "feedback gate" between MVP-1 work
phases.

## Plan

- [ ] Wait for Round 28 Complete
- [ ] Confirm all of Rounds 22-28 are `Status: Complete` and their
      Q&A blocks are answered (the answers feed Round 30 candidate
      scoring)
- [ ] Lock the evaluation rubric (see "Evaluation Dimensions" below)
- [ ] Decide stakeholder reach for the feedback gate. Locked: at
      minimum self-review + 1-2 colleague walkthroughs (matches
      analysis/09 "Ask 1-2 colleagues" gate). Optional: record a
      demo video for async review.
- [ ] Decision Gate A: if the foundation chain failed an evaluation
      dimension (e.g. perf SLOs missed, demo flow broken), the
      output is a **remediation round** before any feature work.
- [ ] Decision Gate B: Round 30 candidate selection — present 3
      candidates with trade-offs, do NOT auto-pick.

## Do

(filled by `/speckit.implement` + agent reconciliation — but most of
this round is observation, not implementation)

### Evaluation dimensions

1. **MVP-1 demo flow end-to-end**
   Run the analysis/09 acceptance flow against the running stack:
   upload Excel/CSV (≥100k rows) → schema detected → relationship
   defined → query built → preview <5s → execute → export Excel/CSV.
   - PASS = flow completes with no manual SQL / DB fiddling
   - FAIL on any step = remediation round before Round 30

2. **Performance SLOs** (from Round 26 perf harness)
   - upload 100k rows < 30s
   - preview query < 5s
   - full export < 30s
   - Capture actuals; document hardware (WSL2 dev box).

3. **Code health metrics** (CRG-driven, before vs. after)
   - Total nodes / edges / files / communities
   - Hub-node concentration (top 10 total_degree)
   - Cross-community edge count (lower = better separation)
   - Persistence community isolation (Round 22 goal: leaf node)
   - Compare against the Round-21-end baseline:
     `Files: 131, Nodes: 938, Edges: 7135` (per CRG stats at session
     start). Snapshot the post-Round-28 numbers and diff.

4. **Test posture** (from Round 26)
   - Count by layer (unit / integration / contract / perf)
   - Coverage delta (Round 26 enabled `coverage` in pyproject)
   - Flake rate over last 5 CI-equivalent local runs
   - Factory adoption: how many tests use factories vs. ad-hoc fixtures

5. **Config + structure drift check**
   - `grep -rn "os.getenv\|os.environ" apps/backend/app apps/dashboard/`
     returns zero hits (per Rounds 23 + 28)
   - `grep -rn "import.meta.env" apps/builder/src` returns zero hits
     outside `config/appConfig.ts` (per Round 27)
   - `grep -rn "metadata_db" apps/backend/app/` returns zero hits
     (per Round 23)
   - All four `pyproject.toml`s build cleanly (`apps/backend`,
     `apps/dashboard`, plus any others added)

6. **Pattern adherence to references**
   - i18n-tool config-manager parity: AppConfig + load_config + Const
     - Fields present in backend AND dashboard
   - hg_code Provider parity: SourceRegistry + Source base + at least
     one concrete subclass (`ExcelSource`)
   - Round-23 layout (core/apps/utils) preserved in both Python apps;
     parallel layout in builder (config/api/components/pages/state/
     hooks/utils/types)

7. **Colleague walkthrough**
   Per analysis/09: ask 1-2 colleagues to:
   - Upload a real CRM export
   - Define a relationship
   - Build a query
   - Export to Excel
     Capture: what worked, what confused them, what they wanted next.
     Score 0-10 readiness; analysis/09 says proceed to MVP-2 only if
     3+ people score it 7+/10.

8. **Foundation-cost ledger**
   Honest accounting: how many days did Rounds 22-28 actually take
   vs. estimate? Where did we underestimate? Did the "pain at
   beginning, save later" framing hold, or did it cost more than
   the future savings will recover?

### Deliverables

- `docs/agents/round-29-evaluation.md` — full evaluation report
  with all 8 dimensions, metrics tables, and walkthrough notes.
- `docs/agents/round-29-foundation-vs-baseline.md` — CRG
  before/after diff and the foundation-cost ledger.
- Updated `docs/analysis/09-mvp-plan.md` if MVP-1 acceptance
  criteria need adjustment based on what we now know.
- Round 30 candidate sheet (in this round file's Q&A block) —
  3 candidates, trade-offs, recommendation.

## Check

- [ ] All 8 evaluation dimensions completed and logged in
      `docs/agents/round-29-evaluation.md`
- [ ] MVP-1 demo flow PASSes end-to-end (or remediation round
      explicitly chosen)
- [ ] At least 1 colleague walkthrough recorded with notes
- [ ] CRG before/after diff committed
- [ ] Round 30 candidate sheet has 3 candidates, each with: scope
      sketch, estimated round count, primary risk, and a
      recommendation column
- [ ] `/speckit.analyze` -> no CRITICAL findings on the
      evaluation deliverables themselves

## Act

(filled at round close)

**Learnings**:

- (Foundation chain post-mortem: what worked, what we'd do
  differently)
- (Reference-repo learnings: did i18n-tool / hg_code patterns
  hold up under our codebase, or did they need adaptation?)
- (Cadence: was "1 feature per round" the right grain for the
  foundation chain, or should we revisit?)

**Promotions**:

- [ ] -> context/ : "evaluation round template" — formalize this
      pattern (mirrors Round 20) so future foundation chains end
      with a deliberate pause
- [ ] -> skills/ : maybe a `pdca-evaluate` skill for synthesis
      rounds, distinct from `pdca-next` executor

## Round 30 candidate slate

To be drafted during this round's Do phase, populated with the
answers from Rounds 22-28's Q&A blocks. Provisional candidates
(replace at evaluation time):

- **A. Relationship graph CRUD + React-Flow canvas + join-path resolver**
  Largest remaining MVP-1 gap. Hits builder, backend, network. Likely
  2-3 rounds.

- **B. Excel/CSV export endpoint + UI download**
  Closes the analysis/09 demo loop ("upload -> relate -> query ->
  export"). Smallest single-feature round. Likely 1 round.

- **C. Multi-sheet Excel picker (Source-abstraction's first concrete user)**
  Validates Round 24's abstraction with a real second behavior.
  Likely 1-2 rounds.

- **D. Fuzzy column-rename matcher (writes to column_mappings)**
  Activates the Round-22-staged table + adapts hg_code's `fuzzy_algo`.
  Likely 1 round.

- **E. Dashboard feature (saved-query gallery / parameterized
  dashboards / scheduled refresh)**
  User stated "UI is where value is delivered" — promotes a
  dashboard candidate to MVP-1 first-feature contender even though
  analysis/09 originally placed dashboard in MVP-2.

## Questions for user before Round 30

1. Of the 5 candidates above, which 3 should we drop into the formal
   selection sheet? Which becomes Round 30?
2. Did the colleague walkthrough surface a feature that wasn't on
   any of A-E? Add it.
3. Was the foundation chain (Rounds 22-28) worth it in retrospect?
   If yes, capture the framing for the next foundation pivot.
   If no, what would we do differently for the next big debt cycle?
4. Continue the "1 feature per round + end-of-round Q&A" cadence
   into MVP-1 features, or batch related features when the demo
   flow demands it?

**Round transition**:

- On Complete: Round 30 begins MVP-1 feature work. The chain has
  delivered the foundation; from here on, every round produces
  user-visible value.

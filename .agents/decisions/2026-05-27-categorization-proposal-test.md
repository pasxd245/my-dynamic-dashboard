---
# Identity
decided: 2026-05-27
source-round: conv:2026-05-27

# Classification
track: 2
status: active

# Substance
applies-when: an agent or human proposes adding a new field, enum, taxonomy, or categorization scheme to round files, decision files, or other agent-method artifacts
failure-mode: the proposal duplicates information already encoded in existing fields (Goal, Track, Pulled-by, prose) but adds friction and a new enum to maintain; speculative scaffolding accumulates ahead of any retrieval pain; asymmetric-option-value reasoning ("cheap now, expensive to retrofit later") gets normalized as a justification, defeating the Evolution Rule's pull bar

# Lifecycle
revisit-trigger: a retrieval miss surfaces that demonstrably cannot be served by existing fields (a named query fails on prose-based search; a docs-graph round actually starts and needs categorical attributes the existing fields don't carry); OR a concrete counter-example arises where Track + Pulled-by + prose truly failed to discriminate two rounds and the cost was real
promoted-to: null
---

# Decision: Test new categorization proposals against existing fields before adding

**Commitment**: When proposing a new field, enum, taxonomy, or
categorization scheme for agent-method artifacts (Round*NN.md
headers, decision frontmatter, etc.), first explicitly demonstrate
\_which existing field's job the new one is supposed to do, and
why that existing field is insufficient*. If the work is already
covered by Goal / Track / Pulled-by / prose, the proposal does
not meet the [Evolution Rule](../AGENTS.md)'s pull bar — reject
or defer.

## Why

The Evolution Rule sets the floor: _"Default = don't add. ...
only when a track-1 round (or a documented lesson from one)
actually pulls them in."_ This decision sharpens the test with
a concrete failure case.

A 2026-05-27 conversation thread proposed adding a
`**Type**: D/C/B/F/X` field to every Round_NN.md header. The
case bundled three candidate pulls:

1. **Present-tense ambiguity** — F (frontend feature) and X
   (tooling/extend) collapsed under `feat(builder):` commit
   scope (R31, R32, R41, R42 all got the same prefix as the
   real F rounds R36 and R40).
2. **Planning-time discipline** — forcing the author to declare
   round category before writing the scope.
3. **Future docs-graph option value** — a Type field becomes a
   natural node attribute when a graph round eventually lands.

On honest re-examination:

- Pull (2) was already paid by the existing Goal section's
  `Track + Pulled-by` declaration — those lines already force
  the same disambiguation, in prose, at draft time.
- Pull (1) was a real bug but at the wrong layer — the fix
  belongs in commit conventions (`chore(builder):` or
  `refactor(builder):` for non-feature builder changes), not
  in round-file headers. Fixing the symptom at a layer above
  the cause would have left the commit log still ambiguous.
- Pull (3) was speculative scaffolding the Evolution Rule was
  written to resist. The "asymmetric option value" framing
  ("cheap now, expensive to retrofit later"), applied
  consistently, justifies every preemptive addition.

Net: the proposed Type field would have added friction (one
required line per round, a backfill task across ~12 historical
rounds, an enum closing over a fuzzy domain) without producing
a new discipline that the existing fields didn't already enforce.
Rejecting it left the methodology smaller and more honest.

The lesson worth keeping is the _test itself_: before adding
categorization, show which existing field's job the new one
takes over, and why that field can't do the job. If you can't
name an existing field that fails, you don't have a pull — you
have an aesthetic preference.

## What this allows

- Adding a new categorization scheme when an existing field
  _demonstrably_ fails — the failure case is reproducible in
  current artifacts, not hypothetical. The proof goes in the
  decision file's `failure-mode:`.
- Intentional redundancy for ergonomic reasons (e.g., a
  prominent header tag mirroring a buried prose declaration) —
  provided the redundancy is named as the goal, not hidden
  behind a queryability claim.
- Fixing ambiguity at the layer where it lives: commit scopes
  for git-log queries, round-file fields for planning-time
  discipline, decision frontmatter for cross-round retrieval.

## What this forbids

- New fields/enums/categorizations justified primarily by "a
  future tool would benefit." Future tools pull their own
  infrastructure when they actually start; until then, the
  retrofit cost is bounded (one-time LLM classification across
  the back-catalog).
- Aggregating many small speculative pulls into one "big"
  pull. Each pull must stand on its own present-tense evidence.
- Citing asymmetric option value as the _primary_ justification.
  It can appear as a secondary benefit, never as the load-bearing
  argument.

## Trade-off accepted

- **Slightly higher friction at proposal time** — proposers
  must do the existing-field check explicitly and write the
  result into the proposal. The check is the discipline; the
  friction is the point.
- **Some retrieval queries stay slow** — at N=43 rounds today,
  grep + prose covers every query we actually run. If retrieval
  pain surfaces at N=100+ or sooner, `revisit-trigger` fires
  with concrete evidence rather than speculation.
- **Backfill cost deferred, not avoided** — when a richer
  scheme eventually lands, retrofitting it across historical
  rounds is a one-time task, bounded by the back-catalog size.
  Paying that cost once, with real requirements in hand, beats
  paying a continuous maintenance cost on a speculative scheme.

_Track: 2. Pulled by: 2026-05-27 conversation thread proposing
`**Type**:` field on Round_NN.md — three candidate pulls
(commit-scope ambiguity, planning-time discipline, docs-graph
option value) all dissolved under the test "does an existing
field already do this job?" The lesson is the test itself; the
rejection of the Type proposal is the proof the test works._

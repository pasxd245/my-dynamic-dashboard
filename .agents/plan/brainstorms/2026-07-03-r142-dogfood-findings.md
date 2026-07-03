# R142 dogfood-probe findings — ranked friction backlog + the R143 pull

> **Status: SIGNED OFF (human, 2026-07-03) — the R142 probe's chartered output; R143 = F1+F2
> locked, month-2 write-off approved (Check boxes 1+4 of [Round_142](../cycles/Round_142.md)).** One real CRM operation walked through the whole loop:
> 5 real export files (3 monthly call-log workbooks FM1–3.25 + 2 cumulative CRM-lead snapshots),
> upload (human) → join/clean → shape → dashboard (agent, per the cold-review coverage fix).
> Findings F1–F13 live in the round file's friction log with per-finding evidence; this doc
> RANKS them and names the pull.
>
> _Track: 1 (product — the probe's chartered deliverable). Pulled by:
> [Round_142](../cycles/Round_142.md) Plan step "Synthesize"._

## Epistemics (how to read the ranking)

- **Findings are code-anchored product facts** (absences/behaviors in shipped code) — they
  reproduce on any data. The example files supply *illustration*, not frequency.
- Ranking = **structural severity** (silent-corruption ≥ loud-failure ≥ chore) ×
  **by-construction frequency** (fires-every-refresh ≥ fires-conditionally), NOT example counts.
- **Coverage caveat:** upload surface probed deep by the human; stages 2–4 walked once by the
  agent (capability evidence, thin UX-feel evidence). ② vs ⑥ ranking is capability-grounded
  either way.

## The headline the probe bought

**② blocks month 1; ⑥ blocks month 2; F2 underlies both.**

- The loop CLOSES today for a single month — join → aggregate → dashboard rendered real FM1
  data (`dsh_b41da51f`) — **except the time axis** (F11): a weekly/monthly breakdown is
  inexpressible (no date-bucket step; dates land dtype `string` at ingest). THE named report
  ("Weekly - Report Call") cannot exist even once. **② is the only missing piece of month 1.**
- Month 2 then hits the treadmill wall (F9 re-configure everything, F10 silent schema drift,
  F5/F6 overlapping re-exports irreconcilable — union cannot dedup; needs identity key +
  precedence, a domain decision). **⑥ is what keeps the report alive after month 1.**
- Both stand on trustworthy ingest dtypes, which F1 (mixed-type column → opaque 500 at commit,
  blocked FM2) and F2 (overrides metadata-only → leading zeros silently destroyed; date columns
  land as strings) currently deny. **F1+F2 is the prerequisite of both paths.**

## Ranked backlog (severity × by-construction frequency)

| Rank | Findings | What | Fires | Class |
|------|----------|------|-------|-------|
| 1 | **F1+F2** | commit honors dtype overrides; coercion failure → typed 422 naming column/cells (today: opaque 500 / silent corruption) | every export with a phone-like or date column — in THIS operation: every month | silent corruption + blocker |
| 2 | **F11 (②)** | date-typed ingest + `date_trunc`-style bucket step → THE report's time axis | every report with a time axis — i.e., the report itself | month-1 blocker |
| 3 | **F9+F10+F5+F6 (⑥)** | refresh mode on a dataset: settings carry-forward + schema-drift gate + row merge-on-key/precedence | every month-2+ upload, by definition | month-2 blocker; F5/F10 silent-wrong without it |
| 4 | **F8** | wizard: one sheet → N named ranges (backend already supports); unblocks clean dimension extraction (`Hot line` block) | every workbook with side-by-side tables (Master, both CRM files) | UX gap, cheap win |
| 5 | **F7 + F3 + F4 + F12 + F13 + R140 list** | UI/diagnosability batch: column show/hide default, error envelope + logging, temp sweep, `many_to_one` label, silent 422s (+ human's R140 items, pending) | continuous background friction | batch round |
| — | **④ export** | stays parked per the round's charter — no probe evidence changed its rank | — | parked |

## The R143 pull (named)

**R143 = F1+F2** — one thin round: the commit path applies `column_overrides` to the parquet
write (string/date coercion), and a coercion failure returns a typed 422 naming the column and
offending cells (replacing the opaque 500). Smallest verified blocker; unblocks the FM2 pass;
prerequisite to both ② (date-typed ingest) and ⑥ (stable merge-key dtypes, F5×F2).

**Order behind it:** ② (F11) → ⑥ theme (F9/F10 → F5/F6, multi-round, split by revert seam) →
F8 → UI-batch (F7/F3/F4/F12/F13 + R140). Re-rank allowed at each round's open per evidence.

## Month-2 in-product pass — proposed write-off (needs human sign-off)

Proposed: **write off as capability-analyzed, not executed.** Rationale: the month-2 findings
(F9/F10/F5/F6) are code-verified *absences* — an in-product FM3 run would demonstrate them, not
discover more; and the month-1 pass is blocked at F1 for FM2/FM3 phone columns anyway. If
rejected, execute FM3 through the wizard before close.

## Open before round close

1. Human sign-off on this doc (Check 4) — including the month-2 write-off and the F1+F2 pull.
2. R140 UI/UX list enumerated by the human (Check 3) — slots into rank 5; re-rank if anything
   in it is worse than "background friction".

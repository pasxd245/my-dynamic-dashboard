# Round 147: Merge-on-key / precedence — refresh for overlapping exports (⑥ / F5+F6)

**Status**: Planning
**Date started**: 2026-07-04
**Date completed**:
**Flow**: _TBD — run flow-selector at the Design gate exit._

## Goal

**Inherits from ← [Round_146](Round_146.md) "Feeds into"** (⑥ round 2, slid from R146 by the
R145 re-rank) — per the signed-off R142 order, the **⑥ refresh theme** continues. R145 shipped
refresh as **whole-table replace** (right for cumulative exports — FM2.25 superseded the prior
commit outright). This round covers the case replace cannot: **overlapping, non-cumulative
re-exports**, where the new file and the committed data share keys but neither is a superset.

- **F5 — merge needs an identity key + precedence, and `UNION` cannot fake it**: the two real
  CRM snapshots share 6,960 phone values, and under EVERY counting policy roughly half changed
  their call-status between snapshots — so `UNION ALL` double-lists and `UNION DISTINCT` keeps
  both (the rows differ). Dedup here is **record reconciliation**: keep-latest-per-key, which
  needs a declared key + a conflict rule (newest snapshot wins). Without it, month-2 data for
  a non-cumulative source is silently wrong.
- **F6 — the identity key is a domain decision the product cannot infer**: phone is NOT unique
  even within one file (the source's own `TRÙNG` column counts 1..8+ occurrences; 16,375
  in-file duplicate-phone rows). "One row per lead" is undefined until the human declares what
  a lead IS (phone? phone+creation-date? phone+car?). The mechanism (pick key column(s) +
  precedence, latest-wins) is generic; the *choice* is not.

After this round: refresh serves both real export shapes — cumulative (replace, R145) and
overlapping partial (merge-on-key, this round) — and month-2 stops being a correctness risk
for non-cumulative sources. The **AI-propose-key** slice (agent proposes, human verifies
meaning — the natural #2 AI-loop moment F6 names) is explicitly **NOT this round**: #2 is
additive, never load-bearing; the manual key pick must stand alone first.

_Track: 1. Pulled by ← [Round_146](Round_146.md) Feeds-into + the signed-off ranking in
[2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md)
(rank 3, ⑥ = month-2 blocker; F5 upgraded to correctness risk) + the R145 boundary note in
[upload.md § Refresh](../../design/data-management/datasets/upload.md) ("replace can't dedup
overlapping partial exports; that wall pulls the merge round next").
D-gate first per the d-gate-artifact-in-design-corpus lesson._

## Plan

- [ ] **D**: design-corpus touches, signed off before code:
      [upload.md § Refresh](../../design/data-management/datasets/upload.md) extends with a
      **merge mode** — the noun-vs-mode question first: merge as a refresh-commit **choice**
      (replace | merge-on-key) inside the existing wizard vs a workflow-step home
      ("keep latest per key" IS expressible as one DuckDB window step — but R142 filed it as
      an ingest/⑥ gap, and refresh-time merge keeps the dataset the single source dependents
      read; weigh both, pick one, name the rejected home). Then: key declaration UX (pick key
      column(s) on first merge; persisted where — `commitSettings` on `source.json` is the
      R145 seam), precedence rule (latest-wins = incoming file wins; is anything else needed
      round 1?), **row-absence semantics** (a key present in the committed data but absent
      from the incoming partial export must be KEPT — that is the difference from replace),
      and **in-file duplicate policy** (F5's first-row/last-row ambiguity: what does merge do
      when the incoming file itself repeats the key —
      **domain decision, ask the human**, same class as drift severity in R145).
      [datasets.md](../../design/data-management/datasets/datasets.md) — whether the merge/
      replace choice and the declared key surface on the dataset detail.
- [ ] **Domain decisions at D (human)**: (1) the identity-key declaration UX + whether a
      declared key is remembered per dataset; (2) in-file duplicate handling; (3) replace vs
      merge as a per-refresh choice or a per-dataset setting.
- [ ] **Flow selector** at D exit; record the table in Do. (A key-picker step in the refresh
      wizard is likely a new interaction; merge of live data is high user-error risk —
      let the selector decide.)
- [ ] **C**: contract — the batch/refresh request gains the merge shape (mode + key columns);
      merge-report shape (rows matched/updated/inserted/kept); error envelopes (unknown key
      column, key-dtype mismatch — reuse the 422 families where they fit).
- [ ] **B**: DuckDB-first merge (keep-latest-per-key over committed parquet + incoming
      staging; the R145 atomic directory-swap discipline extends — validate on staging BEFORE
      any swap); key-dtype guard (F5×F2: the drift gate already surfaces dtype changes — the
      merge path must hard-check the KEY column's dtype specifically, a silent mismatch =
      false non-overlap).
- [ ] **F**: refresh wizard gains the replace|merge choice + key picker + merge summary in
      the confirm step (counts: updated / inserted / kept).
- [ ] **I**: i18n en+vi — per the R146 lessons: grep the corpus for existing renderings
      before coining copy; "tập dữ liệu"; EN loanwords only for Dashboard/sheet/widget;
      value-only residual sweep. Design-sync.
- [ ] Tests: the real CRM pair as the fixture shape (6,960 overlapping keys, ~half changed →
      merged result has ONE row per key with the incoming status; absent-from-incoming rows
      kept) · in-file duplicate per the D decision · key-dtype mismatch → typed 422, dataset
      untouched · merge failure mid-way leaves the committed dataset intact (atomicity) ·
      replace path unregressed.

## Risks / unknowns

- **Noun-vs-mode / build-home** — refresh-commit mode vs workflow-step home. Default leans
  refresh-mode (the ⑥ framing + dependents read the dataset), but the
  workflows-extend-query-DuckDB-first doctrine says shaping lives in steps; D must argue it,
  not assume it. If D picks the step home, the round re-scopes — flag and stop, don't absorb.
- **Key + precedence are domain decisions** (F6) — the round hard-stops at D for the human;
  the `TRÙNG` lesson stands. Agent proposes the table of options, human declares.
- **In-file duplicates make "latest-wins" ambiguous** — file row order is not time; if the
  incoming file repeats the key, "which row wins" needs a rule (last-in-file? reject-loudly?).
  Don't invent silently; surface at D.
- **Fat-point watch: the key-picker UX** — declaring a composite key mid-wizard could balloon.
  Seam if it grows: slice 1 = single-column key + latest-wins; composite keys / precedence
  variants defer with trigger named.
- **F5×F2 residual** — dtypes are trustworthy since R143, but the merge key is the one column
  where a dtype drift = silent false non-overlap; the drift gate warns, the merge path must
  treat a key-dtype change as its own loud stop (warn-never-block was scoped to drift review,
  a corrupt merge is a different severity class — confirm at D).
- **Carried, not this round**: R145 slice **1b** (drift blast-radius preview — per-column
  reference resolution); trigger named in
  [upload.md § F10](../../design/data-management/datasets/upload.md); re-rank only on
  evidence. AI-propose-key likewise parked (#2 additive, needs the manual path shipped).

## Do

### D-gate — design draft (2026-07-04, awaiting human sign-off)

Design corpus drafted (the D deliverable, per the `d-gate-artifact-in-design-corpus` lesson):

- [upload.md § Refresh merge mode (R147)](../../design/data-management/datasets/upload.md#refresh-merge-mode-merge-on-key-and-precedence-r147)
  — **build home ARGUED, not assumed**: refresh-commit mode chosen over the workflow-step home
  (a step-home dedup is opt-in per consumer → the dataset stays double-rowed and every query
  that forgets the step is silently wrong — the exact F5 failure; F5 is source correctness,
  not presentation shaping, so the DuckDB-first steps doctrine doesn't claim it; a
  presentation-level "latest per key" step stays open to a future pull, orthogonal). No new
  wizard step: Confirm gains the `replace | merge` choice + key picker. Merge = keep-latest-
  per-key (incoming wins; committed-only rows KEPT — the difference from replace); one DuckDB
  statement, same staged/atomic-swap invariant. **F5×F2 key-dtype guard**: key-column drift
  (removed / dtype-changed) is the ONE loud stop in the otherwise warn-never-block drift gate
  — blocks *merge*, not refresh (switch to replace / fix / re-pick); backend 422s
  independently. Wire: item gains optional `merge_key: string[]` (absence = replace,
  unchanged); 201 adds `{updated, inserted, kept}` counts; `commitSettings` remembers
  `mergeKey` + `refreshMode` (F9 pattern).
- [datasets.md § Refresh affordance](../../design/data-management/datasets/datasets.md#refresh-affordance-r145)
  — stamped: **no new placement**; choice + key live in the wizard Confirm step; detail
  header unchanged in slice 1.
- Stale R146→R147 pointers in both docs corrected (design docs are current-state spec).

**❓ Domain decisions D1–D5 tabled for the human** (each with a recommendation, none decided):
D1 key shape/persistence (rec: ≥1 committed columns, remembered in `commitSettings.mergeKey`) ·
D2 incoming dup-key rows (rec: **loud typed 422** — file order is not time; the error teaches
the fix) · D3 precedence (rec: incoming-wins; precedence-column defers with trigger) ·
D4 mode selection (rec: per-refresh choice, last-used default) · D5 result schema under drift
(rec: incoming schema wins, consistent with replace). **Hard stop here for the human.**

## Check

- [ ] D signed off before C/B/F (incl. the identity-key, in-file-duplicate, and
      choice-vs-setting domain decisions).
- [ ] Real CRM pair merges: one row per declared key, incoming status wins, non-overlapping
      committed rows kept; counts surfaced.
- [ ] A merge that fails validation leaves the existing dataset fully intact.
- [ ] Key-dtype mismatch is a loud typed failure, never a silent false non-overlap.
- [ ] Backend pytest + ruff green; FE tsc + vitest green; design/plan/markdown lints clean.
- [ ] Human feel-review of the refresh-with-merge walk.

## Act

_(open)_

## Feeds into → Round_148 (TBD)

Per the signed-off R142 order: **F8** multi-range wizard (one sheet → N named ranges; backend
already supports) → UI-batch (F7/F3/F4/F12/F13 + carried R140 list). **Carried**: R145 slice
**1b** (drift blast-radius preview) + AI-propose-key (parked until the manual merge path is
lived). Re-rank allowed at open per evidence.

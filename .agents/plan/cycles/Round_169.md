# Round 169: the design corpus re-synced — nine docs and the ledger they accreted

**Status**: In Progress — drift **closed** (4 findings fixed) and slice A **compacted** (8 docs,
159 → 4). **`upload.md` is unfinished at 106 stamped lines** and is the only work left.
**Flow**: _(set at the Design exit via `flow-selector` — but see § This round ships only documents)_
**Date started**: 2026-08-14
**Date completed**:

<!-- ⟢ At a glance is authored at the Review→Complete flip (R159 doctrine), not during Do. -->

## Goal

**Inherits from ← [Round_167](Round_167.md)** — R167 ran `design-sync` over the **four** docs whose
code it changed (`queries.md`, `canvas.md`, `workflows.md`, `_noun-model.md`) and stated, rather
than implied, that the rest of the domain was untouched. That statement is this round's whole
inheritance: the backlog is **named and bounded**, not discovered.

**Seeded from ← the human's scope call, 2026-08-14.** Raised as an open call at R167's close and
answered: the remaining corpus is **its own work**, deliberately **not** folded into
[`Round_168`](Round_168.md) — the last round of
[`query-shaping-surface`](../programs/query-shaping-surface.plan.md), which has no successor to
absorb overflow.

**What this round is for**: every product round in this repo takes a design-corpus doc as its
D-gate artifact ([[d-gate-artifact-in-design-corpus]]). Nine of them currently answer a reader in
the voice of a **round ledger** rather than a **current-state spec** — which is the failure
[[design-docs-are-source-code]] names. The work is to make them answer as specs.

_Track: 2 (agent-method — the design corpus is where the D-gate artifact lives; keeping it
current-state is method upkeep and changes no product behavior). Pulled by: R167 § Not done, and
the human's scope call of 2026-08-14. Artifact-only, inside the
[R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md)._

## Plan

**Expected outcome**: the nine docs below read as current-state specs — code-true, ledger
stripped — and the `data-management` domain carries **no** `design-sync` backlog.

**Falsified if**: the `--check` pass finds the docs are largely **already code-true** and the
backlog is purely cosmetic ledger accretion. That would not be nothing, but it is a **different and
much smaller** round than this one is scoped as, and it should be re-scoped rather than executed at
this size.

### Two problems, measured separately — the scope call turns on which one this is

R167 reported the backlog as **"~286 round-stamps"**, which is a measure of **ledger accretion**.
That is not the same axis as **doc↔code drift**, and the `design-sync` skill separates them by
design: `--check` detects drift and stamps an `OUT-OF-SYNC` marker; the default sync mode
reconciles **and** compacts.

| Axis                          | What it means                                                 | Measured?                                     |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| **Doc↔code drift**            | The doc claims something the code does not do                 | **NO — unmeasured.** `--check` is step 1.     |
| **Ledger accretion**          | Round-stamps, test counts, "shipped RNN", as-built deltas     | **YES — 325 stamped lines across nine docs.** |

**R167 said these docs are "not made untrue by this round"** — which is a claim about R167's own
blast radius, **not** a drift measurement. Nobody has run `--check` on them. So the first step is
cheap and it is the one that decides the round's size.

### The nine docs — re-measured 2026-08-14, and the earlier figure was low

```bash
rg -c '\bR[0-9]{2,3}\b' <doc>   # lines carrying at least one round stamp
```

| Doc                                     | Stamped lines | File lines | Share |
| --------------------------------------- | ------------: | ---------: | ----: |
| `datasets/upload.md`                    |       **166** |      2 124 |  51 % |
| `datasets/dataset-filters.md`           |            42 |        839 |  13 % |
| `queries/query-construction.md`         |            39 |        723 |  12 % |
| `datasets/dataset-detail.md`            |            22 |        969 |   7 % |
| `datasets/advanced-query.md`            |            17 |        777 |   5 % |
| `datasets/datasets.md`                  |            15 |        568 |   5 % |
| `workspaces/relationships.md`           |            13 |        455 |   4 % |
| `_shared/crud-hygiene.md`               |             9 |        598 |   3 % |
| `workspaces/workspaces.md`              |             2 |        216 |   1 % |
| **Total**                               |       **325** |      7 269 | 100 % |

**Correction carried forward**: R167 recorded **"8 docs · ~286 stamps"**. The per-doc figure it
published is reproducible (`upload.md` = 166 lines), but the **total and the count are not** — the
domain holds **14** docs, R167 synced **4**, and `_TEMPLATE.md` is not a surface doc, which leaves
**nine**, at **325** stamped lines. `workspaces/workspaces.md` (2 lines) is the one most likely
dropped from the earlier hand-sum. R167 is `Complete` and append-only, so the correction is
appended there rather than edited in.

**`upload.md` is the round.** One doc is **51 %** of the stamped lines and **2 124** lines long —
larger than the other eight put together on the file-length axis too. Any plan that treats the nine
as interchangeable is wrong about this round's shape.

### Suggested shape (not settled — the D gate owns it)

- [ ] **Step 1 — `design-sync --check` over the whole domain**, per sub-folder
      (`datasets/`, `queries/`, `workspaces/`, `workflows/`, `_shared/`). Writes only the
      `OUT-OF-SYNC` marker, never a body: safe, idempotent, and it converts "unscoped" into a
      ranked drift list. **This step decides whether the rest of the round is one sitting or four.**
- [ ] **Step 2 — re-scope against what `--check` returned**, and say so in the Do log. If drift is
      near-zero, the honest round is a **compaction** pass and this file gets rewritten to that
      size (the _Falsified if_ above).
- [ ] **Step 3 — sync, smallest-first**, so the method is calibrated on `workspaces.md` /
      `crud-hygiene.md` before it meets `upload.md`.
- [ ] **Step 4 — `upload.md` as its own slice**, split out deliberately
      ([[split-fragile-subphase]]): 51 % of the backlog, the known site of a canonized defect
      (below), and the one doc where a bad sync pass does real damage.
- [ ] **Gates**: `md:lint` 0/311 · `check:links` at parity with the pre-round baseline ·
      `design:lint` 0/14 · `design:tokens` 0/11. **No product code changes**, which is the
      assertion to verify rather than assume — a `design-sync` that edits code has exceeded scope.

### Explicitly NOT in this round

- **Product code.** Nothing. If a sync finds the code wrong, it produces a **finding**, not a fix
  (see the canonize-a-defect risk below).
- **The `_platform` domain** — measured while scoping and left out on purpose:
  `workspace-shell.md` (27 stamped lines) and `workspace-shell.target.md` (56). **The `.target.md`
  must never be design-synced at all** — it is a deliberate TARGET-not-current doc, so "sync it to
  the code" would destroy the thing it exists to hold. Raised for the human, not assumed.
- **De-fragmenting / merging docs** — the skill's secondary axis (§ 5). Only where one concept has
  split across files, and only if `--check` shows it.
- **The standing product backlog** — R157 UX cluster, naming/legibility, Export ④,
  `[F-prov-reimport-choice]`, AI-propose-key #2, R145 1b, the latent pager risk. None of it is
  here.

### This round ships only documents

The [`query-shaping-surface` firewall](../programs/query-shaping-surface.plan.md) says **no round
ships only documents**, and names the R159→R161 four-week stall — three consecutive code-free
rounds on the same untouched seam — as the failure mode it was built to prevent. **This round is
outside that program and is deliberately doc-only**, which is exactly why it must not be folded
into a product round: a doc-only tail on a feature round is how it goes unmeasured.

So it inherits the risk rather than the exemption, and pays for it with a **timebox**: the F1
timebox of ≤2 working days from
[hybrid-flow-governance](../../decisions/2026-05-28-hybrid-flow-governance.md) is the ceiling for
the whole round. If step 1 says the work exceeds that, the round **splits by sub-folder** rather
than running long.

## Risks / unknowns

| Risk                                                                                                                              | Why it matters                                                                                                                                              | Handling                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A sync pass launders a shipped defect into spec** ([[design-sync-can-canonize-defects]]) — and the recorded instance was **`upload.md`**, this round's biggest doc. | R143 found `upload.md` self-contradictory: one section synced to a shipped bug, another preserving the intent. "Code is truth" gave the bug documentation cover. | The memory's rule is the round's rule: an **inter-section contradiction is a defect signal**. Stop, classify drift vs defect, and log the defect as a finding — never reconcile it silently. |
| **Stripping the ledger destroys rationale.** A round-stamp sometimes carries the only surviving *why*.                            | Compaction that deletes the reason a decision was made trades one kind of untruth for another.                                                              | Rationale worth keeping moves to a decision artifact or a memory entry, cited from the doc. Deleting a stamp is fine; deleting a **reason** is a finding.      |
| **`upload.md` at 2 124 lines may not survive one pass.**                                                                          | The largest doc, the most stamps, and the known defect site — the three risks coincide on one file.                                                          | Its own slice (step 4), after the method is calibrated on small docs.                                                                                          |
| **Doc-only round, no hand-use, no walk.**                                                                                         | The repo's acceptance mechanism is a human at a surface ([[dfcfbi-f1-needs-human-review]]). There is no surface here.                                        | Acceptance is: **a human reads one re-synced doc and says whether it now answers as a spec.** Written at D as a walk question, per the criterion R168 is deciding — one doc, read cold, is a perceivable gesture. |
| **Scope inflation into a corpus-wide program.**                                                                                   | [`design-corpus-audit`](../programs/design-corpus-audit.plan.md) was exactly this shape and ran seven rounds. Default = don't add.                           | One domain, nine docs, one timebox. `_platform` stays out unless the human pulls it in.                                                                        |

## Standing, not next

**This file is a scope artifact, not a claim on the next slot.** The human ranks the successor set
when `query-shaping-surface` closes at R168 — and this round is one candidate in it, alongside the
R157 UX cluster, naming/legibility, Export ④, `[F-prov-reimport-choice]`, AI-propose-key #2 and
R145 1b.

It carries the number **169** because that is where it sits today. If the human ranks another item
first, this file **renumbers** — the precedent is the program plan's own renumbering of
2026-08-10. The number is bookkeeping; the scope is the point.

## Do

### Ranked 2026-08-14 — the human's call: design-sync first

Ranked ahead of the batched UI cluster at the program's close, so this file keeps the number **169**
and § Standing, not next's renumbering clause never fired.

### Step 1 — `design-sync --check`, 2026-08-14. **The _Falsified if_ fired.**

§ Plan: _"Falsified if the `--check` pass finds the docs are largely **already code-true** and the
backlog is purely cosmetic ledger accretion. That would not be nothing, but it is a **different and
much smaller** round than this one is scoped as, and it should be re-scoped rather than executed at
this size."_

**That is what it found.** Four drifts across nine docs and 7 269 lines, concentrated in **two**
files. Seven of the nine are code-true on every class checked.

#### What was actually checked — stated as partial, because it is

Three **code-checkable claim classes** swept across all nine docs, plus a full claim-by-claim read
of the two smallest:

| Class | How it was checked |
| ----- | ------------------ |
| **Component homes** | Every `PageHeader` / `PageCard` / `PageContainer` / `PagedRowsView` claim in a Surfaces table, against `packages/ui/src/index.ts` and the feature folders |
| **Routes** | Every `METHOD /path` claim, against the full decorator inventory of all seven routers |
| **Error codes** | Every `code` claim, against the `ApiError*` classes each router actually emits |
| **Full read** | `workspaces.md` (216 lines) and `relationships.md` (455) claim-by-claim |

**Not done: a line-by-line diff of the seven larger docs.** `upload.md` alone is 2 124 lines. What
is below is high-signal, not exhaustive, and the re-scope should be read with that limit in mind.

#### The drift — 4 findings, 2 docs

| # | Doc | Finding | Class |
| - | --- | ------- | ----- |
| **1** | `workspaces/relationships.md` | The Surfaces table declares `PageHeader` / `PageCard` living in `apps/builder/src/features/data-management/_shared`, purity `plain-UI`. They are exported from **`@mdd/ui`** (`packages/ui/src/index.ts`) and the page imports them from there. | **surface that moved** — and it is the Surfaces table, which is the boundary declaration `design:lint` and the reuse invariant stand on |
| **2** | `datasets/upload.md` | `GET /datasets/{id}/refresh-preset`, twice, stated as current fact. **No such route exists anywhere in the repo.** The real one is `GET /datasets/{id}/refresh-settings` — which the same doc also uses, twice. | **stale route name**, plus an **inter-section contradiction** |
| **3** | `datasets/upload.md` | § Backend endpoint shape opens _"R15+ ships **three endpoints**"_ and is frozen there. The upload/refresh flow now also touches `PATCH /datasets/{id}/columns`, `GET /datasets/{id}/refresh-settings` and `POST /datasets/{id}/append-overlap`. | **behaviour frozen at an old round** |
| **4** | `datasets/upload.md` | Same section quotes `commit_datasets_batch(workspace_id: str, body: CommitBatch)` at path `/workspaces/{workspace_id}/datasets/batch`. The code is `def commit_datasets_batch(id: str, body: _BatchRequest)` at `/workspaces/{id}/datasets/batch`. | **stale identifiers** (the skill's quote-exact-identifiers rule) |

**Finding 2 is the one the § Risks table predicted.** `upload.md` contradicting itself across
sections is the R143 signal ([[design-sync-can-canonize-defects]]), and the round's rule is to
**classify rather than silently reconcile**. Classified: this is a **stale doc name**, not a shipped
defect — `refresh-preset` was never built under that name, and `refresh-settings` is the shipped
route with a passing contract. Nothing here documents a bug into spec.

#### Three candidate findings REJECTED — recorded so they are not re-found

Discipline matters as much as the hits; each of these looked like drift and is not:

- **`POST /datasets/{id}/rows:search`** (`dataset-filters.md`, `advanced-query.md`) — no such route,
  but both docs label it explicitly as a **parked fallback** with its trigger. Correctly documented
  as not built. **Not drift.**
- **`query_stale` / `relationship_stale` in `datasets.md`** — not emitted by the datasets router,
  but the doc uses them as **cross-domain references** ("the runtime machinery re-computes dependent
  validity on read"), not as claims about its own routes. **Not drift.**
- **`WorkspaceCard` / `CreateWorkspaceModal` in `workspaces.md`** — no such files, but both are
  module-local functions inside `WorkspacesPage.tsx`, and the Surfaces table declares the **folder**,
  which is accurate. **Not drift.**

#### The OUT-OF-SYNC marker was deliberately not stamped

The skill's `--check` stamps a marker and stops, because its normal path is **detect now, sync
later** — the marker warns a reader who might design on a stale doc in between. Here detect and sync
are the same sitting and the drift is four lines, so stamping both docs and clearing them minutes
later is churn that records nothing. Recorded as a deliberate deviation rather than an omission.

### Step 2 — the re-scope

**This is not a nine-doc reconciliation round.** It is **four factual corrections** in two docs, plus
whatever is decided about **325 lines of ledger accretion** — which the `--check` confirms is the
*only* axis with real volume, exactly as § Plan warned it might be.

The two axes, re-measured against evidence rather than assumed:

| Axis | Scoped as | Measured |
| ---- | --------- | -------- |
| **Doc↔code drift** | unmeasured, the round's premise | **4 findings, 2 docs** — small, and the fix is minutes |
| **Ledger accretion** | 325 stamped lines, 9 docs | **unchanged** — still the whole body of work, and `upload.md` is still 51 % of it |

### Step 3 — all four drifts FIXED, 2026-08-14

Done in the same sitting, because four factual corrections do not need their own gate:

- **`relationships.md`** — the Surfaces row now reads `packages/ui` (`@mdd/ui`), and the boundary
  check below it now distinguishes the two shared homes instead of lumping them: `DeleteConfirmModal`
  from `features/data-management/_shared`, `PageHeader`/`PageCard` from the package.
- **`upload.md` ×2** — `refresh-preset` → `refresh-settings` in both places. The doc no longer
  contradicts itself, and it no longer names a route that has never existed.
- **`upload.md` § Backend endpoint shape** — no longer frozen at _"R15+ ships three endpoints"_. It
  still quotes the wizard's three, and now names the three refresh/append routes that also serve this
  surface, pointing at the sections that specify them (`PATCH /datasets/{id}/columns`,
  `GET /datasets/{id}/refresh-settings`, `POST /datasets/{id}/append-overlap`).
- **`upload.md` identifiers** — `commit_datasets_batch(workspace_id, body: CommitBatch)` →
  `(id, body: _BatchRequest)`, path `{workspace_id}` → `{id}`, plus the `response_model_exclude_none`
  and `| JSONResponse` the real signature carries.

**Gates**: `md:lint` 0/313 · `design:lint` 0/14 · `design:tokens` 0/11 · `check:links` at parity (24,
all pre-existing). **No product code touched** — the assertion § Plan asked to verify rather than
assume, and it holds: this round has changed only markdown.

### The remaining question — the ledger, and it is now the whole round

Drift is closed. What is left is **325 stamped lines across nine docs**, which is the axis § Plan
predicted would turn out to be the real body of work. It is a **compaction** pass, not a
reconciliation, and it carries the risk § Risks names second: _stripping the ledger destroys
rationale_ — a round-stamp sometimes carries the only surviving **why**.

**Put to the human before executing**, because the round's size just changed materially and
compaction is judgement-heavy in a way drift-fixing is not.

### `markdown-check-link`, run on request 2026-08-14 — **16 of the 24 "broken" links are not broken**

Run over the config-scoped corpus (313 files, 885-file candidate pool). 24 broken, exit 1 — the
same 24 this repo has carried as its `check:links` baseline for many rounds. The script offered
**zero** auto-applicable suggestions (every record's `suggestions: []`), which is itself the tell:
these are not near-misses.

Triaged against what actually happened to each target:

| Group | Count | Verdict |
| ----- | ----: | ------- |
| **1 — the em-dash slug conflict** | **11** | **The links are correct; the checker is wrong.** |
| **2 — the `#L<n>` line-reference convention** | **5** | **Correct; the checker cannot resolve them by design.** |
| **3 — genuine rot** | **8** | Real. Targets deliberately deleted by R153 / R166 / R167. |

#### Group 1 — `check_links` disagrees with GitHub **and with this repo's own markdownlint**

[`parse.py:159`](../../skills/markdown-check-link/scripts/parse.py) collapses repeated hyphens:

```python
s = re.sub(r"-+", "-", s).strip("-")   # GitHub does NOT do this
```

A heading containing ` — ` (em-dash **with spaces**) strips to **two** spaces → **two** hyphens.
GitHub keeps them; this collapses them. So every anchor into such a heading reads as broken:

| | |
| --- | --- |
| Heading | `### R109 — line / time-series ✅` |
| GitHub / MD051 slug | `r109--line--time-series-` ← **what the links use** |
| `check_links` slug | `r109-line-time-series` |

**Independent confirmation, from inside this repo**: `MD051` (link-fragments-should-be-valid) is
**enabled** — `.markdownlint-cli2.jsonc` disables MD013/041/033/001/003/036/040/060/049/050 and not
MD051 — and `pnpm md:lint` reports **0 errors across 313 files**. `Round_88.md:232`'s same-file
`#acceptance-criteria-draft--sharpen-at-design` is therefore judged **valid by markdownlint** and
**broken by `check_links`**, in the same repo, on the same line.

This is [[markdown-anchor-slug-linter-conflict]] — but that memory's advice ("use `:` not ` — ` in
same-file-linked headings") is a **workaround that distorts headings to satisfy the weaker tool**.
The evidence now points the other way: **the checker's `slugify` is the defect.**

The 11: `Round_109`–`Round_118` (ten ledger anchors into
`2026-06-29-charts-probe-data-layer.md`, all verified resolvable under GitHub rules) and
`Round_88.md:232`.

#### Group 2 — `#L215`, `#L115-L116`, `#L135`, `#L321`, `#L52` (`Round_92` ×4, `Round_92` self ×1)

Line references, not headings — the convention `CLAUDE.md` itself mandates
(_"For specific lines: `[filename.ts:42](src/filename.ts#L42)`"_). They are correct as written and
the checker has no way to resolve them. The skill's own `as-is` resolution documents exactly this
case (_"Use when the checker is wrong (e.g. `path.md:25` line-suffix convention)"_).

#### Group 3 — the 8 that are genuinely rotted

| Links | Target | Why it is gone |
| ----: | ------ | -------------- |
| 3 | `queries.md#composed-source-qr_` (`Round_76` ×2, `Round_77` ×1) | Section deleted when **R167** retired composition |
| 2 | `queries.md#build-on-this-query-r77-the-create-entry` (`Round_77` ×2) | Entry point withdrawn by **R166** |
| 2 | `query-construction.md#create-mode-r77-…` (`Round_77` ×2) | Create mode deleted by **R166** |
| 1 | `datasets/ColumnsManager.tsx` (`Round_152:216`) | File deleted at **R153** (`74f07b3`), replaced by `PropertiesDrawer.tsx` |

All eight sit in **Complete, append-only rounds** and were accurate when written. The honest repair
is the skill's `unlink` (demote `[text](target)` → `` `target` ``), which keeps the historical
reference readable without asserting a link that cannot resolve — **not** repointing them at
today's docs, which would make those rounds claim they cited something they did not.

#### Why this matters beyond tidiness

A gate that reports **24 broken, two-thirds of them false**, trains its readers to ignore it —
and a real break would land in that noise unnoticed. That is the actual finding, and it is why
the baseline has sat at 24 for rounds without anyone acting on it.

**Not fixed in this round.** Group 3 means editing eight Complete rounds; Groups 1–2 are fixed
either by a **gitignored** `suggestions.fixed.json` (personal scratch pad — does not persist for
CI or a teammate) or by **changing `parse.py`'s `slugify`**, which is a Track-2 skill change and
needs its own pull. Held for the human with the evidence above.

**Ranked by the human 2026-08-14 as a candidate next round** — see § Feeds into.

### Steps 3–4 — the compaction

**Slice A — the eight smaller docs: 159 stamped lines → 4. DONE.**

The rule applied throughout: **keep the reason, drop the attribution.** What was deleted outright
was never rationale — it was build-chain narration (_"R38 — OpenAPI extension; R39 — BE handler;
R40 — FE"_), status blockquotes, and process notes about the doc's own authoring (_"R40's Act
section confirms which lifecycle event applies"_).

**The four survivors are deliberate**, and they are all heading anchors with inbound links:
`datasets.md` § Refresh affordance (R145) + § Column visibility (R152), `dataset-detail.md`
§ Column visibility (R152) + § Properties panel (R153).

#### The heading rule — learned twice, both times by the gate catching me

A heading stamp is not only ledger; it is an **anchor identity**. Removing one is a rename with
inbound consequences, and renaming design-doc headings is precisely what **manufactures the rot
this same round triaged as Group 3**.

| Attempt | What broke | Fix |
| ------- | ---------- | --- |
| `### Properties panel (R153)` → `### Properties panel` | `Round_153.md:113`; `check:links` 24 → 25 | **Restored the stamp** — a Complete round is append-only, so the anchor is load-bearing |
| `### FE types (target for R40)` → `### FE types` | `advanced-query.md:90`; 24 → 25 | **Kept the rename, repointed the link** — design-doc → design-doc, so both sides move in one commit |

**The rule, stated precisely**: remove a heading stamp only when **every inbound link can be
updated in the same commit**. True for in-corpus links; false for anything in append-only history.

#### Two drift findings the `--check` structurally could not see

Compaction reads every line; the `--check` swept three code-checkable **classes**. These two are
in the classes it did not sweep — _a deferred item that has since shipped_ and _a resolved open
question_ — which is the caveat § Step 1 flagged, doing real work:

| Doc | Drift | Correction |
| --- | ----- | ---------- |
| `_shared/crud-hygiene.md` | Declared _"Dataset `columns[].name`, `dtype`, **or other per-column metadata**"_ out of scope and future. Per-column `hidden` **shipped** as `PATCH /datasets/{id}/columns`. | Scope statement corrected; the presentation-only boundary named, so the exclusion still reads true for `name`/`dtype`. |
| `datasets/dataset-detail.md` | Listed Profiling as _"**deferred → R154** (compute round)"_. R154 **built it and the human reverted it in full** — the feature was not wanted. | Now reads **NOT BUILT — built once and reverted**, with "do not re-propose without a fresh pull". A reader would otherwise have read "deferred" as "coming". |

**This corrects the impression § Step 1 left.** "Seven of nine code-true" held for the three
classes swept, and the caveat attached to it was load-bearing rather than decorative.

**Slice B — `upload.md`: 165 → 106 stamped lines. NOT FINISHED.**

Split out deliberately ([[split-fragile-subphase]]) and worked in that order. What landed:

- **Two Q&A ledger sections deleted** — § Open questions answered in R14 and § Open questions
  answered in R19, **61 lines**. Verified safe before deleting rather than after: every decision
  in the R14 table is already carried in the spec body (tabs, `column1, column2…`, has-header,
  Include, atomic commit all present above), and R19's methodology blockquote points at
  `context/contract-driven-feature.md`, **which does not exist**.
- **Two sections kept because they are not ledger.** § R18 design reflection is a **live open
  question with a named trigger** (Metadata→Preview vs Preview→Metadata) — deleting it is exactly
  the § Risks failure of stripping rationale; it was renamed and de-attributed, not dropped.
  § R32 stamp is a ledger *heading* over live i18n spec — heading renamed, content untouched.
- **Status blockquotes and eleven unlinked heading stamps** stripped; the **six linked** anchors
  keep theirs.

**106 stamped lines remain in `upload.md`**, and they are the hard kind: prose de-attributions
needing a judgement each (_"R145 ships whole-table replace"_ → whose reason survives, whose
number does not). That is a second sitting, not a rounding error, and it is reported as unfinished
rather than rounded up.

## Check

_(empty — Planning)_

## Act

_(empty — Planning)_

## Feeds into → not pre-decided

A corpus that answers as a spec is worth having for the round **after** it — whatever the human
ranks next designs on these docs. That is the whole return.

**Noted as a candidate for R170 (human, 2026-08-14): Track 2 — fix `markdown-check-link`.**

_Track: 2 (agent-method — a repo gate that is two-thirds false). Pulled by: this round's
`markdown-check-link` run, which found **16 of 24** reported breaks are not breaks._ The concrete
defect is one line — [`parse.py:159`](../../skills/markdown-check-link/scripts/parse.py) collapses
`-+` → `-`, which GitHub and this repo's own **MD051** do not — and the evidence that it is the
checker rather than the links is that `md:lint` passes on the same fragments `check_links` fails.
Fixing it turns the baseline from **24 → 8**, and the eight that remain are real. That is the
argument for it: not tidiness, but making a standing gate mean something again, so a genuine break
stops hiding in noise. Scoped, **not** committed — the human ranks it.

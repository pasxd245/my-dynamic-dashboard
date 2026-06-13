# Round 48: DCBF corpus supersession analysis + archive

**Status**: Complete
**Date started**: 2026-05-28
**Date completed**: 2026-05-28

## Goal

**Inherits from ← [Round_47](Round_47.md)** — R47 codified the
DCFBI/DFCFBI hybrid flow at
[`decisions/2026-05-28-hybrid-flow-governance.md`](../../decisions/2026-05-28-hybrid-flow-governance.md)
and bound the FE-as-preview SoT consolidation: under the new flow,
**design markdown is spec, the FE running against MSW is the lived
UX truth, and no parallel HTML preview artifact carries SoT**.
R47's Feeds-into narrowed R48 (post-Review amendment 5) to
**supersession analysis + archive only** — no rewrites of
surviving artifacts, no first DCFBI/DFCFBI feature trial.

R48 walks the `.agents/`-tracked corpus that operationalized DCBF,
classifies each artifact against R47's doctrine into three buckets
(_fully superseded_ / _partially superseded_ / _not superseded_),
and **archives only the fully superseded ones** by `git mv` to
`_archive/` subdirs local to each parent. **Move only — no rename,
no content edit.** Partially-superseded survivors keep their
DCBF-era framing; their rewrite is deferred to later rounds that
benefit from concrete DCFBI experience.

The output is an uncontaminated live workspace where R49 (the
first DCFBI/DFCFBI feature trial) can run against R47's doctrine
without contradictory parallel UX artifacts in the live tree.

_Track: 2 (agent-method, corpus reconciliation). Pulled by: R47
governance decision + the S-curve break-point captured in
[memory/2026-05-28-dcbf-to-dcfbi-pivot.md](../../memory/2026-05-28-dcbf-to-dcfbi-pivot.md)
— DCBF-era preview-as-artifact corpus contradicts the FE-as-
preview SoT consolidation R47 binds. Per
[Evolution Rule](../../AGENTS.md)._

## Plan

- [x] **Enumerate the candidate corpus.** Walk
      [.agents/design/](../../design/) (recursively), plus the
      DCBF-anchored files in [.agents/context/](../../context/)
      and [.agents/memory/](../../memory/) named in R47's candidate
      scan. Full file list goes into Do as the analysis baseline.
- [x] **Classify each artifact.** Three buckets per R47's doctrine:
      _fully superseded_ (R47 explicitly displaces it; no role
      under DCFBI/DFCFBI), _partially superseded_ (DCBF framing
      displaced but content holds within DCFBI's unchanged phases),
      _not superseded_ (lessons hold cleanly). One sentence per
      artifact citing the R47 clause that displaces (or does not).
- [x] **Consumer-check the auxiliaries before classifying as
      fully superseded.** `tokens.css` may have live FE consumers
      (`grep -r tokens.css workspace/`); `preview-shell.js/css`
      may be cited by surviving spec markdown. Classification
      flips to _partially_ or _not superseded_ if a live consumer
      exists. Record the grep results in Do.
- [x] **Record the triage table in Do.** Inline markdown table:
      one row per artifact, columns _path / classification /
      justification (R47 clause cited)_. The triage record is the
      durable output of the analysis half; archive moves are its
      mechanical consequence.
- [x] **Archive the fully-superseded set.** For each _fully
      superseded_ artifact: create `_archive/` subdir local to its
      parent if not present, `git mv` the file in. No rename, no
      content edit. Preserve the directory structure inside
      `_archive/` if the source had subdirs.
- [x] **Log cross-link rot as follow-up.** Moved files will contain
      relative links to live siblings (and live siblings may cite
      now-archived paths). Record the broken-link inventory in Do
      as input for whichever later round handles content rewrites.
      **Do not edit content in either direction to repair.**
- [x] **Verify uncontaminated live tree.**
      `find .agents/design -name '*.preview.html' -not -path '*/_archive/*'`
      returns empty (or known-justified exceptions).
      `git diff --stat -M` shows the moves as renames, not
      add+delete (i.e. content unchanged).
- [x] **Pipeline.** `npx markdownlint-cli2` repo-wide → 0 errors.
      Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md). Grep this round
      file for unticked `- [ ]` before flipping Status to `Review`.

## What is IN scope

1. Classification of every DCBF-era artifact in the `.agents/`
   tree against R47's doctrine.
2. `git mv` of _fully superseded_ artifacts into `_archive/`
   subdirs local to their parent — pure path moves, content
   preserved byte-for-byte.
3. The triage table itself as a durable record in this round's Do.
4. Cross-link rot inventory (broken links left in place,
   recorded for later rounds).

## What is OUT of scope

- **No content edits.** Not in archived files, not in surviving
  files. Rewriting `design/README.md`, `*.md` spec files, or
  `../../context/_archive/contract-driven-feature.md`
  is deferred to later rounds that have concrete DCFBI experience
  to draw on. R48 is segregation only.
- **No rename during move.** Archive preserves filenames so git
  rename-detection works clean.
- **No first DCFBI/DFCFBI feature round.** R49 is that round;
  R48 is its precondition.
- **No Status edits on DCBF-era memory files.** Their classification
  is recorded; their content (including frontmatter `Status`) is
  not touched.
- **No sub-structuring into `Round_48.A.md` etc.** R46's
  speculative chain notation is dropped (per R47 amendment 4).
  If analysis surfaces enough volume that splitting genuinely
  helps, pause and ask for user direction rather than
  self-splitting — the sub-round notation has no PDCA precedent.
- **No new context or skill promotion.** R48 is mechanical
  segregation operating under R47's already-committed doctrine;
  there is no new pattern to promote.

## Risks / unknowns

- **`tokens.css` and other preview-shell auxiliaries may have
  live consumers.** `tokens.css` in particular sounds like a
  design-tokens file that _could_ be imported by the real FE in
  `workspace/apps/builder/`. Grep-check before archiving. If a
  live consumer exists, the classification is _partially
  superseded_ at most (and the file stays in place).
- **`workspace-shell.target.md` semantics.** The lone `.target.md`
  in `design/data-management/`. Likely an "ideal target state"
  spec authored under DCBF; needs a one-line look before
  classification. If it's still meaningful framing for the live
  workspace shell, leave in place.
- **Memory-file sweep beyond R47's enumerated four.** R47 listed
  four DCBF-era memories ([2026-05-24-contract-round-methodology](../../memory/2026-05-24-contract-round-methodology.md),
  [-be-round-conformance-pattern](../../memory/2026-05-24-be-round-conformance-pattern.md),
  [-fe-round-typecheck-pattern](../../memory/2026-05-24-fe-round-typecheck-pattern.md),
  [-design-first-reframe-absorption](../../memory/2026-05-24-design-first-reframe-absorption.md)).
  A full `grep -l 'DCBF\|design-first\|\.preview\.html' .agents/memory/`
  may surface more that weren't enumerated. Include the full
  sweep in the candidate enumeration step.
- **Cross-link rot from moved files.** Archived `.preview.html`
  files likely reference `_js/preview-shell.js` and
  `_css/preview-shell.css` (which also move). Archived files'
  internal links break by design — that is acceptable; the
  archived corpus is historical record, not live navigation.
  But live files citing now-archived paths break in a way users
  _will_ hit; log those for follow-up rewrites.
- **`git mv` discipline.** Sources are all tracked (committed),
  so the tracked-source-required rule from
  [memory/2026-05-28-mv-and-markdownlint-fix-quirks.md](../../memory/2026-05-28-mv-and-markdownlint-fix-quirks.md)
  is satisfied. Verify with `git ls-files` on the candidate set
  before bulk moves; any untracked match means investigate
  first.
- **Write-discipline gotcha.** Per
  `../../memory/feedback_write_tool_discipline.md`:
  the Read-before-Write guard can stale across same-iteration
  `git rm`. R48 does no Writes (pure moves) — but if a moved file
  needs a follow-up Write (e.g. an `_archive/README.md` index),
  split into two iterations.
- **Verification scope ambiguity.** "Uncontaminated workspace"
  is the goal but is not a binary test. The verification step
  uses `find … -name '*.preview.html'` as the concrete check; if
  R48's classification produces zero false-positives there,
  that's good-enough evidence. Deeper semantic verification is
  R49's problem (running a feature round and noticing if the
  baseline is muddled).

## Do

**Candidate enumeration.** Walked
[`.agents/design/`](../../design/) recursively (19 files),
[`.agents/context/`](../../context/) (5 files), and
[`.agents/memory/`](../../memory/) (15 files +
[`_TEMPLATE.md`](../../memory/_TEMPLATE.md)). Memory swept with
`grep -lE 'DCBF|design-first|\.preview\.html|preview-shell'`
surfacing 5 hits: the four R47-enumerated DCBF-era memories plus
[`2026-05-25-drifted-config-pattern-research.md`](../../memory/2026-05-25-drifted-config-pattern-research.md)
(R47 did not enumerate it; sweep caught it). One memory file
([`2026-05-24-contract-round-methodology.md`](../../memory/2026-05-24-contract-round-methodology.md))
did not match the grep but R47 enumerated it — added by name.

**Consumer-check** for `tokens.css`, `preview-shell.js`,
`preview-shell.css`:

- `grep -rn 'tokens\.css\|preview-shell\.(js\|css)' workspace/`
  → **zero hits.** No live FE consumer in any package under
  `workspace/`.
- Within `.agents/`, consumers are: the 6 `.preview.html` files
  (link them via `<link rel="stylesheet">`), `design/index.html`
  (preview-index landing page), `design/README.md` (documents
  the chrome wiring), and historical round docs (R14/R33/R37
  describing original wiring — append-only history, not
  consumers).
- Round*14 documents `tokens.css` as a \_mirror* of
  `themeTokens.ts` in the live FE — the live source is in
  `workspace/`, not under `.agents/design/`. Confirms the
  auxiliary CSS is preview-side only, not a build input.

Consequence: `tokens.css` + `preview-shell.{js,css}` are
**fully superseded** under R47 (no surviving consumer in the live
FE; their sole purpose is dressing the `.preview.html` artifacts).

**`workspace-shell.target.md` inspection.** Distinct pattern from
preview-as-artifact: a _target-vs-current_ shape doc declaring an
aspirational destination, paired with the canonical
[`workspace-shell.md`](../../design/_platform/workspace-shell.md).
Content is the shell-system structure (sidebar / topbar /
page-card) that _is_ implemented in the live FE. The
target-vs-current pattern itself is orthogonal to DCBF→DCFBI;
nothing in R47 displaces it. **Not superseded** (or at most
partially, on cosmetic Status framing).

**`index.html` inspection.** Landing page indexing the 6
`.preview.html` siblings. Its raison d'être is the preview corpus
itself ("Add a new preview: drop a sub-item in the sidebar + a
card on the right" — comment from R14). Once previews leave the
live tree, the index has nothing to index. **Fully superseded.**

### Triage table

| Path                                                                                                                        | Classification                                        | Justification (R47 clause cited)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `../../design/data-management/_archive/crud-hygiene.preview.html`       | **Fully superseded**                                  | R47 § "What this allows" — no separate HTML preview artifact carries SoT under DCFBI; FE-running-against-MSW is the canonical UX preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `../../design/data-management/_archive/dataset-detail.preview.html`   | **Fully superseded**                                  | Same R47 clause.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `../../design/data-management/_archive/dataset-filters.preview.html` | **Fully superseded**                                  | Same R47 clause.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `../../design/data-management/_archive/datasets.preview.html`               | **Fully superseded**                                  | Same R47 clause.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `../../design/data-management/_archive/upload.preview.html`                   | **Fully superseded**                                  | Same R47 clause.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `../../design/data-management/_archive/workspace-shell.preview.html` | **Fully superseded**                                  | Same R47 clause.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `../../design/_archive/index.html`                                                                     | **Fully superseded**                                  | Auxiliary to the preview corpus; sole purpose is indexing the 6 preview HTMLs. No purpose once they archive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `../../design/_archive/_css/tokens.css`                                                           | **Fully superseded**                                  | Preview-shell auxiliary. Consumer-check: zero live workspace consumers; R14 documents it as a _mirror_ of `themeTokens.ts` (live source lives in `workspace/`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `../../design/_archive/_css/preview-shell.css`                                             | **Fully superseded**                                  | Preview-shell auxiliary. Consumer-check: zero live workspace consumers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `../../design/_archive/_js/preview-shell.js`                                                 | **Fully superseded**                                  | Preview-shell auxiliary. Consumer-check: zero live workspace consumers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [`design/README.md`](../../design/README.md)                                                                                | **Partially superseded**                              | Preview-orchestration framing (chrome wiring, "add a preview" instructions) displaced; "design markdown is intent-before-code" content holds under DCFBI's spec role for design markdown. Leave; rewrite deferred.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [`design/data-management/crud-hygiene.md`](../../design/data-management/_shared/crud-hygiene.md)                                    | **Partially superseded**                              | DCBF-era "Draft (Round X design-only)" framing displaced; journeys + state notes + acceptance criteria content holds as the FE's implementation spec.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [`design/data-management/dataset-detail.md`](../../design/data-management/datasets/dataset-detail.md)                                | **Partially superseded**                              | Same rationale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [`design/data-management/dataset-filters.md`](../../design/data-management/datasets/dataset-filters.md)                              | **Partially superseded**                              | Same rationale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [`design/data-management/datasets.md`](../../design/data-management/datasets/datasets.md)                                            | **Partially superseded**                              | Same rationale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [`design/data-management/upload.md`](../../design/data-management/datasets/upload.md)                                                | **Partially superseded**                              | Same rationale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [`design/data-management/workspace-shell.md`](../../design/_platform/workspace-shell.md)                              | **Partially superseded**                              | Same rationale; canonical for the shell system (paired with `.target.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [`design/data-management/workspaces.md`](../../design/data-management/workspaces/workspaces.md)                                        | **Partially superseded**                              | Same rationale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [`design/data-management/workspace-shell.target.md`](../../design/_platform/workspace-shell.target.md)                | **Not superseded**                                    | Target-vs-current pattern is orthogonal to DCBF→DCFBI; content (shell-system shape) corresponds to live FE chrome. R47 does not displace target-docs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `../../context/_archive/contract-driven-feature.md`                          | **Fully superseded** _(post-Review reclassification)_ | Initial classification was _Partially superseded_ (chain-shape displaced, Contract-discipline holds). User override: the file's entire framing is the DCBF chain — title, structure, body, examples — not just chapter headings. Preserving it as historical record under `_archive/` is more honest than leaving a partially-displaced doctrine document in the live `context/` tree where it loads at session start. Contract-discipline lessons that survive R47's pivot live in the [MSW contract-anchor decision](../../decisions/2026-05-27-msw-contract-anchor.md) + the unchanged C phase of [R47's gates table](../../decisions/2026-05-28-hybrid-flow-governance.md); they don't need a context file to live on. |
| [`memory/2026-05-24-contract-round-methodology.md`](../../memory/2026-05-24-contract-round-methodology.md)                  | **Not superseded**                                    | Status: Promoted (to `context/contract-driven-feature.md`). Memory itself is historical; its Contract-phase methodology content holds under DCFBI's unchanged C phase. No Status edit (per R48 OUT).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [`memory/2026-05-24-be-round-conformance-pattern.md`](../../memory/2026-05-24-be-round-conformance-pattern.md)              | **Not superseded**                                    | BE-phase conformance pattern; DCFBI's B phase is unchanged from DCBF.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [`memory/2026-05-24-fe-round-typecheck-pattern.md`](../../memory/2026-05-24-fe-round-typecheck-pattern.md)                  | **Not superseded**                                    | FE typecheck pattern; applies under DCFBI's F (and F1/F2) just as it did under DCBF's F.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [`memory/2026-05-24-design-first-reframe-absorption.md`](../../memory/2026-05-24-design-first-reframe-absorption.md)        | **Not superseded**                                    | "Design before code" principle holds under DCFBI (design markdown is the spec); the DCBF-specific framing is dated but the lesson is intact.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [`memory/2026-05-25-drifted-config-pattern-research.md`](../../memory/2026-05-25-drifted-config-pattern-research.md)        | **Not superseded**                                    | Tangential DCBF mention only ("OpenAPI YAML stays the DCBF authority"); content is about config patterns + contract authority, both compatible with DCFBI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Archive set** (11 files): the 6 `data-management/*.preview.html`,
plus `design/index.html`, `design/_css/tokens.css`,
`design/_css/preview-shell.css`, `design/_js/preview-shell.js`,
plus the post-Review addition `context/contract-driven-feature.md`
(see amendment block below).

### Archive layout

Per R48 plan ("`_archive/` subdir local to each parent; preserve
directory structure if source had subdirs"):

- `.agents/design/data-management/_archive/` ← receives the 6
  `.preview.html` files (parent: `data-management/`).
- `.agents/design/_archive/` ← receives `index.html` (top-level
  parent: `design/`) and preserves the `_css/` + `_js/` subdir
  structure for the auxiliaries (their sub-parents become empty
  after the move and are removed).

### Archive execution

All 10 moves performed via `git mv`. Source `_css/` and `_js/`
directories removed after their sole tracked contents moved
(empty directories not tracked by git).

```text
git mv .agents/design/data-management/crud-hygiene.preview.html      .agents/design/data-management/_archive/
git mv .agents/design/data-management/dataset-detail.preview.html    .agents/design/data-management/_archive/
git mv .agents/design/data-management/dataset-filters.preview.html   .agents/design/data-management/_archive/
git mv .agents/design/data-management/datasets.preview.html          .agents/design/data-management/_archive/
git mv .agents/design/data-management/upload.preview.html            .agents/design/data-management/_archive/
git mv .agents/design/data-management/workspace-shell.preview.html   .agents/design/data-management/_archive/
git mv .agents/design/index.html                                     .agents/design/_archive/
git mv .agents/design/_css/tokens.css                                .agents/design/_archive/_css/
git mv .agents/design/_css/preview-shell.css                         .agents/design/_archive/_css/
git mv .agents/design/_js/preview-shell.js                           .agents/design/_archive/_js/
```

`git status` after the design-side moves: 10 renames staged, zero
content edits (verified via `git diff --stat -M --cached`).

### Post-Review amendment: archive `context/contract-driven-feature.md`

User override of the initial _Partially superseded_ classification:
the file is the DCBF doctrine document in its entirety (title +
4-phase chain framing + Why this works + examples), not a
partially-displaced piece with a salvageable core. Leaving a
DCBF-shaped doctrine file in the live
[`.agents/context/`](../../context/) tree (which loads every
session per AGENTS.md Load Order) contradicts R47's binding at
session-load time — exactly the contradictory-state risk the R48
precondition exists to remove.

The contract-discipline lessons that _do_ survive R47's pivot are
already carried by:

- [`decisions/2026-05-27-msw-contract-anchor.md`](../../decisions/2026-05-27-msw-contract-anchor.md)
  — execution-truth conformance chain.
- [R47's Hard Gates table](../../decisions/2026-05-28-hybrid-flow-governance.md)
  — Contract phase exit criteria are unchanged from DCBF.
- [`memory/2026-05-24-contract-round-methodology.md`](../../memory/2026-05-24-contract-round-methodology.md)
  (Status: Promoted) — the source memory the context file was
  promoted from; still in the live `memory/` tree as historical
  record.

So no contract-discipline content is lost by archiving the context
file.

Pre-existing cosmetic `_Track:` edit on this file (sitting staged
against HEAD since before R48; see Act follow-up) was **discarded
via `git restore`** before the move, so the archived file is the
exact byte-for-byte version that survived R17→R47.

```text
git restore .agents/context/contract-driven-feature.md
mkdir -p .agents/context/_archive
git mv .agents/context/contract-driven-feature.md .agents/context/_archive/contract-driven-feature.md
```

This is the **first post-Review amendment** to R48. Status remains
Review; amendment is a within-Review classification adjustment, not
a flip backward.

### Cross-link rot inventory

Recorded as follow-up input for later rewrite rounds. **Not
repaired in R48** — content edits to either side are out of scope.

**Archived → live links that broke** (relative paths inside
archived files now point to wrong locations; archived files are
historical record, so this is acceptable):

- All 6 `.preview.html` files contain `<link rel="stylesheet"
href="../_css/tokens.css">` and `<link rel="stylesheet"
href="../_css/preview-shell.css">` plus
  `<script src="../_js/preview-shell.js">` — these now resolve
  to non-existent paths from inside
  `data-management/_archive/`. **Acceptable** (archived
  artifacts are not navigation surfaces).
- `index.html` references `_css/tokens.css`,
  `_css/preview-shell.css`, and per-domain `*/<concept>.preview.html`
  sub-paths — broken from inside `_archive/`. **Acceptable.**

**Live → archived links that broke** (live surviving files cite
paths that no longer exist; these are surfaces R49+ readers will
hit):

- [`design/README.md`](../../design/README.md) extensively
  documents the preview-chrome wiring (`tokens.css`,
  `preview-shell.css`, `preview-shell.js`, the `index.html`
  landing page). Multiple paragraphs and an ASCII tree in the
  README cite the now-moved paths. **Follow-up rewrite** must
  reframe these passages (or remove them) when the README is
  next edited under DCFBI.
- [`design/data-management/workspace-shell.target.md`](../../design/_platform/workspace-shell.target.md)
  may cite preview paths — leave for the rewriting round to
  verify.
- Round files (`Round_14.md`, `Round_33.md`, `Round_37.md`, and
  others) cite the moved paths. These are **Complete /
  append-only**; their stale links are historical record, not
  drift. **No edit.**

**Live → archived links from `context/contract-driven-feature.md`
archive** (post-Review amendment):

- [`decisions/2026-05-28-hybrid-flow-governance.md`](../../decisions/2026-05-28-hybrid-flow-governance.md)
  (R47 decision body — cites the path in `## Why` and the
  Pulled-by footer). **Decision artifacts are durable but
  editable** under their own `revisit-trigger` — R47's frontmatter
  does not name "context-file archive" as a trigger, so the
  citation stays as historical reference for now. **Follow-up**:
  when R47 next revises (whenever its `revisit-trigger` fires),
  update the path to `context/_archive/contract-driven-feature.md`
  or replace the citation with the [MSW contract-anchor
  decision](../../decisions/2026-05-27-msw-contract-anchor.md) +
  [contract-round-methodology memory](../../memory/2026-05-24-contract-round-methodology.md)
  pair.
- [`design/data-management/upload.md`](../../design/data-management/datasets/upload.md)
  cites the path. **Follow-up rewrite** when the spec is next
  edited.
- Three DCBF-era memory files
  ([be-round-conformance-pattern](../../memory/2026-05-24-be-round-conformance-pattern.md),
  [contract-round-methodology](../../memory/2026-05-24-contract-round-methodology.md),
  [fe-round-typecheck-pattern](../../memory/2026-05-24-fe-round-typecheck-pattern.md))
  cite the path. The contract-round-methodology memory cites it
  as **Promoted to** — the promotion-target now lives under
  `_archive/`. Update the `Promoted to` line at next memory-file
  touch.
- [`memory/2026-05-28-dcbf-to-dcfbi-pivot.md`](../../memory/2026-05-28-dcbf-to-dcfbi-pivot.md)
  cites the path in both "Finding" and "Supersession triage
  candidates." Updated this round (paired with R48's
  reclassification of the file in the pivot memory).
- [`plan/brainstorms/2026-05-28-hybrid-flow/TOOLING-QUICK-START.md`](../brainstorms/2026-05-28-hybrid-flow/TOOLING-QUICK-START.md)
  cites the path. Brainstorm docs are **historical record after
  R46** (R47 amendment: "R46 moved the docs as-is; R47 treats
  them as historical record"). **No edit.**
- [`plan/promotions.md`](../promotions.md) — promotion log
  entries for R17→R21 cite the path. **Append-only log**; stale
  citations are part of the historical record. **No edit.**
- DCBF-era rounds (Round_17 through Round_24) and recent rounds
  (Round_46, Round_47) cite the path. **Complete / append-only**;
  **no edit**.

### Verification

- `find .agents/design -name '*.preview.html' -not -path '*/_archive/*'`
  → **empty** (verified post-archive).
- `git diff --stat -M --cached` shows all 11 moves (post-amendment)
  as **renames with 100% similarity** (pure path moves; zero
  content delta).
- `find .agents/design -type f -not -path '*/_archive/*'`
  enumerates only the surviving live tree: `README.md`, 8
  `.md` spec files (incl. `.target.md`), no HTML/JS/CSS.
- `find .agents/context -type f -not -path '*/_archive/*'`
  enumerates the surviving live `context/` tree:
  `drifted-iteration.md`, `governance.md`, `memory-placement.md`,
  `purpose.md` — no DCBF doctrine document remains in the live
  load path (post-amendment).

### Pipeline

- `npx markdownlint-cli2` repo-wide → **0 errors** over 119
  files (archived `.preview.html` and `.css`/`.js` are not
  markdown; the new Round_48 file is clean).
- Post-round audit per
  [PDCA.md § Post-round audit](../PDCA.md) executed; all Plan +
  Check boxes flipped before Status flip.

## Check

- [x] Candidate corpus enumerated in Do (full file list under
      `.agents/design/`, plus DCBF-anchored entries in `context/`
      and `memory/` per R47 + full memory grep sweep).
- [x] Triage table present in Do: one row per artifact, columns
      _path / classification / justification (R47 clause)_.
- [x] Consumer-check results for `tokens.css`,
      `preview-shell.js`, `preview-shell.css` recorded in Do.
- [x] Every _fully superseded_ artifact `git mv`'d to an
      `_archive/` subdir local to its parent. No renames.
- [x] `git diff --stat -M` confirms moves are detected as renames
      (no content delta on any moved file).
- [x] `find .agents/design -name '*.preview.html' -not -path '*/_archive/*'`
      returns empty.
- [x] Cross-link rot inventory recorded in Do as follow-up input
      for later rewrite rounds. No content edits to archived or
      surviving files to repair links.
- [x] No content edits to surviving (partially / not superseded)
      artifacts.
- [x] `npx markdownlint-cli2` repo-wide → 0 errors.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md) complete; all
      Plan + Check boxes flipped.

## Act

**Learnings**:

- **`git mv` rename detection is the cleanest verification for a
  pure-move round.** `git diff --stat -M --cached` showed all 10
  moves as 100%-similarity renames with `|   0` byte deltas —
  unambiguous evidence that R48's "move only, no content edit"
  discipline held. For any future archive-segregation round, this
  is the one-line check to keep on the audit list.
- **R48's archive scope generalized to the preview-shell family,
  not just `.preview.html`.** R47's candidate scan named only the
  6 `.preview.html` files; R47's amended scan (post-deep-review)
  added `index.html` + `_css/*` + `_js/*` + `.target.md` as
  candidates to triage. R48 confirmed: `index.html` + 3 auxiliaries
  archive cleanly (no live workspace consumers); `.target.md`
  stays (orthogonal pattern). The amended scan was the right
  intervention — without it, R48 would have shipped 6 archived
  previews surrounded by orphaned chrome.
- **Consumer-check before classifying auxiliary files as
  superseded.** `grep -rn 'tokens\.css\|preview-shell\.(js\|css)' workspace/`
  returned **zero hits** — but the check was the deciding evidence,
  not the assumption. The R14 documentation calling `tokens.css` a
  _mirror_ of `themeTokens.ts` corroborated: live source lives in
  `workspace/`, the design-side file is preview-only. If the live
  FE had imported `tokens.css` (plausible alternative shape), R48
  would have downgraded it to _partially superseded_ and left in
  place. Pattern to repeat: never archive an auxiliary on file-
  name inference alone.
- **Grep-sweep beats enumerated lists for completeness.** R47
  listed four DCBF-era memory files by name; my memory sweep
  with `grep -lE 'DCBF|design-first|\.preview\.html|preview-shell'`
  surfaced a fifth
  ([`2026-05-25-drifted-config-pattern-research.md`](../../memory/2026-05-25-drifted-config-pattern-research.md))
  R47 didn't enumerate. Classification was _not superseded_, so
  the omission was harmless this round — but the principle holds:
  enumerated lists in upstream rounds are a starting set, never
  authoritative for the downstream sweep.
- **Pre-existing index modifications can ride along through
  selective `git add`.** Two
  [`.agents/context/`](../../context/) files
  (`../../context/_archive/contract-driven-feature.md`,
  [`drifted-iteration.md`](../../context/drifted-iteration.md))
  had small cosmetic `_Track:` normalizations sitting **staged
  against HEAD** since before this session began (likely a
  pre-commit hook auto-format that never got committed). They
  survived through R46 + R47 commits because both used selective
  `git add` paths; they showed up again in R48's `git status`
  after the `git mv` operations. Caught by status-inspection,
  unstaged via `git restore --staged` so R48's commit stays
  scoped to R48's work. Worth surfacing as follow-up: those
  pending cosmetic edits should either be committed as a separate
  chore commit or reverted explicitly.
- **`_archive/` placement convention works at two levels.** R48's
  layout used `data-management/_archive/` (for the preview HTMLs,
  local to their parent) **and** `design/_archive/` (for top-
  level auxiliaries: `index.html`, `_css/`, `_js/`, preserving
  the source subdir structure). Both forms are "local to parent"
  per R48's plan rule; the rule scales cleanly when parents nest.
  No new convention needed — the rule as written handled both
  cases.

**Promotions**: none this round. R48 is mechanical segregation
operating under R47's already-committed doctrine; there is no new
pattern to promote.

**Follow-ups (not promotions, just notes):**

- **Cross-link rot in surviving live files** —
  [`design/README.md`](../../design/README.md) extensively
  documents the preview-chrome wiring and cites the now-archived
  paths in multiple paragraphs + an ASCII tree. R49+ rewrite
  round must reframe (or remove) these passages when README is
  next edited. Recorded in Do § Cross-link rot inventory.
- **Pre-existing index staging of context files** —
  `../../context/_archive/contract-driven-feature.md`
  and [`context/drifted-iteration.md`](../../context/drifted-iteration.md)
  carry cosmetic `_Track:` normalizations that have been staged
  against HEAD since before this session. Unstaged this round
  (out of R48 scope); user can decide to commit as chore or
  revert.
- **Markdownlint plus-prefix gotcha — 4th instance this week.**
  Bit R48.md during initial drafting (`+ AGENTS.md horizons`
  read as bullet at column 1). The
  [memory note](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md)
  now has 4+ documented hits; R47's Act flagged it for Status
  review — R49 or any Track-2 cleanup round could absorb the
  promotion to `context/`.
- **R48's two-tier `_archive/` placement worked cleanly** — could
  generalize into a tiny memory note ("archive subdir local to
  parent; preserve source subdir structure within `_archive/`")
  if R49+ archive rounds replicate the pattern. Single instance
  here; not yet worth lifting.

## Feeds into → Round_49 (TBD) — first DCFBI/DFCFBI feature trial

R49 is the **first feature round operating under R47's doctrine**.
R48's archive segregation is its precondition: an uncontaminated
live tree means R49's round author runs the 2-of-5 flow selector
against design markdown spec alone, with the FE running against
MSW as the canonical UX preview — no parallel HTML preview
artifact to drift against, because R48 moved them all to
`_archive/`.

R49 picks a feature (TBD at planning time) and runs DCFBI by
default, escalating to DFCFBI only if the 2-of-5 selector fires.
R49 is the **first empirical evidence** against R47's hypothesis:
the F1 timebox (≤2 working days), the selector calibration, and
the Hard Gates' exit criteria all get their first real test.
R49's Act captures whatever the round author learns — feeding
`revisit-trigger` evidence back into R47's decision frontmatter
if any of the doctrine needs amending.

Surviving DCBF-era artifacts (`design/README.md`, spec `.md`
files, `context/contract-driven-feature.md`, the four DCBF-era
memory files) **remain editable history** with their original
framing intact. R49 reads doctrine from
[`decisions/2026-05-28-hybrid-flow-governance.md`](../../decisions/2026-05-28-hybrid-flow-governance.md)
and AGENTS.md horizons, not from those survivors — so DCBF-era
framing in survivors is harmless background, not active
contradiction. Their rewrite is a later round's call, scoped by
whatever R49+ surfaces as needing reframing.

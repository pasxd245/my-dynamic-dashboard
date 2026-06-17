# Round 84: consolidate `queries/` → a single `queries.md` (sibling-consistent) + `--resolution` for markdown-check-link

**Status**: Review — Plan ratified + Fix complete (2026-06-18); gates green, awaiting human sign-off.
**Date started**: 2026-06-18
**Date completed**:
**Flow**: **Track-2 agent-method** — a design-doc structure cleanup (the naming half R83 left
open) plus the tooling it pulls. `flow-selector` (DCFBI vs DFCFBI) is **N/A** (no product
contract/BE/FE code). Gates: **Plan → Fix → Check**.

## Goal

**Inherits from ← [Round_83](Round_83.md)** — R83 folded `queries/` to the spine + redirect
stubs; this round finishes the naming/structure half R83 left open.

R83 folded `queries/` 7 → 3 living docs + 1 deferred, but the spine kept the filename
`saved-query.md` and `query-builder.md` stayed as a separate anchor — so `queries/` had **no
`queries.md`**, unlike its siblings ([datasets.md](../../design/data-management/datasets/datasets.md),
[workspaces.md](../../design/data-management/workspaces/workspaces.md), where the domain noun doc
**is** the overview + model). Human review of R83 pulled the consolidation:

1. **Merge** [query-builder.md](../../design/data-management/queries/queries.md) (the domain
   anchor: reuse invariant + trajectory) **+** [saved-query.md](../../design/data-management/queries/queries.md)
   (the model · routes · engine spine) **→ a single `queries.md`**. End state mirrors `datasets/`:
   `queries.md` + [query-construction.md](../../design/data-management/queries/query-construction.md)
   (builder UX) + [canvas.md](../../design/data-management/queries/canvas.md) (deferred) — **no
   redirect stubs**.
2. **Repoint, don't stub** — delete the R83 mode-stubs (`joins.md`, `multi-join.md`,
   `composition.md`) too; repoint **every** inbound link (locked rounds R69–R81 + live docs) to
   `queries.md#<anchor>` via the [`markdown-check-link`](../../skills/markdown-check-link/SKILL.md)
   skill. The design [README](../../design/README.md) sanctions repointing historical round-file
   links for moves (vs. leaving stubs).

The skill's `git-rename` auto-suggester repoints the 1:1 rename (`saved-query.md → queries.md`), but
**cannot infer a 2→1 merge's anchor remap** (`query-builder.md#trajectory → queries.md#…`) nor the
stub deletions' anchors. So R84 adds a **`--resolution <file>`** option: an explicit
`old-target → new-target` map applied repo-wide, reusing the existing `link:` fix machinery.

_Track: 2 (agent-method). The `--resolution` tooling is a Track-2 capability **pulled by** this
round's merge (the auto-suggester can't remap merge anchors); within the [R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md)
(skill-artifact enhancement, not Track-3 self-evo system-building). Per the [Evolution Rule](../../AGENTS.md)._

## Plan (by gate)

1. **Plan gate** — ratify the merge + repoint-not-stub + the `--resolution` addition. _(This step.)_
2. **Fix gate** —
   + **(a) tooling** — add `--resolution <file>` to `check_links.py` (load a JSON `old → new` target
     map; for each broken record whose target matches by repo-rel-path-or-basename `#frag`, set a
     `link:<computed-relative-target>` resolution); document it in the skill's `SKILL.md`.
   + **(b) merge** — `git mv saved-query.md queries.md`; fold `query-builder.md`'s anchor content
     (reuse invariant + trajectory) into `queries.md`; `git rm query-builder.md` + the three R83
     stubs `joins.md` / `multi-join.md` / `composition.md`.
   + **(c) repoint** — author the resolution map (merge/stub anchors → `queries.md#…`); run
     `markdown-check-link --dry-run` to preview (incl. the locked-round edits), then `--fix`.
   + **(d) baseline** — drop the 3 stub entries from `design-doc-lint.baseline.json` (the stubs are
     gone); clear any residual references.
3. **Check** — gates green (`design:lint` 0, `design:tokens` 0, `markdownlint` 0, `plan:lint` 0,
   `markdown-check-link` 0 in-scope broken); `queries/` = `queries.md` + `query-construction.md` +
   `canvas.md`, no stubs; flip to Review → human sign-off.

## Acceptance criteria

+ [ ] `queries/` holds **`queries.md`** (noun + overview + model · routes · engine, joins/composition
      folded) + `query-construction.md` + `canvas.md` — **no `saved-query.md`, no `query-builder.md`,
      no stubs** — mirroring `datasets/`.
+ [ ] **`--resolution <file>`** added to `markdown-check-link` (+ documented in `SKILL.md`); used to
      repoint the merge/stub anchors the auto-suggester can't infer.
+ [ ] **All inbound links repointed** to `queries.md#<anchor>` (locked rounds R69–R81 + live docs);
      `markdown-check-link` reports only the pre-existing out-of-scope breakages.
+ [ ] Gates green; `design-doc-lint.baseline.json` no longer lists the 3 stubs.
+ [ ] **Complete = human-signed-off.**

## What is OUT of scope

+ **Any product code** — design-doc structure + a link-checker flag only.
+ **The canvas BUILD** — still deferred ([canvas.md](../../design/data-management/queries/canvas.md)).
+ **Re-syncing other domains** — `datasets`/`workspaces` already synced (R82); untouched here.
+ **Pre-existing broken links** (`decisions/README.md` AGENTS anchor; `.hbs` in Round_30/32/45) —
  untouched, as in R83.

## Risks / unknowns

+ **Editing locked/Complete round files** (repointing their links) — mitigated by `--dry-run` preview
  before `--fix`, and by the README's promotion convention that historical links are repaired, not
  stubbed. Only the link **target** changes; prose is untouched.
+ **Anchor remap correctness** — every merged/moved anchor must map to a real heading in `queries.md`.
  _Mitigation: `markdown-check-link` verifies every repointed fragment resolves; 0 in-scope broken is
  the gate._
+ **`--resolution` ergonomics** — keep it a thin layer over the existing `link:` machinery (no new
  fix path), so it can't regress the auto-suggester.

## Do

### Plan-gate ratification (2026-06-18)

Ratified on the human's answers to the R83-review questions: **Merge both → `queries.md`**; handle
history by **repointing via the skill** (the playful "`--resolution` option" hint = build the CLI
flag the merge needs). Fold map → 3 living docs (`queries.md` + `query-construction.md` + `canvas.md`)

+ 0 stubs.

## Check (2026-06-18)

Fix gate complete; gates green. Status → **Review** (awaiting human sign-off).

+ [x] `queries/` = **`queries.md`** (noun + overview + reuse invariant + trajectory + model · routes
      · engine, joins/composition folded) + `query-construction.md` + `canvas.md` — **no
      `saved-query.md`, no `query-builder.md`, no stubs** — mirroring `datasets/`. The two locked
      anchors (`the-reuse-invariant-the-one-rule-this-domain-holds`,
      `the-trajectory-what-queries-grows-into`) preserved as headings in `queries.md`.
+ [x] **`--resolution <FILE>`** added to `markdown-check-link` (`check_links.py` + `SKILL.md`): a
      JSON `old-target → new-target` map (matched by resolved-path / basename, `#frag` optional),
      reusing the existing `link:` fix path; **file-only remaps preserve the link's fragment**. Used
      to repoint the merge/fold anchors the `git-rename` heuristic can't infer.
+ [x] **157 inbound links repointed** to `queries.md#<anchor>` (locked rounds R69–R81 + live docs)
      via `--fix --resolution`; historical link **text** preserved in round files, link text
      refreshed in the live docs. `markdown-check-link` reports only the pre-existing out-of-scope
      `decisions/README.md` AGENTS anchor (+ the Round_30/32/45 `.hbs`).
+ [x] `design-doc-lint.baseline.json` **emptied** (the 3 R83 stubs are gone).
+ [x] Gates green: `design:lint` 0, `design:tokens` 0, `markdownlint` 0, `plan:lint` 0,
      `markdown-check-link` 0 in-scope broken.
+ [ ] **Complete = human-signed-off** (the consolidated `queries.md` + the `--resolution` tooling).

## Act

_Pending — filled at round close (after human sign-off)._

## Feeds into → R83 sign-off + the canvas-build / consumer-save / dashboard themes

`queries/` now mirrors its siblings: one `queries.md` noun doc + the builder + the deferred canvas,
**no stubs**. R83's fold and R84's consolidation land together for one human sign-off. The
`--resolution` flag is now a reusable tool for any future design-doc **merge/fold** (the next is the
eventual canvas un-defer, and the downstream consumer-save / dashboard themes that will read the
single-spine Query model).

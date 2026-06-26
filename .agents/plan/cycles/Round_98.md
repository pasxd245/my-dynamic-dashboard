# Round 98: Rename `ui-design` → `ux-design` (truthful skill name; reserve `ui-design` for layout)

**Status**: **Complete** — human-signed-off 2026-06-26 ("Flip R98 Complete + commit"). The
`ui-design` skill renamed → `ux-design` (truthful: it reviews UX affordances, not the UI layout
skeleton); `ui-design` reserved for a future layout skill. Append-only honored — only the 6 broken link
*hrefs* in R52/R54/R81 repointed (text/narrative untouched). `ux-design` validates + discoverable;
zero rename-related broken links; gates green. DCFBI (process round).
**Date started**: 2026-06-26
**Date completed**: 2026-06-26
**Flow**: **DCFBI** (process/tooling round — a skill rename, **no UI, no product code** → `flow-selector`
is skipped per its no-feature branch; no F1/F2). Verified by `check:links` + skill auto-discovery + a
human invocation check at Integration.

## Goal

The skill registered as **`ui-design`** is misnamed: its checklist is the **six UX-honeycomb facets**
(Findability / Usability / Accessibility / Credibility / Utility / Desirability), grounded in AntD Data
Entry — it reviews **UX affordances**, not the **UI layout skeleton**. Rename it to **`ux-design`**
(truthful), and **reserve `ui-design`** for the future **layout-skeleton** skill (Flutter-principle).
**R98 is the rename + name-reservation only** — the layout skill's *content* stays deferred (its
primitive vocabulary didn't stabilize in R97; FillPane was pruned).

_Track: 2 (agent-method — decision-hygiene / truthful naming). Pulled by ← the R97 discussion, where we
repeatedly conflated UX-review (`ui-design`) with UI/layout; a misnamed governance artifact is exactly
the drift the repo guards against. **Artifact-only, within the [R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md)** —
a rename of an existing Track-2 skill, not Track-3 system-building. Per the [Evolution Rule](../../AGENTS.md)._

## Scope posture — the append-only-history split is the crux

~50 files reference `ui-design`, but **most are Complete round files (R51–R97) + memories** —
**append-only history** ([PDCA governance](../PDCA.md)) that ran the skill *when it was named
`ui-design`*. **Those stay** (rewriting them would falsify history; they're true as-of-then). The
rename touches only **forward-looking / current** references:

**RENAME (forward-looking, current):**

+ `.agents/skills/ui-design/` → `.agents/skills/ux-design/` (dir + `SKILL.md` `name`/`description`).
+ `.claude/skills/ui-design/` → `.claude/skills/ux-design/` (the **registered pointer** — keep its
  `rootPath`/`skillPath` valid so auto-discovery still works; check `.a2scaffold/` if it generates `.claude`).
+ `.agents/skills/README.md` — the index entry + cross-refs.
+ `.agents/AGENTS.md` — the Operative-horizons "Skills index" line.
+ `.agents/context/tools.md` — the capability index.
+ `.agents/plan/brainstorms/2026-06-25-layout-as-architecture.md` — the rename plan + reserve-`ui-design` intent.
+ Any **current-guidance** design-doc ref (e.g. `advanced-query.md` — verify it points to the skill as a
  live gate tool, not a historical note) → update; if historical, leave.

**LEAVE (historical / append-only):** Complete round files **R51–R97**, memories recording past usage.
Add a **redirect breadcrumb** (a one-line note in the README, e.g. *"`ui-design` was renamed to
`ux-design` in R98"*) so an old reference is still findable — without rewriting locked history.

**OUT (deferred):** the **`ui-design` (layout) skill content** — name reserved, body lands when the
layout-primitive vocabulary stabilizes (see the brainstorm). No new skill is built in R98.

## Plan (by gate — DCFBI; process round)

1. **Design gate** — confirm the rename scope + the **current-vs-historical split** (which refs
   rename, which stay) + the redirect-breadcrumb approach + the pointer/scaffold mechanism. **Human ratify.**
2. **Contract / Backend** — none (no product code).
3. **Frontend / Build gate** — execute the rename atomically: `git mv` the two skill dirs, update
   `SKILL.md` name/description, update the README index + cross-refs, AGENTS.md, tools.md, the
   brainstorm, current design-doc refs; **update every forward `[ui-design](…)` link** to the new path;
   add the README redirect breadcrumb.
4. **Integration gate** — `check:links` clean (no broken links from the dir rename), markdownlint clean,
   `design:lint`; the skill **auto-discovers + is invocable as `ux-design`**; a human confirms the
   `/ux-design` invocation works. Human Complete.

## Acceptance criteria

+ [x] The skill is `ux-design` everywhere **current** (dirs, `SKILL.md` name + output header, the
      regenerated `.claude` pointer, README index, AGENTS.md, tools.md, PDCA.md); validates
      (`a2scaffold skill validate ux-design` ✔) + auto-discovered (listed with full description).
+ [x] **Complete rounds + memories' narrative untouched** — historical `ui-design` *text* preserved;
      **only the broken link *hrefs* in R52/R54/R81 repointed** (href-only, text unchanged — human's call
      2026-06-26) so they resolve to the moved file. R51–R97 narratives intact (append-only honored).
+ [x] `ui-design` **reserved** (README breadcrumb + `SKILL.md` renamed-from note) for the deferred
      layout skill; **no layout-skill body built**.
+ [x] Gates green — **`check:links`: zero rename-related broken links** (6 pre-existing `#L`-anchor ones
      in R88/R92 remain, out of scope) · markdownlint 0 · round-lint 0 · design:lint/tokens 0.

## Risks / unknowns

+ **Append-only history** — do **not** rewrite Complete rounds/memories; the redirect breadcrumb is how
  old refs stay findable. (The biggest discipline risk — a naive find-replace would violate it.)
+ **`check:links`** — renaming the skill dir breaks every forward `[ui-design](…)` link; all must update
  in the same change or the gate fails.
+ **The `.claude` pointer / `.a2scaffold`** — the registered pointer must keep auto-discovery working
  under the new name; confirm whether `.claude/skills` is generated (regenerate) or hand-edited.
+ **Invocation sites** — anything that calls the skill by name (the flow at the Design/F gates, the
  Skill tool) now uses `ux-design`; confirm nothing hard-codes `ui-design` as a live trigger.

## Do

### Plan-gate draft — opened from the R97 fork (2026-06-26)

After R97, the human picked the `ux-design` rename (the teed-up Track-2 correction) over the value-out /
preview-space / two-pane candidates. Opened here; scope drafted above (the append-only split is the
crux). Next: ratify the scope at the Design gate, then execute the atomic rename.

### Design gate — RATIFIED + Build done (2026-06-26)

Human ratified the plan ("plan is good, please proceed"). Executed: `git mv` the source skill dir
(`.agents/skills/ui-design` → `ux-design`) + `SKILL.md` `name`/output-header/`renamed-from`; regenerated
the `.claude` pointer via `a2scaffold skill ref` (then set its full description — a2scaffold v0.1.0
writes a placeholder, but siblings carry the full text); updated the **current** refs — README index +
breadcrumb + cross-ref, AGENTS.md horizons, tools.md, PDCA.md.

**Append-only link finding (corrected mid-build):** I first grepped wrong and reported "no path-links";
`check:links` found **6 in Complete rounds R52/R54/R81** + 1 in PDCA. The human chose **repoint hrefs**
(href-only; link text + narrative unchanged) over leaving them broken — link-maintenance after a move,
narrative preserved. PDCA (current) updated likewise. `advanced-query.md:235`'s `ui-design` ref left
(a historical "verified in Round_53" citation; breadcrumb bridges it).

**Verified:** `a2scaffold skill validate ux-design` ✔; skill listed + discoverable as `ux-design` (full
description); `check:links` zero rename-related breakage; markdownlint 0 · round-lint 0 ·
design:lint/tokens 0. _(Pre-existing, out of scope: 6 `#L`-anchor broken links in R88/R92; a YAML
parse error in `cold-reviewer`'s `status:` frontmatter — both on HEAD before R98.)_

## Check

+ [x] **Design gate** — **RATIFIED** (human, 2026-06-26): rename scope + current-vs-historical split +
      the repoint-hrefs decision.
+ [x] **Build gate** — **done**: atomic rename + forward-ref updates + href repoints; all gates green.
+ [x] **Integration gate** — **closed; human-signed-off Complete 2026-06-26** ("Flip R98 Complete +
      commit"). Skill confirmed discoverable + invocable as `ux-design`; no live re-check needed (a
      rename — verified by `a2scaffold validate` + `check:links` + auto-discovery).

## Act

R98 corrected a misnamed governance artifact: `ui-design` → `ux-design` (it reviews UX honeycomb
affordances, never the UI layout skeleton), reserving `ui-design` for a future layout skill. A small,
truthful Track-2 cleanup — but it surfaced two reusable lessons:

+ **A rename's real cost is the reference graph, not the file.** The dir move was one `git mv`; the
  work was the ~50 references — and the split that mattered was **forward-looking (rename) vs
  append-only history (preserve)**. I mis-grepped the link inventory first (claimed "no path-links"),
  then `check:links` caught 6 in Complete rounds — a reminder that the **tool, not my pattern-match, is
  the source of truth** (Core Loop #4: verify against the real repo).
+ **Append-only ≠ "never touch."** Repointing a moved file's *href* (text/narrative untouched) is
  link-maintenance, not history-rewriting — the human's call drew that line cleanly, keeping both the
  record and the links truthful.

**Out of scope, flagged for a future cleanup** (both pre-existing on HEAD): 6 `#L`-anchor broken links
in R88/R92; a YAML parse error in `cold-reviewer`'s `status:` frontmatter (`a2scaffold skill validate`
chokes on the mid-value `": "`).

## Feeds into → Round_99+

+ **`ui-design` (layout) skill body** — the reserved name; content once the layout-primitive vocabulary
  stabilizes ([layout brainstorm](../brainstorms/2026-06-25-layout-as-architecture.md)).
+ Value-out themes — consumer-save / Excel, then dashboards ([[post-mvp-roadmap-migration-first]]).

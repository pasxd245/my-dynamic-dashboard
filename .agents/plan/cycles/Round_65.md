# Round 65: Doc-format conformance backfill — empty the `data-management` lint baseline

**Status**: Complete
**Date started**: 2026-06-09
**Date completed**: 2026-06-12

## Goal

**Inherits from ← [R64](Round_64.md)** — the doc-format standard + the
artifact-type-aware conformance lint
([`scripts/lint/design-doc-lint.mjs`](../../../scripts/lint/design-doc-lint.mjs)),
the conforming [`_TEMPLATE.md`](../../design/data-management/_TEMPLATE.md),
and the per-(doc, rule) grandfather
[baseline](../../../scripts/lint/design-doc-lint.baseline.json) holding **14
warnings across 8 docs** pending this round.

Apply the R64 template to the 8 grandfathered
[`data-management`](../../design/data-management/) docs so the corpus conforms
to the five enforced conventions, **removing each baseline entry as its gap is
fixed**. Target end-state: `pnpm design:lint` → **0 errors, 0 grandfathered
warnings**, baseline emptied. This is the content half of R64's tooling fix —
the lint proved the gaps; this round closes them.

_Track: 2 (agent-method / doc-format). Pulled by ← [R64](Round_64.md) Act
(handoff names this round explicitly)._

## The 14 gaps (from R64's clean lint run, 2026-06-08)

| Doc | L3 token-map | L4 scope-boundary | L5 acceptance-criteria |
| --- | :---: | :---: | :---: |
| `advanced-query.md` | ● | | |
| `crud-hygiene.md` | ● | | ● |
| `dataset-detail.md` | | | ● |
| `dataset-filters.md` | | | ● |
| `datasets.md` | ● | ● | ● |
| `upload.md` | ● | ● | ● |
| `workspace-shell.md` | | | ● |
| `workspaces.md` | ● | | ● |

Totals: **L3** ×5 · **L4** ×2 · **L5** ×7 = 14. (`workspace-shell.target.md`
already passes — target variant, L3/L5 n-a.)

## Two judgment calls carried from R64 (gate these — decide before backfilling)

- **J-1 — L3 strictness.** R64's L3 accepts a token map citing
  `themeTokens.ts` **or** an AntD seed token (matches the canonicalized README
  wording). The audit's strict A3 reading was `themeTokens.ts`-only. **Decide:**
  keep the README allowance, or tighten L3 to `themeTokens.ts`-only. This
  changes whether `dataset-filters.md`/`dataset-detail.md` (CSS-mirror + seed
  cites) need rework when their token maps are authored.
- **J-2 — `advanced-query.md` exemplar status.** The gold-standard A2 exemplar
  (C1–C17) is **non-conformant on A3** (no token map). R64 surfaced but did not
  act on the exemplar-status flip. **Decide:** author a token map to make it
  fully conformant (preferred — keeps it a true exemplar), or formally demote
  its exemplar status with a doctrine note.

## Plan (by step)

> **PAUSE here for ratification of J-1/J-2 before the backfill runs**
> (mirrors R64's Plan-gate pause for D-1/D-2). The token-map authoring depends
> on both calls.

1. **Author the 7 acceptance-criteria sections (L5)** — add a testable
   user-journeys / acceptance-criteria section (the `advanced-query.md` C1–Cn
   shape) to: `crud-hygiene`, `dataset-detail`, `dataset-filters`, `datasets`,
   `upload`, `workspace-shell`, `workspaces`. Remove each L5 baseline entry.
2. **Author the 2 scope-boundary sections (L4)** — explicit "does NOT cover /
   out of scope" in `datasets` + `upload`. Remove the L4 baseline entries.
3. **Author the 5 token maps (L3)** — per the **J-1** decision, add a Token map
   section (rows cite `themeTokens.ts`/AntD seed per ruling) to: `advanced-query`
   (per **J-2**), `crud-hygiene`, `datasets`, `upload`, `workspaces`. Remove each
   L3 baseline entry.
3a. **(if J-1 = tighten)** update L3 in `design-doc-lint.mjs` to
   `themeTokens.ts`-only and re-verify `dataset-filters`/`dataset-detail`.
4. **Drive the baseline to empty** — after each doc, drop its baseline rows;
   final `design-doc-lint.baseline.json` is `{}` (or documents any intentional
   residual). `pnpm design:lint` → **0 errors, 0 warnings**.
5. **Verify** — full audit: `design:lint` green, `markdownlint-cli2` repo-wide
   0 errors, `check_links.py --changed` exit 0.

## Acceptance criteria

- [x] **J-1 + J-2 ratified** and recorded in Do (J-1 = keep README
      allowance, step 3a skipped; J-2 = author the token map).
- [x] All **7 L5** acceptance-criteria sections authored; L5 baseline entries
      removed.
- [x] Both **L4** scope-boundary sections authored; L4 baseline entries removed.
- [x] All **5 L3** token maps authored (incl. `advanced-query` per J-2); L3
      baseline entries removed.
- [x] `design-doc-lint.baseline.json` **emptied** — no doc entries remain (the
      `_comment` / `_generated` meta keys are stripped by the loader, so it is
      functionally `{}`); comment rewritten to explain the emptied state.
- [x] `pnpm design:lint` → **0 errors, 0 grandfathered warnings** (9 docs).
- [x] `markdownlint-cli2` repo-wide → 0 errors (155 files);
      `check_links.py --changed` → exit 0 (9 files).

## What is OUT of scope

- The **doc↔source-of-truth parity linter** → **R66** (independent; verifies
  token-map *values* match `themeTokens.ts`, vs R64/R65 which enforce
  *presence and citation form*).
- Reconciling README vocab **outside** `data-management` (R64 D-1 ripple note).
- Any **UX/a11y** content change beyond what authoring an acceptance-criteria or
  token-map section mechanically requires (firewall — feature-backlog rounds).
  These docs describe shipped surfaces; backfill **documents** them, it does not
  redesign them.

## Risks / unknowns

- **Acceptance-criteria authorship is interpretive, not mechanical.** Writing
  testable criteria for 7 shipped surfaces means reading each surface's actual
  behavior — the largest effort here, and the place drift could be introduced if
  a criterion misstates shipped behavior. Mitigation: criteria describe
  *observed* shipped behavior; flag any divergence found rather than "fixing" it.
- **Token-map accuracy depends on J-1.** If L3 stays lenient, maps can cite the
  CSS mirror; if tightened, some surfaces may not have a clean `themeTokens.ts`
  cite and need investigation. J-1 must land before step 3.
- **`advanced-query` exemplar churn (J-2).** Editing the gold-standard exemplar
  to add a token map risks diluting what made it exemplary. Mitigation: additive
  only — append the token map, leave C1–C17 untouched.

## Do

### J-1 / J-2 ratification (2026-06-12, at the Plan gate)

- **J-1 — L3 strictness → keep the README allowance.** L3 stays
  lenient: a token map citing `themeTokens.ts` **or** an AntD seed
  token conforms (matches the canonicalized README wording, D-1).
  No change to [`design-doc-lint.mjs`](../../../scripts/lint/design-doc-lint.mjs);
  **step 3a is skipped**. `dataset-filters.md` / `dataset-detail.md`
  CSS-mirror + seed cites stay valid as authored. Token-map *value*
  parity vs `themeTokens.ts` is R66's job, not R65's.
- **J-2 — `advanced-query.md` exemplar → author a token map.** Append
  a Token map section (additive only; the C1–C17 acceptance list and
  the grammar tables are left untouched) so the gold-standard A2
  exemplar becomes fully A3-conformant and stays a true exemplar.

### Backfill execution

Authored against each surface's **documented shipped behavior** (every
target doc carries shipped/amended round stamps); criteria describe
observed behavior, not redesign (per the round's firewall + risk note).
Token maps cite only tokens already present in the vetted
[`dataset-detail.md`](../../design/data-management/dataset-detail.md) /
[`dataset-filters.md`](../../design/data-management/dataset-filters.md)
maps — no invented token names, so R66's value-parity check stays
honest.

| Doc | L3 token-map | L4 scope-boundary | L5 acceptance-criteria |
| --- | :---: | :---: | :---: |
| `advanced-query.md` | ✅ added (J-2) | n-a | already present (C1–C17) |
| `crud-hygiene.md` | ✅ added | already present | ✅ added |
| `dataset-detail.md` | already present | already present | ✅ added |
| `dataset-filters.md` | already present | already present | ✅ added |
| `datasets.md` | ✅ added | ✅ added | ✅ added |
| `upload.md` | ✅ added | ✅ added | ✅ added |
| `workspace-shell.md` | already present | already present | ✅ added |
| `workspaces.md` | ✅ added | already present | ✅ added |

## Check

- [x] **`pnpm design:lint`** → `0 error(s), 0 grandfathered warning(s)
      across 9 doc(s)`. Each of the 8 backfilled docs cleared its
      warnings; `workspace-shell.target.md` continues to pass (L3/L5
      n-a). Re-ran after emptying the baseline — no stale-baseline
      `ℹ note` lines remain.
- [x] **`markdownlint-cli2`** repo-wide → `Summary: 0 error(s)` across
      155 files (the new tables, fenced lists, and headings lint clean).
- [x] **`check_links.py --changed`** → exit 0, scanned 9 changed files
      against a 493-file candidate pool. All new internal links and
      heading anchors (e.g. `dataset-filters.md#token-map`,
      cross-doc `crud-hygiene.md` / `datasets.md` references) resolve.
- [x] **Baseline emptied** — `scripts/lint/design-doc-lint.baseline.json`
      holds only the `_comment` / `_generated` meta keys (no doc
      entries); a fresh doc now ERRORs on any gap, as intended.

### Divergences flagged (not "fixed" — per the risk note)

Authoring acceptance criteria against shipped behaviour surfaced two
intra-corpus inconsistencies, recorded inline rather than silently
rewritten (both are R66 parity-check candidates):

1. **`workspaces.md` card-click target.** The R13 layout note still
   reads "navigates to `/workspaces/<id>` (route stub)"; shipped
   behaviour (R17, per [datasets.md](../../design/data-management/datasets.md)
   R14 Q11) navigates to the workspace-filtered datasets list. Flagged
   in `workspaces.md` C4.
2. **Dataset-name max length.** `upload.md`'s Confirm step validates
   names as "1–80 chars"; the rename path
   ([crud-hygiene.md](../../design/data-management/crud-hygiene.md)) uses
   `NAME_LENGTHS` `DATASET_MAX = 120` (R62 correction). Flagged in
   `upload.md` C8.

## Act

**Outcome: the R64 tooling fix is now backed by a conformant corpus.**
R64 proved the gaps with the artifact-type-aware lint + a grandfather
baseline of 14 warnings across 8 docs; R65 closed all 14 — 7 L5
acceptance-criteria sections, 2 L4 scope boundaries, 5 L3 token maps —
and drained the baseline to empty. `pnpm design:lint` now ERRORs (not
WARNs) on any future data-management doc that drops a required section,
so the convention is self-enforcing from here.

**Judgment calls.** J-1 kept L3 lenient (README allowance: `themeTokens.ts`
**or** AntD seed), so no lint code changed and the CSS-mirror cites in
`dataset-filters.md` / `dataset-detail.md` stayed valid (step 3a skipped).
J-2 kept `advanced-query.md` a true A2 exemplar by appending a token map
(additive only — C1–C17 untouched).

**Doctrine for token maps.** Every authored map cites only tokens already
present in the vetted `dataset-detail.md` / `dataset-filters.md` maps
(plus AntD seed `colorPrimary` / `colorWarning`) — deliberately **no
invented token names** — so R66's value-parity linter inherits an honest
corpus to check rather than fabricated cites.

**Lifecycle.** All 8 docs amended in place (additive sections only; no
existing content removed or restructured). No supersession, no fold.

**Track 2 (agent-method / doc-format) status.** With presence +
citation-form enforced (R64) and the corpus now conformant (R65), the
doc-format thread is complete through "form." The open thread is
**value parity** → R66 below.

## Feeds into → Round_66 (TBD)

Doc↔source-of-truth **parity linter**: with presence + citation-form now
enforced (R64) and the corpus conformant (R65), R66 can verify token-map
**values** actually match [`themeTokens.ts`](../../../workspace/packages/ui/src/themeTokens.ts)
— catching stale/wrong cites that a presence check can't. R65's authored token
maps are its first real corpus to check against.

---

> **CLOSED 2026-06-12.** J-1/J-2 ratified at the Plan gate (J-1 = keep README
> allowance, step 3a skipped; J-2 = author the token map), the backfill ran, and
> all three verification gates are green (see Check). The `data-management`
> corpus conforms to all five lint rules with an empty grandfather baseline.
> R66 (doc↔source-of-truth value parity) is the next thread.

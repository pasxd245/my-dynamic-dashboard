# Round 152: Column show/hide — a `hidden?` view-hint + column-metadata PATCH (F7)

**Status**: Planning — D-gate pending; R140 an open input (2026-07-06)
**Date started**: 2026-07-06
**Flow**: **DCFBI** — set at the Design gate via flow-selector (0/5 fired); recorded in the Do log.

## Goal

**Inherits from ← [Round_151](Round_151.md)** — F7 split out of the rank-5 UI/diagnosability batch
(it's a design-gated mini-feature, not a background-friction fix). Per the signed-off
[R142 dogfood ranking](../brainstorms/2026-07-03-r142-dogfood-findings.md) (F7, Medium — UI/UX + model).

**The problem (F7):** wide tables are unreadable — `PagedRowsView` renders **every** column in one
horizontal scroll, with no show/hide. Real CRM exports have many columns; the user can't focus on
what matters. The proposal (from the R142 finding): a **`hidden?` view-hint on column metadata**,
editable **after** upload, honored as the **default** by row-preview surfaces so "we can show more"
of what matters.

**Why this is the right home (and doctrine-safe):** unlike dtype (F2, which wrongly stopped at
metadata), visibility **should** stay metadata-only — a view hint must **never** touch the stored
parquet, so the presentation/compute separation is satisfied, not violated. It's complementary to
the compute-level narrowing (the R141 `select` step): this is the **presentation-level default**,
not a substitute. Two new capabilities are implied:

- **(a)** a `hidden` view-hint on column metadata;
- **(b)** **post-upload column-metadata edit** — a column-level `PATCH`, which does **not** exist
  today (dataset rename is name-only; column overrides are upload-time).

## Open design questions (the D-gate — hard-stop for the human)

1. **"Default for WHOM"** (the load-bearing one) — scope the hint as an **overridable row-preview
   default**, NOT a hard projection: the Datasets row-preview / dataset-detail table hide `hidden`
   columns by default (with a "show all" escape), but **query-builder / join-key pickers still see
   ALL columns** (a hidden column must remain joinable/selectable). Confirm the exact surface list
   that honors vs ignores the hint.
2. **Where `hidden` lives + the PATCH shape** — `hidden?: boolean` on the column model
   (`columns_json`); the `PATCH` target (per-column? whole column-list?) and its wire/contract.
   Presentation-only → never re-reads/rewrites the parquet (only `columns_json`).
3. **Editing surface** — where the user toggles visibility (dataset-detail column header menu? a
   dedicated "columns" editor?). This is the new-interaction bit the flow-selector weighs.

## Plan (draft — the D step refines; do NOT build before D sign-off)

- [x] **D-gate pre-flight** — `design-sync --check` the **dataset-detail** design corpus
      (`.agents/design/data-management/datasets/dataset-detail.md` + `datasets.md` column model)
      before designing on it (the R148 lesson: don't design on a drifted doc). ✅ both docs were
      OUT OF SYNC on peripheral claims only; F7-load-bearing facts confirmed; drifts fixed, markers cleared.
- [x] **D**: design-corpus draft — the `hidden?` view-hint + the column-metadata `PATCH` +
      which surfaces honor the default (Q1). Resolve Q1–Q3; table any domain decisions. Then
      flow-selector at D exit. ✅ Q1–Q3 + R140 resolved; **Flow: DCFBI** (0/5). **Awaiting human D sign-off.**
- [x] **C**: `Column` gains `hidden?: boolean`; a new column-metadata `PATCH` contract
      (+ `values.yaml`/constants if a code/enum is introduced). ✅ see Do log below.
- [x] **B**: the `PATCH` writes `columns_json` only (never the parquet); validation (unknown
      column, can't-hide-all?, at-least-one-visible?). Atomicity per the existing dataset writes.
      **Refresh carry-forward** (cold-review anchor-2): the R145/R147 refresh handler re-applies
      `new_hidden = previous_hidden ∩ re-parsed column names` before the atomic swap (both replace
      and merge); mismatched/gone columns drop their hint, new columns default visible. ✅ see Do log.
- [ ] **F**: the row-preview surfaces default-hide `hidden` columns (with a show-all escape); the
      editing affordance; query-builder/join pickers explicitly keep ALL columns (Q1).
- [ ] **I**: i18n en+vi for the visibility affordance + any hint copy.
- [ ] Tests: PATCH round-trips `hidden`; parquet untouched; row-preview hides by default + show-all;
      query-builder still lists hidden columns; per D decisions.

## Risks / unknowns

- **Presentation-vs-compute doctrine** — the hint MUST stay metadata-only (never touch parquet). A
  slip that filters stored data would violate the separation and silently drop columns from queries.
- **Hard-projection vs default (Q1)** — if a hidden column stops being joinable/selectable, F7
  breaks query construction. The hint is a row-preview DEFAULT, not a projection — verify every
  consumer.
- **New PATCH capability** — first column-level mutation; keep it scoped to view-hints (not a
  general column editor) unless D pulls more.
- **Flow** — the visibility editor may be a new interaction (flow-selector cond-2) → possibly
  DFCFBI (F1 feel-review before contract). Let the selector decide at D exit.
- **Carried, open input**: the **R140 UI/UX list** (never enumerated — enumerate-and-fold here, or
  formally drop). **Parked**: R145 slice 1b (blast-radius preview); AI-propose-key (#2). ④ export parked.

## Do

### D-gate pre-flight — `design-sync --check` datasets corpus (2026-07-06) ✅

Ran the check (code-truth map + diff, delegated the code read per skill §2). Report:
[`.agents/tmp/design-sync/datasets-R152.md`](../../tmp/design-sync/datasets-R152.md). Stamped the
OUT-OF-SYNC marker on both drifted docs (comment-only, no body rewrite).

- **dataset-detail.md** — OUT OF SYNC, 3 peripheral claims (Refresh missing from Actions-menu ASCII;
  page-size ASCII omits `10`; refresh-settings route unlisted).
- **datasets.md** — OUT OF SYNC, 2 peripheral claims (migration list omits `0004`; Refresh
  over-claimed as a header button vs an `Actions ▾` item).
- **F7-load-bearing facts CONFIRMED trustworthy** (designed-on OK): (a) `Column = {name, dtype}`,
  `extra="forbid"` on all three layers, **no `hidden` field** → a real contract widening;
  (b) **no column-metadata PATCH exists** (only name-only rename; overrides are upload-time) → F7's
  endpoint is net-new; (c) row-preview `PagedRowsView` and ALL pickers (filter/advanced-query/
  relationship-key/query-builder/join/workflows) read **one shared full column list** → Q1's
  "preview default, pickers keep all" is a deliberate new split, not reuse of an existing seam.
- Peripheral drift → recommend a full `design-sync` reconciliation as a follow-up; NOT an R152 blocker.

### D — design corpus drafted (2026-07-06)

Q1–Q3 + R140 resolved with the human (AskUserQuestion):

- **Q1 (load-bearing)**: `hidden` is an **overridable row-preview default, NOT a projection**.
  Honored only by the dataset-detail `PagedRowsView` row-preview (default-hide + "show all"
  escape); **ignored** by every picker (filter / advanced-query / relationship-key /
  query-builder / join / workflows) — a hidden column stays fully joinable/selectable/filterable.
  Query-detail preview = out of scope (deferred).
- **Q2**: `hidden?: boolean` on the `Column` model (inside `columns_json`; widens the shared
  `column.yaml` + Pydantic + TS types; no parquet migration). PATCH = **whole visibility set**:
  `PATCH /datasets/{id}/columns` body `{ hidden: string[] }` (replace semantics), writes
  `columns_json` only. Errors `404 not_found`, `422 unknown_column`, `422 no_visible_columns`.
- **Q3**: editing surface = a **"Columns" manager** (AntD drawer/popover, checklist + apply),
  opened from a `[⚙ Columns N/M]` toolbar button right of the row-search counter; it is the only
  surface that can re-show a hidden column and carries the "show all" escape.
- **R140 UI/UX list**: **DROPPED** (pruning discipline — never enumerated across many rounds; the
  signed-off R142 dogfood ranking is the concrete UI/UX backlog).

Design written into the corpus (D-gate artifact lives in `.agents/design/`, not the cycle doc):
[datasets.md § Column visibility](../../design/data-management/datasets/datasets.md) (model, contract,
honor/ignore split) and [dataset-detail.md § Column visibility](../../design/data-management/datasets/dataset-detail.md)
(Columns manager, row-preview default). All 5 pre-flight drifts also fixed in the touched sections;
both OUT-OF-SYNC markers cleared. Gates: `design:lint` 0, `design:tokens` 0, `markdownlint` 0.

### Cold-review pass (pre-lock, `mix`) — 2026-07-06

Ran cold-reviewer on the D-gate design (Q1–Q3 + the two corpus § Column visibility sections).
Load-bearing code claims all verified against source (Column `extra="forbid"` + `name`/`dtype`
only; rename is the only existing PATCH; shared full column list). **Anchor 2 (pre-mortem)
surfaced the one real gap**: the R145/R147 refresh re-parses and rewrites `columns_json` from
freshly-parsed `{name, dtype}`, so `hidden` would be **silently wiped on every refresh** — and
the design never mentioned refresh. Human decision (2026-07-06): `hidden` **must survive**
refresh; reconcile by name (mismatched columns drop the hint) — **folded into R152**, not a
separate round (it's the missing tail of F7, ~5–8 lines in a handler that already holds the
prior `columns_json`). Design amended: new **[§ Refresh interaction](../../design/data-management/datasets/datasets.md#refresh-interaction-hidden-survives-mismatched-columns-drop)**
in datasets.md. Anchor 4 (global vs per-user hint) surfaced, low weight — dataset-global is the
intended framing. Could-not-verify carried to C: FE TS `Column` type + MSW strict fixtures.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | The Columns manager is a checklist + apply; preview states (loading/populated/empty/no-match) pre-exist, not new branches. |
| 2. New interaction pattern           | no     | A drawer/popover checklist reuses patterns already shipped (filter popovers, modals); not a genuinely new pattern. |
| 3. High user-error risk              | no     | Visibility is presentation-only, fully reversible, never touches the parquet; an at-least-one-visible guard prevents an empty preview. |
| 4. Contract depends on unresolved UI | no     | `PATCH {hidden: string[]}` is fully resolved from the journey; Q1–Q3 answered at D. |
| 5. UX confidence below threshold     | no     | Well-understood AntD pattern; Q1–Q3 resolved with human input at the D-gate. |

Result: **Flow: DCFBI** (0/5 fired).

### C — contract landed (2026-07-06)

The wire contract for the `hidden` view-hint + the new column-visibility PATCH:

- **`_shared/column.yaml`** — `Column` gains optional `hidden: boolean` (absent = visible;
  never nullable). Widened the FE `Column` TS type + the Pydantic `Column` (`common.py`) in
  lockstep (no codegen — the 3-impl lockstep discipline).
- **New endpoint** — [`datasets/columns-patch.contract.{yaml,md}`](../../../workspace/packages/contracts/datasets/columns-patch.contract.yaml):
  `PATCH /datasets/{id}/columns` body `{ hidden: string[] }` (replace semantics, `uniqueItems`),
  `200 Dataset`. Errors: `404 not_found`; `422` two-shape (FastAPI `{detail}` for a malformed
  body · code-first `{code:"unknown_column",column}` / `{code:"no_visible_columns"}`), matching
  the batch-commit 422 convention. Deliberately **no 409** (presentation-only, reversible).
- **`_shared/api-error.yaml`** — added `unknown_column` + `no_visible_columns` to the enum, two
  variant schemas, the `oneOf`, and the discriminator mapping.
- **Serialization guard** — widening the *shared* `Column` leaked `hidden: null` into the
  existing uploads-preview response (a direct FastAPI model return; `hidden` is `type: boolean`,
  non-nullable → contract-validity test failed). Fixed at the source: a `@model_serializer` on
  `Column` **omits `hidden` when unset** on every wire path, so absent = visible per the
  contract. (Caught by the backend contract-validity test — the R41 3-impl anti-drift net earning
  its place.)
- **Cold-review could-not-verify resolved**: MSW validates 2xx bodies with AJV; `hidden` is
  optional, so existing fixtures (which omit it) stay valid — no fixture break. FE `Column` type
  updated.

Gates: contracts openapi-validity **39 passed**; backend **ruff clean · pytest 352**; FE
**tsc clean · vitest 304**; markdownlint **0** + links clean.

### B — backend landed (2026-07-06)

The PATCH handler + the refresh carry-forward, both `columns_json`-only:

- **`values.yaml` + both `constants` templates** — registered `unknown_column` +
  `no_visible_columns` (the `.hbs` templates enumerate keys explicitly, so both the
  backend `ERROR_CODES` and the FE `ERROR_CODES` were widened; re-rendered via
  `config:render`). Python mirrors `ApiErrorUnknownColumn` / `ApiErrorNoVisibleColumns`
  added to `common.py`.
- **Handler** `set_column_visibility` (`PATCH /datasets/{id}/columns`,
  [datasets.py](../../../workspace/apps/backend/app/routers/datasets.py)) — 404 pre-check;
  `422 unknown_column` (first unknown name); `422 no_visible_columns` (`hidden == all names`);
  then rewrites `columns_json` (sets `hidden: true` on hidden cols, **pops the key** on visible
  ones so the stored shape stays minimal). A `SetColumnVisibilityBody` field-validator rejects
  duplicate names as a FastAPI `{detail}` 422 (the wire's `uniqueItems`).
- **Refresh carry-forward** — a `_carry_forward_hidden(cols, prev_columns)` helper (extracted so
  the already-complex refresh handler didn't grow) re-applies the prior `hidden` set by name onto
  the freshly re-parsed columns, right before the `columns_json` write — **after** the parquet was
  already staged, so it never touches stored data. Covers replace and merge.
- **Doctrine proof** — a test reads the parquet bytes before/after the PATCH and asserts they are
  **byte-identical**, plus `rowCount`/`columnCount` unchanged.

New tests: [`test_datasets_columns_patch.py`](../../../workspace/apps/backend/tests/test_datasets_columns_patch.py)
(10) — round-trip, replace semantics + clear, unknown_column, no_visible_columns, 404, duplicate→detail,
**parquet-untouched**, **refresh carries hidden forward**, **refresh drops a vanished column's hint**,
stored-shape omits the key when visible.

Gates: backend **ruff clean · pytest 362** (352 + 10); FE **tsc clean**; contracts still valid.
Generated `_generated/constants.{py,ts}` are gitignored (regenerated by the pre-commit `config:render`).

## Check

- [x] R140 decision recorded — **DROPPED** (see Do log; R142 dogfood ranking is the backlog).
- [ ] D signed off before C/B/F (Q1 surface list + PATCH shape + editing surface). **← awaiting human**
- [ ] `hidden` PATCH round-trips; parquet untouched; row-preview default-hides + show-all;
      query-builder/join pickers still see hidden columns.
- [ ] Backend pytest + ruff green; FE tsc + vitest green; design/plan/markdown lints clean.
- [ ] Human review of the visibility walk.

## Act

_(Learnings / promotions / prune check at close.)_

## Feeds into → Round_153 (TBD)

Re-rank at open. **Carried**: R140 list (if still open), R145 slice 1b, AI-propose-key. ④ export parked.

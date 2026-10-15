# Round 180: read-only metadata — namespaced entries on seven nouns, written by token

**Status**: Review — C, B, F and the visual gate done; awaiting the human acceptance walk (W1–W4) and sign-off
**Flow**: DCFBI — one noun-less capability (entries hang off existing nouns), contract-first, both halves verified against a real browser and a real token.
**Date started**: 2026-10-15
**Date completed**: —

## ⟢ At a glance

**Shipped** — `metadata_entries` (migration `0005`): one entry per noun × namespace on dataset,
column, relationship, query, workflow, dashboard and widget. `GET /metadata/{kind}/{id}` reads
(a dataset / dashboard also returns its columns' / widgets' entries); `PUT` / `DELETE` need a
bearer token from `backend.metadata_tokens` (empty by default → every write is **401**), each
token limited to a closed namespace list (**403** otherwise; `system` is never writable). The
server stamps `author`, `source`, `writtenAt` and `definitionVersion`; the body carries only `md`
(a client cannot claim an author). The text follows R179's safe markdown subset, ≤ 64 KiB, may
open with YAML frontmatter the product does not interpret; refused with \*\*422 `metadata_invalid`

- reason**, never cleaned. The builder shows a read-only panel on the dataset, query, workflow and
  dashboard pages and an ⓘ popover per widget: namespace, **AI** badge for `source: ai`, author
  and time, a**May be out of date\*\* flag when the noun's definition has changed, frontmatter as a
  key/value table, body through `SafeMarkdown`. Backend 521 · builder 418 · contracts 43.

**Studied** _(predicted → saw → now believe)_ — **predicted** the risky part was the token
check. **Saw** that the token check is four lines; what took thought was _what a note is about_:
`definitionVersion` had to pick, per kind, the slice of the noun a writer would reasonably have
read (a dataset's schema, not its row count; a widget's own config, not its dashboard), or the
stale flag would fire on every refresh and mean nothing. **Now believe (medium confidence — one
dogfood cycle will tell)** that "definition moved" is the right first anchor and that data
version / run and view parameters (the rc.3 triple) are separate flags, not a stronger version of
this one.

**Watch** — relationships have no detail page, so their entries are readable only through the API
until R183's self-check panel gives them a surface. Entries of a deleted noun stay in the table
(unreadable, harmless) — a sweep belongs with the noun delete paths when it matters. The
namespace cap (32 per noun) is a constant in `app/metadata.py`. Token secrets live in settings
(values.yaml / `MDD_CONFIG_FILE` / env JSON) — never in the repo.

## Goal

**Inherits from ← [Round_179](Round_179.md)** — fourth rc.2 round and the first "explain" one.
An agent that registers data or designs a query needs somewhere to say what it is, where it came
from and what it is for — and a person reading the dashboard needs to see who said it, when, and
whether it still holds. A note that anyone could edit on the UI would lose exactly that.

Add server-stamped, read-only metadata entries, written only through the API with a token.

_Track: 1 (product). Pulled by: the rc.2 roadmap's R-h (external feedback items F20 / F22 —
"metadata by token, author and time stamped by the server, markdown cleaned"), and purpose.md's
key design decision #5 (flag drift, don't hide it) — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: with no token configured nothing can be written; with one, an entry round-
trips with the server's stamps and shows read-only with the right badges; editing the noun's
definition flips the entry to stale; writing one namespace never touches another; every refusal
is a typed error.
**Falsified if**: a client-supplied author or source reaches storage, or the UI offers any edit.

- [x] **D** — entries are NOT a noun of their own (no list page, no id): they hang off the seven
      kinds and are read with the noun. Namespace is the writer's free string; `source` comes from
      the token, so an agent's entry is always badged. The subject anchor is the noun's
      _definition_ only (schema / dtype / ends / definition JSON / widget config).
- [x] **C** — `_shared/metadata.yaml` (`MetadataEntry`, `MetadataEntries`, `MetadataRead`);
      `metadata/{get,put,delete}.contract.yaml`; `_shared/api-error.yaml` + `config/values.yaml` + both constants templates gain `unauthorized`, `forbidden`, `metadata_invalid`.
- [x] **B** — `db_models.MetadataEntry` + `alembic/versions/0005_metadata_entries.py` (parity test
      updated); `_config/settings.MetadataToken` + `BackendSettings.metadata_tokens`;
      `app/metadata.py` (`resolve_noun` per kind, `validate_entry`, `entries_for`, `children_for`);
      `routers/metadata.py` (GET / PUT / DELETE); three `ApiError*` models;
      `tests/test_metadata.py` +15.
- [x] **F** — `features/metadata/` (types, `hooks.useMetadataQuery`, `frontmatter.splitFrontmatter`,
      `MetadataPanel` / `MetadataEntryView` / `MetadataEntriesList`); `api/metadataApi.ts`; mounted
      on `DatasetDetailPage` (dataset + columns), `QueryDetailPage`, `WorkflowDetailPage`,
      `DashboardDetailPage` (dashboard + a per-widget ⓘ popover); EN/VI i18n; `MOCK_METADATA` +
      MSW `getMetadata`; `tests/metadata-panel.test.tsx` +6.
- [x] **I / visual gate** — backend started with two tokens (env JSON): no token 401, foreign
      namespace 403, `system` 403, `<b>` 422; entries written on a dataset, a column (AI and human),
      a dashboard, a widget (AI and human) and a query; the query's definition edited → stale;
      the three pages screenshotted; the panel has no input.

## Risks / unknowns

- **`extra=forbid` on the body is the author guard.** A body with `author` is a 422, not a
  silently dropped field — tested. If the body ever grows fields, this stays the rule.
- **One hash per kind.** A dashboard-level entry goes stale when any widget changes — that is
  "the definition moved", by design; a widget-level entry only when its own config does.
- **Frontmatter is split, not parsed.** `key: value` lines become rows; anything else is shown as
  text. No YAML library, no interpretation (decision 2026-10-13 #4).
- **Secrets in env.** `MDD_BACKEND__METADATA_TOKENS` is a JSON list; `token` must be ≥ 16 chars.
  Nothing in the repo carries one.

## Do

- 2026-10-15 — C: shared schema, three contracts, three error codes through the generated
  constants (template + `values.yaml`; `pnpm config:render`). Contracts 43.
- 2026-10-15 — B: model + migration `0005` (parity: legacy DDL, `_TABLES`, head revision);
  settings token model; `metadata.py` with the per-kind `definitionVersion`; router; 15 tests
  (writes off by default, stamps, author claim refused, namespace rules, six 422 reasons,
  namespace isolation, every kind + children, stale on definition change, delete rules, cap).
  Backend 521.
- 2026-10-15 — F: feature folder, panel, mounts on four pages, widget popover, fixtures + MSW
  handler (contract-validated), 6 tests. Builder 418, type-check clean.
- 2026-10-15 — visual gate on the cloud runner with tokens via env: dataset page shows the
  frontmatter table (`source`, `exported_on`, `rows`) + body, then `closed_at` (AI) and `status`
  (human) children; the query page flags the entry **May be out of date** after the definition
  edit; the dashboard page shows an `ai_insights` entry with a `period` frontmatter row and the
  widget's two entries, and the widget's ⓘ popover shows the same two. No textarea / input inside
  any panel. Nothing written under `workspace/apps/backend/data/`.

## Check

- [x] backend 521 · builder 418 · contracts 43 green; `tsc --noEmit` clean; `ruff check` clean;
      schema parity green at head `0005`; `plan:lint`, markdownlint 0
- [x] Visual gate (UI-bearing round): real browser, real tokens, screenshots kept with the review
- [x] Affordance check (`ux-design`, structural): Findability — a collapsible **Metadata** header
      right under the facts, and an ⓘ on the widget that has entries; Usability — nothing to
      operate but expand / open; Accessibility — tags carry text, the ⓘ has an aria-label;
      Credibility — author + time + AI badge + stale flag on every entry; Utility — "what is
      this, who said so, does it still hold" on the page; Desirability — reads like a note,
      not a form.
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 4`:
  - ⬜ W1 — with no token configured, `PUT /metadata/dataset/<id>/aicowork` → 401; the dataset
    page shows no panel.
  - ⬜ W2 — configure a token with `namespaces: [aicowork]`, write an entry with frontmatter on a
    dataset and one on a column. The page shows both under **Metadata**, the AI badge on each,
    the frontmatter as a table; there is nothing to edit.
  - ⬜ W3 — write on a query, then change the query's filter. The entry shows **May be out of
    date**; writing it again clears the flag.
  - ⬜ W4 — write to a namespace outside the token's list → 403; send `author` in the body → 422.

## Act

_(at close)_

## Feeds into → Round_181 (TBD)

R181 — table totals (`Widget.totals`, sum / ratio per column, computed by the backend over the
full filtered result): the first rc.2 "đợt 2" round. Nothing here is a dependency; R182 (export)
will carry the active filters and totals, and R183 (relationship self-check) gives relationships
the page their metadata needs.

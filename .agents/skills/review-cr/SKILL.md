---
name: review-cr
description: Fixed code-review checklist for one round's diff in the four-role loop — identifier quoting, migration both ways, the error-code parity chain, cache invalidation after a PUT, swap/version races, CSV/XLSX formula injection, exit codes, EN/VI parity. Run by the `code-reviewer` agent after the F gate on `git diff <base>..HEAD` plus the round file. Grades P0/P1/P2; ends with PASS or CHANGES.
when_to_use: After a round's F commit, before the round moves to Review; and again on the fix commit to re-check raised ids. Inputs are the round file and the diff only. Trigger phrases include "code review R<NN>", "review the diff", "review-cr".
argument-hint: '<round: Round_NNN.md> <base: commit the round opened on> [--recheck CR-1,CR-3]'
allowed-tools: Read, Grep, Glob, Bash(git diff *), Bash(git log *), Bash(git show *), Bash(pnpm *), Bash(uv run *), Bash(rg *)
metadata:
  author: hand-authored-2026-10-18
  version: '1.0'
  status: 'registered — Track-2 (agent-method). Pulled by rc3.md § Execution (four-role loop) and the R191–R197 audit: six recurring finding types, none carried by a checklist. Agent: .claude/agents/code-reviewer.md'
---

> The role contract (inputs, output schema, grading, what it never does) is
> [`.claude/agents/code-reviewer.md`](../../../.claude/agents/code-reviewer.md). This file is the
> **checklist** that contract points at. Every item runs every round; answer each with evidence
> (`file:line`, a command output) or `n/a (why)`.

## Checklist

1. **SQL identifiers and values** — every column / table name reaching DuckDB or SQLite goes
   through the quoting helper; values are bound, never formatted in. A user-named column with a
   quote, a space or `=` in it still works. Grep the diff for f-strings that build SQL.
2. **File paths** — parquet / upload / export paths are built under the app's data root from ids,
   never from user names; a `..` or an absolute path in a name cannot escape. Staging and backup
   names are per request (R192 R3), not shared.
3. **Migration both ways** — the new `alembic/versions/00NN_*.py` has an `upgrade` and a
   `downgrade` that restores the previous schema and keeps every row; a SQLite CHECK or FK change
   uses the rebuild pattern (`0004`, `0008`) so children keep referencing the table; the parity
   test (`tests/test_schema_parity.py`) and a `test_migration_00NN.py` exist. Run the test.
4. **Error-code parity chain** — a new code appears, in the same commit, in all of:
   `packages/contracts/_shared/api-error.yaml` (enum + body schema + the route's `oneOf`) →
   `workspace/config/values.yaml` → generated constants (`pnpm -s config:render`) → builder
   `_shared/types.ts` `ApiError` union + `isApiError` → `src/mocks/handlers.ts` → EN/VI copy that
   renders it. A code missing from the union shows the generic toast (R192 R1); a route's `oneOf`
   broken by a scripted edit is a P0 (R193 BA P0-1). Memory:
   [error-code-ships-with-client-union](../../memory/2026-10-18-error-code-ships-with-client-union.md).
5. **Bind-time validation vs drift** — a value bound late (a parameter, a viewer value, a refresh
   file cell) is checked **at bind time against the column it lands on**; a bad value answers
   `422 param_invalid` / `coercion_failed`, never `409 query_stale`, never a 500 (R194 ×3, R191
   P0). Memory:
   [bind-time-validation-vs-drift](../../memory/2026-10-18-bind-time-validation-vs-drift.md).
6. **Cache invalidation after a PUT** — every mutation that changes what a read returns invalidates
   the react-query keys of those reads (widgets after a dashboard update, dataset detail after a
   refresh / publish; R192 R4, R195 P1). Check the `onSuccess` of each new mutation hook.
7. **Swap / version race** — a file swap and its version bump happen in one update (R185 pattern);
   a reader between the two cannot see new rows with the old version; a snapshot re-checks the
   file, not only the counter (R193 F1, R196 race).
8. **CSV / XLSX formula injection** — any cell that can start with `=`, `+`, `-`, `@` is kept as
   text on **every** sheet, Filters sheet included (R196 QA P1); CSV cells likewise. Open the
   workbook parts: no `<f>` element.
9. **Exit codes and envelopes** — a refusal is the documented status (`409` for a state conflict,
   `422` for a bad input) with the typed body; a 404 is not retried by the client (R191, R192 R5);
   5xx may retry. A `detail` string 422 from FastAPI is not collapsed into "Request failed".
10. **i18n EN/VI parity** — every new key exists in both `src/i18n/locales/{en,vi}.json`; no
    English inside a VI string (R191); terms match the glossary in use ("tập dữ liệu", "truy vấn").
11. **Tests prove the claim** — each acceptance criterion the Do log says is tested has a test
    that fails on the pre-round code (spot-check two by reverting the hunk); a test that never
    reaches the surface it names (R192 F-6) is a P2 test gap, a P1 if it is the only proof of a
    criterion.
12. **Scope** — nothing in the diff belongs to the next rc's items or changes an accepted shape
    (D-points, decisions 1–14) — the latter is a P0 and a hard stop.
13. **Explicit order** — every paged read (`LIMIT/OFFSET`) and every row listing (an export, an
    unpaged widget read) the diff adds or changes has an `ORDER BY` on a stable key, or a comment
    naming why it may omit one and the test that guards it. An engine default
    (`preserve_insertion_order`) is not an order: an `IN` list, an `OR … IS NULL`, a join or an
    aggregate can drop it once DuckDB parallelises (R165 W-7, R172, R199 CR-1). A test that
    `sorted()` its rows to pass is a finding. Probe at ≥ 130k rows. Memory:
    [explicit-order-not-engine-default](../../memory/2026-10-19-explicit-order-not-engine-default.md).

## Output

Per [`code-reviewer.md`](../../../.claude/agents/code-reviewer.md) § Output schema — ids `CR-n`,
`verdict`, `duplicates`, `could-not-verify`. On a re-check, each raised id as `closed` / `open`.

## Quality bar

- Grounded-or-silent: every finding cites `file:line` and a repro or quote.
- Fixed list: never skip an item because the round "does not touch that" — write `n/a (why)`.
- Surfaces, never fixes: the coder fixes; this skill re-checks.

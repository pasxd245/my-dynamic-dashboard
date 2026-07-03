# Error surfaces teach the fix; grown vocabularies re-verify v1 assumptions

**Date**: 2026-07-04
**Agent**: Claude Code
**Confidence**: High
**Status**: New

## Problem

R144's Review dogfood (real FM2.25 uploads) produced six findings. Four were iterations on
ONE error surface (the commit-time `coercion_failed`/`format_unsupported` 422) that was
"working as designed" yet failed the user each time differently. Three others were latent
multi-round bugs sharing one root shape.

## Finding

**A. An error surface is done only when the user can act on it unaided.** The R143/R144
422 was typed, named the column and cells — and still failed four ways in real use:

1. Its row number was an internal convention (1-indexed data row) — the user opened the
   wrong Excel line. Numbers shown to users must be **user-space** (the source-file row,
   header + skipped rows included).
2. When ALL cells fail, row guidance is the wrong genre — the TYPE/format is the problem.
   Failure-rate changes what advice applies.
3. Deterministic signals beat generic advice: failing cell == column name → "repeated
   header row, delete file row N"; time-part under a `date` target → "choose `datetime`;
   bucket later".
4. The best backend message is worthless if a client layer eats it (the FE wrapped only
   coded envelopes; FastAPI string-`detail` 422s rendered as "Request failed: 422").
   Also: the wizard alert is transient — WARNING-log the same trace server-side.

**B. When a vocabulary grows, grep for its v1 assumptions.** Three latent bugs, one shape —
an assumption true when a feature was v1, silently invalidated as its vocabulary grew:

- R120 steps: "shaped results are small by construction (one row per group)" → died when
  row-preserving steps (derive/filter/sort/date_bucket) landed → stepped queries returned
  ALL rows, pager lying.
- Query detail page: "single-source ⇒ dataset columns" → died at R120 too (steps reshape)
  → appended/reshaped columns invisible for four rounds.
- R143: "data-row numbering matches the preview copy" → died the moment a real user tried
  to locate a cell.

**C. Infra bonus:** `alembic/env.py` `fileConfig()` defaults to
`disable_existing_loggers=True` — it silently disabled every app logger created before the
startup migration, eating ALL app logs since Alembic adoption. Always pass
`disable_existing_loggers=False`. (It also resets root handlers — pytest `caplog` must
attach to the specific logger when the app boots inside the test.)

## Evidence

- Round: `.agents/plan/cycles/Round_144.md` (Review findings #1–#6, commits `aa81d82`,
  `e71c546`, `72183c0`, `720a5bd`, `1d677df`, `761aad6`, `01bc65b`)
- Files: `workspace/apps/backend/app/ingest/parquet_writer.py` (source-file rows, reasoned
  `FormatUnsupportedError`), `workspace/apps/builder/src/api/datasetsApi.ts` (detail fold),
  `workspace/apps/backend/alembic/env.py`

## Recommendation

**Do**:

- At an error-surface D-gate, specify: (a) the number the user sees is one they can jump
  to, (b) per-cause guidance (what should the user DO), (c) the server-side log line,
  (d) which client layer renders it — then dogfood on a real file before calling it done.
- When extending a discriminated vocabulary (step kinds, dtype targets, error codes), grep
  the codebase for comments/branches encoding the ORIGINAL cardinality/shape assumptions
  and re-verify each.

**Don't**:

- Don't report internal indices to users; don't give row advice for total failures; don't
  let any client path collapse a structured error into a generic status line.
- Don't call `fileConfig()` without `disable_existing_loggers=False`.

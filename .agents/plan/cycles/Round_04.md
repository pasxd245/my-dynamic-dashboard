# Round 04: SQL Translator & Query Execution

**Status**: Deferred
**Linked Tasks**: T4.1–T4.10 (see specs/001-upload-profile-field-roles/tasks.md)
**Date started**: —
**Date completed**: —
**MVP**: 1

## Goal

Query config JSON (base table, columns, filters, aggregations) → DuckDB SQL → execute → preview/export.

## Implementation Narrative

**Not yet started**. Awaiting: US4 manifest (T036-T043), Round 03 relationships CRUD, Round 05 builder UI shell.

**Critical dependency**: Relationship graph (Round 03) required for JOIN path finding.

## Decision Gate

**Blocked**: Relationship CRUD not yet implemented. Start after Round 03 complete.

**Success criteria**:

- Produces valid DuckDB SQL for 1–2 joins
- Filters, GROUP BY, aggregations all rendered
- 100k-row query + 1 join < 5s

## Act

## **Learnings**

**Dependencies**: Blocked on Round 03 (relationship CRUD). Relationship graph must be finalized before JOIN path finding is implemented.

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :

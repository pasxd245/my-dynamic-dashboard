# Round 03: Relationship Management

**Status**: Deferred
**Linked Tasks**: T3.1–T3.7 (see specs/001-upload-profile-field-roles/tasks.md)
**Date started**: —
**Date completed**: —
**MVP**: 1

## Goal

Users define relationships between tables. Schema changes flag affected relationships as broken.

## Implementation Narrative

**Not yet started**. Deferred from original MVP1 sequencing. US1-US3 (upload, profile, roles) prioritized to establish data layer foundation first. Scheduled to begin after US4 (manifest export) and Round 05 (builder upload UI).

**Blocking**: Relationship CRUD endpoints (T3.1-T3.7) required by Round 04 SQL translator (needs join graph).

## Decision Gate

**Blocked**: Scheduled after US4 manifest + Round 05 builder. Start criteria:

- Manifest export endpoints complete (T036-T043)
- Builder upload UI shell done (Round 05)
- SQL translator ready (Round 04 prerequisite)

**Success criteria**:

- Create/list/delete relationships via API
- Validation rejects bad table/column references
- Schema change detection marks broken relationships

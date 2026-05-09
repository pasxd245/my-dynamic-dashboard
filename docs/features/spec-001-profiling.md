# Spec 001 — Data Upload & Profiling

**Status**: ✅ Complete | **Source of truth**: [specs/001-upload-profile-field-roles/](../../specs/001-upload-profile-field-roles/)

## What it does

Upload CSV/Excel files and automatically derive a typed, role-classified profile so downstream features (relationships, query builder) have reliable metadata.

## Capabilities

- Column type detection (int, float, string, date, …)
- Role assignment: `identity_key`, `measure`, `dimension`, `time_anchor`, `status`, `outcome`
- Profile statistics: null %, distinctness, numeric ranges, date ranges
- Data quality warnings surfaced at upload time

## Where to look

- Spec: [spec.md](../../specs/001-upload-profile-field-roles/spec.md)
- Data model: [data-model.md](../../specs/001-upload-profile-field-roles/data-model.md)
- Manual test guide: [quickstart.md](../../specs/001-upload-profile-field-roles/quickstart.md)
